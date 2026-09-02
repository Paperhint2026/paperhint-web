/**
 * Does the answer key name this option letter? Matches the first A–D near
 * the start (optionally in parens) and deliberately does not scan the whole
 * string, so an "A" inside the answer text isn't mistaken for the letter.
 */
export function matchesOptionLetter(
  answerKey: string | null | undefined,
  label: string
): boolean {
  if (!answerKey) return false
  const m = answerKey.match(/^\s*\(?\s*([A-Da-d])\s*[).:\s]/)
  if (!m) return false
  return m[1].toUpperCase() === label.toUpperCase()
}

/** "(A) Gold and silver" → "Gold and silver" when the letter is A. */
export function stripOptionPrefix(opt: string, label: string): string {
  const re = new RegExp(`^\\s*(?:\\(${label}\\)|${label}\\s*[.):])\\s*`, "i")
  const stripped = opt.replace(re, "").trim()
  return stripped || opt
}
