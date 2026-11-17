import { storedApiKey, streamCompletion } from "../llm/cerebras.ts"
import type { AttentionBox, AttentionSource } from "./attention.ts"
import { wordSpans } from "./segments.ts"

const MAX_BOXES = 3

const SYSTEM_PROMPT = `
The user message is the start of a LinkedIn post, cut off where the reader is. Pick the key phrases already in it that the very next words depend on most: the main influences on what comes right after the cut.

- Pick 1 to 3 phrases: 1 when a single phrase drives what comes next, more only when several do.
- Each phrase is an exact, unbroken copy of 2 to 8 consecutive words from the post. Do not skip, change, add or predict words.
- In every phrase, wrap the single word that matters most in [brackets].
- Output one phrase per line and nothing else.

EXAMPLE
User: We spent a month building the dashboard. The demo worked, but nobody opened it twice. I stopped and
Assistant:
a month building the [dashboard]
nobody opened it [twice]
I [stopped] and
`.trim()

export const liveAttention: AttentionSource = async function* (text, signal) {
  const apiKey = storedApiKey()
  if (!apiKey) throw new Error("save an API key first")

  const textWords = wordsOf(text)
  const yielded = new Set<number>()
  const deltas = streamCompletion({ apiKey, system: SYSTEM_PROMPT, user: text, temperature: 0.3, maxCompletionTokens: 1000, signal })

  for await (const line of linesOf(deltas)) {
    const box = boxFromLine(line, textWords)
    if (!box || yielded.has(box.keyword)) continue
    yielded.add(box.keyword)
    yield box
    if (yielded.size >= MAX_BOXES) return
  }
}

async function* linesOf(deltas: AsyncIterable<string>) {
  let buffer = ""
  for await (const delta of deltas) {
    const lines = (buffer + delta).split("\n")
    buffer = lines.pop()!
    yield* lines
  }
  yield buffer
}

function boxFromLine(line: string, textWords: string[]): AttentionBox | undefined {
  const open = line.indexOf("[")
  const close = line.indexOf("]", open)
  const hasBrackets = open !== -1 && close !== -1
  const phrase = wordsOf(line.replace(/[[\]]/g, ""))
  if (!phrase.length) return

  const keywordWords = hasBrackets ? wordsOf(line.slice(open + 1, close)) : []
  const offset = hasBrackets ? wordsOf(line.slice(0, open)).length : phrase.length - 1
  const keyword = hasBrackets ? keywordWords[0] : phrase[offset]

  const at = lastIndexOfSequence(textWords, phrase)
  if (at !== -1 && offset < phrase.length) return { keyword: at + offset, before: offset, after: phrase.length - 1 - offset }

  const keywordAt = hasBrackets && keyword ? textWords.lastIndexOf(keyword) : -1
  if (keywordAt !== -1) return { keyword: keywordAt, before: 0, after: 0 }
}

function lastIndexOfSequence(haystack: string[], needle: string[]) {
  for (let at = haystack.length - needle.length; at >= 0; at--) {
    if (needle.every((word, i) => haystack[at + i] === word)) return at
  }
  return -1
}

function wordsOf(text: string) {
  const normalized = text.replaceAll("’", "'")
  return wordSpans(normalized).map(({ start, end }) => normalized.slice(start, end).toLowerCase())
}
