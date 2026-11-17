import { storedApiKey, streamCompletion } from "../llm/cerebras.ts"
import type { Dimension, DimensionContext, DimensionSource } from "./dimension.ts"

const MENU_SIZE = 5
const MAX_WORDS_PER_LABEL = 3
/** Independent axes of a short passage of a post, most consequential first. */
const CATALOG: Dimension[] = [
  { name: "tone", kind: "scale", low: "humble", high: "bold" },
  { name: "angle", kind: "choice", options: ["lesson", "story", "contrarian take", "how-to"] },
  { name: "density", kind: "scale", low: "punchy lines", high: "full paragraphs" },
  { name: "proof", kind: "scale", low: "opinion", high: "concrete example" },
  { name: "audience", kind: "choice", options: ["founders", "operators", "engineers", "general"] },
  { name: "formality", kind: "scale", low: "casual", high: "polished" },
  { name: "candor", kind: "scale", low: "guarded", high: "candid" },
  { name: "close", kind: "choice", options: ["question", "takeaway", "call to action"] },
  { name: "surprise", kind: "scale", low: "expected", high: "unexpected" },
]

const SYSTEM_PROMPT = `
The user message has the start of a LinkedIn post, cut off where the reader is, sometimes the reader's key phrases (keyword in brackets), and a list of axes. Each axis is one way the next 100 words could vary, written as "name: label | label".

Pick the axes that matter most for what the post could say next at this point, as many as asked, most important first. With key phrases, favor the axes that act on them. Output the picked lines unchanged, one per line, and nothing else.

EXAMPLE
User:
Post: We spent a month building the dashboard. The demo worked, but nobody opened it twice. I
Axes:
tone: humble | bold
angle: lesson | story | contrarian take | how-to
proof: opinion | concrete example
audience: founders | operators | engineers | general
close: question | takeaway | call to action
Pick 3.
Assistant:
angle: lesson | story | contrarian take | how-to
proof: opinion | concrete example
tone: humble | bold
`.trim()

/** One call offers the menu: the free catalog axes that matter most here. Axes the model leaves out or garbles are filled in from the catalog. */
export const liveDimension: DimensionSource = async function* (context, signal) {
  const apiKey = storedApiKey()
  if (!apiKey) throw new Error("save an API key first")

  const takenNames = context.taken.map(({ name }) => name.toLowerCase())
  const free = CATALOG.filter(({ name }) => !takenNames.includes(name))
  const size = Math.min(MENU_SIZE, free.length)
  if (!size) return

  const offered: string[] = []
  const deltas = streamCompletion({
    apiKey,
    system: SYSTEM_PROMPT,
    user: userMessageOf(context, free, size),
    temperature: 0.3,
    maxCompletionTokens: 1500,
    signal,
  })
  for await (const line of linesOf(deltas)) {
    const dimension = dimensionOf(line, free)
    if (!dimension || offered.includes(dimension.name)) continue
    offered.push(dimension.name)
    yield dimension
    if (offered.length === size) return
  }
  yield* free.filter(({ name }) => !offered.includes(name)).slice(0, size - offered.length)
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

function userMessageOf({ text, leads }: DimensionContext, free: Dimension[], size: number) {
  const keyPhrases = leads.length ? `Key phrases:\n${leads.map(({ before, keyword, after }) => `- ${before}[${keyword}]${after}`).join("\n")}\n` : ""
  return `Post: ${text}\n${keyPhrases}Axes:\n${free.map(axisLine).join("\n")}\nPick ${size}.`
}

function axisLine(axis: Dimension) {
  if (axis.kind === "scale") return `${axis.name}: ${axis.low} | ${axis.high}`
  return `${axis.name}: ${axis.options.join(" | ")}`
}

/** Reads a "name: label | label" line as one of `axes`, keeping that axis's kind; undefined when it is not one of them or its labels do not fit the kind. */
function dimensionOf(line: string, axes: Dimension[]): Dimension | undefined {
  const [name, rest] = line.split(":", 2).map((part) => part.trim())
  const axis = axes.find((axis) => axis.name === name.toLowerCase())
  const labels = (rest ?? "").split("|").map(plainLabel)
  if (!axis || !labels.every(isValidLabel)) return

  if (axis.kind === "scale") return labels.length === 2 ? { name: axis.name, kind: "scale", low: labels[0], high: labels[1] } : undefined
  return labels.length >= 2 && labels.length <= 4 ? { name: axis.name, kind: "choice", options: labels } : undefined
}

/** Drops a parenthesised aside, which the model sometimes adds to a label. */
function plainLabel(label: string) {
  return label
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function isValidLabel(label: string) {
  return label !== "" && label.split(" ").length <= MAX_WORDS_PER_LABEL
}
