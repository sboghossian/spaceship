import { delay } from "./completion.ts"
import type { Dimension, DimensionSource } from "./dimension.ts"

const MENU_SIZE = 5
const LATENCY_MS = 150

const DIMENSIONS: Dimension[] = [
  { name: "tone", kind: "scale", low: "humble", high: "bold" },
  { name: "angle", kind: "choice", options: ["lesson", "story", "contrarian"] },
  { name: "density", kind: "scale", low: "punchy", high: "detailed" },
  { name: "audience", kind: "choice", options: ["founders", "operators", "engineers"] },
  { name: "proof", kind: "scale", low: "opinion", high: "example" },
  { name: "formality", kind: "scale", low: "casual", high: "polished" },
]

export const simulatedDimension: DimensionSource = async function* ({ taken }, signal) {
  await delay(LATENCY_MS, signal)
  const takenNames = new Set(taken.map(({ name }) => name))
  const free = DIMENSIONS.filter(({ name }) => !takenNames.has(name))
  yield* (free.length ? free : DIMENSIONS).slice(0, MENU_SIZE)
}
