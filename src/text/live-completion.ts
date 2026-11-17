import { storedApiKey, streamCompletion } from "../llm/cerebras.ts"
import { STORY_OPENINGS } from "../story/openings.ts"
import { STORY_MAX_WORDS, STORY_REQUEST } from "../story/prompt.ts"
import { strengthLevelOf, valueOf, type Control } from "./dimension.ts"
import type { Steering, TextSource } from "./text-stream.ts"
import { countWords } from "./words.ts"

const STEERED_SYSTEM_PROMPT = `Continue the LinkedIn post. The user message may list KEY PHRASES and CONTROLS, then the post so far, which may stop mid-sentence.

- Output only the words that come next. Your first word directly follows the post's last word: if the post stops mid-sentence, finish that sentence first. Never repeat or restart any of the post so far, not even its last word: after "…the demo was still" write "broken, and…", never "still broken" or "The demo was still broken".
- Key phrases lead what the post says next: build the continuation on them, most of all on the [bracketed] words.
- Controls set how the next passage reads. Each is a dimension given only by its name and its poles or options, so infer from the labels what to change in the argument, audience or style. A scale gives a position between two poles: at an extreme, exaggerate that pole so a reader notices it within two sentences; midway, balance both. A choice names the option to follow. Each control ends with a strength in parentheses that sets how much it shapes the passage. Strong: it dominates every sentence. Moderate: a clear influence throughout. Slight: show it in one or two touches only, such as a single sentence or image, and otherwise write the passage as the post's own argument, the key phrases and the stronger controls would have it; a slight control must never set the overall character of the passage. Strength is separate from the value and replaces the exaggeration rule: exaggerate a pole only at strong. Obey every control from the first sentence to the last, but never write a label itself as words of the post.
- With both, key phrases are the content and controls are the manner: what the post says next grows out of the key phrases, whose bracketed words appear in the first two sentences, written in the controlled manner.
- First person, plain spoken, one idea per sentence. Plain text only. No title, hashtags, emojis, markdown or commentary.
- Do not invent statistics, company names, customers or quotes.
- Write 120 to 300 words, never more than ${STORY_MAX_WORDS}. End on a complete sentence.

EXAMPLE
User:
KEY PHRASES
nobody opened it [twice]

CONTROLS
tone: very bold

POST SO FAR
We spent a month building the dashboard. The demo worked, but nobody opened it twice. I
Assistant:
stopped defending it. Twice is the only number that counts. If people do not come back, you built a demo, not a product.`

const MAX_ECHO_WORDS = 6

const STEERED_REQUEST = { ...STORY_REQUEST, system: STEERED_SYSTEM_PROMPT }

export const liveSource: TextSource = { expand: expandToStoryStart, complete: completeStory }

/** Picks a random story opening that begins with the same words as `text`. */
function expandToStoryStart(text: string) {
  const words = text.match(/\S+/g) ?? []
  const candidates = STORY_OPENINGS.filter((start) => {
    const startWords = start.split(/\s+/)
    return startWords.length >= words.length && words.every((word, i) => word === startWords[i])
  })
  return candidates[Math.floor(Math.random() * candidates.length)] ?? text
}

async function* completeStory(prefix: string, steering: Steering, signal: AbortSignal) {
  const apiKey = storedApiKey()
  if (!apiKey) throw new Error("save an API key first")

  const isSteered = steering.leads.length > 0 || steering.controls.length > 0
  const request = isSteered ? { ...STEERED_REQUEST, user: steeredUserMessage(prefix, steering) } : { ...STORY_REQUEST, user: prefix }
  let head: string | undefined = ""
  for await (const delta of streamCompletion({ ...request, apiKey, signal })) {
    if (head === undefined) {
      yield delta
      continue
    }
    head += delta
    if (countWords(head) <= MAX_ECHO_WORDS) continue
    yield ` ${withoutEcho(prefix, head)}`
    head = undefined
  }
  const rest = head && withoutEcho(prefix, head)
  if (rest) yield ` ${rest}`
}

/** Drops the leading words of `head` that repeat the last words of `prefix`, which the model sometimes echoes before it continues. */
function withoutEcho(prefix: string, head: string) {
  const start = head.trimStart()
  const tail = (prefix.match(/\S+/g) ?? []).slice(-MAX_ECHO_WORDS).map(bareWord)
  const words = [...start.matchAll(/\S+/g)]
  for (let count = Math.min(tail.length, words.length); count > 0; count--) {
    const isEcho = tail.slice(-count).every((word, i) => word !== "" && word === bareWord(words[i][0]))
    if (isEcho) return start.slice(words[count - 1].index + words[count - 1][0].length).trimStart()
  }
  return start
}

function bareWord(word: string) {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
}

/** Empty blocks are left out, header included. */
function steeredUserMessage(prefix: string, { leads, controls }: Steering) {
  const blocks = [
    ["KEY PHRASES", leads.map(({ before, keyword, after }) => `${before}[${keyword}]${after}`)],
    ["CONTROLS", controls.map(controlLine)],
    ["POST SO FAR", [prefix]],
  ] as const
  return blocks
    .filter(([, lines]) => lines.length)
    .map(([header, lines]) => `${header}\n${lines.join("\n")}`)
    .join("\n\n")
}

function controlLine({ dimension, position, strength }: Control) {
  const options = dimension.kind === "choice" ? ` (options: ${dimension.options.join(", ")})` : ""
  return `${dimension.name}: ${valueOf({ dimension, position })}${options} (${strengthLevelOf(strength)})`
}
