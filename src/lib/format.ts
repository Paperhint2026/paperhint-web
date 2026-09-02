/** "12 of 20" while filtering, "20 teachers" at rest. */
export function countSummary(
  shown: number,
  total: number,
  noun: string,
  filtering: boolean
) {
  if (filtering) return `${shown} of ${total}`
  return `${total} ${total === 1 ? noun : `${noun}s`}`
}

/**
 * Uploaded titles often arrive SHOUTING ("Chapter 13 : LIGHT"). Any word of
 * three or more letters set entirely in caps is brought down to Title Case;
 * short tokens like "PDF" or "8A" are left alone so acronyms survive.
 */
const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "vs",
  "via",
])

export function tameCaps(text: string) {
  return text.replace(/\b[A-Z]{2,}\b/g, (w, offset: number) => {
    const lower = w.toLowerCase()
    if (SMALL_WORDS.has(lower))
      return offset === 0 ? w[0] + lower.slice(1) : lower
    // Two-letter tokens that aren't small words ("8A" has a digit and never
    // matches; "UK", "IT") stay as they are — likely acronyms.
    if (w.length === 2) return w
    return w[0] + lower.slice(1)
  })
}
