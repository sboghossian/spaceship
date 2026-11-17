export const STORY_MAX_WORDS = 400

export const STORY_SYSTEM_PROMPT = `Continue the LinkedIn post. The user message is its opening, which may stop mid-sentence.

- Output only the words that come next. Do not repeat the opening.
- Your first word directly follows the opening's last word.
- First person, plain spoken, one idea per sentence. Plain text only. No title, hashtags, emojis, markdown or commentary.
- Do not invent statistics, company names, customers or quotes.
- At most ${STORY_MAX_WORDS} words. End on a complete sentence.

EXAMPLE
User: The demo worked, but
Assistant:
nobody opened it twice. I spent the next week asking why.`

export const STORY_REQUEST = {
  system: STORY_SYSTEM_PROMPT,
  temperature: 0.9,
  maxCompletionTokens: 2000,
}
