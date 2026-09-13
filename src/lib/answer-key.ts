/**
 * AI/OCR answer keys arrive as one unbroken paragraph: "(i) … (ii) … 1. …
 * 2. … OR (b) …". Markdown collapses whatever whitespace they do have, so
 * this inserts paragraph breaks at the natural seams before rendering.
 * Guards: decimals (33.33) never split (a step-dot needs trailing space +
 * capital/formula start); chained enumerators like "(iii) (a)" stay on one
 * line (romans break, letters don't).
 */
export function formatAnswerKey(raw: string): string {
  let t = raw.trim()
  // roman enumerators "(i) … (vi)" start a paragraph
  t = t.replace(/\s+\((?=(?:i{1,3}|iv|v|vi{0,3})\)\s)/g, "\n\n(")
  // numbered steps "1. Capital…" (sentence dot before is fine; decimals can't match)
  t = t.replace(/(?<!\d)\s(\d{1,2})\.\s+(?=[A-Z($\\])/g, "\n\n$1. ")
  // lead-ins get their own bolded line
  t = t.replace(
    /\s+(Step-by-step Explanation:|Explanation:)/g,
    "\n\n**$1**\n\n"
  )
  // alternative-solution marker
  t = t.replace(/\s+OR\s+\(/g, "\n\nOR (")
  return t.trim()
}
