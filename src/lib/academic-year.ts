/**
 * The school year, as "YYYY-YYYY". Indian schools open in June, so any month
 * from June onward belongs to the year that starts then; Jan-May still belong
 * to the year that started the previous June.
 */
export function getCurrentAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  if (month >= 5) {
    return `${year}-${year + 1}`
  }
  return `${year - 1}-${year}`
}

/**
 * Validates an academic year string. Returns an error message to show under
 * the field, or null when the value is fine. Rules: "YYYY-YYYY", consecutive
 * years (2026-2027, never 2025-2030), and a sane starting year.
 */
export function validateAcademicYear(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return "Academic year is required"

  const match = /^(\d{4})-(\d{4})$/.exec(trimmed)
  if (!match) return "Use the format YYYY-YYYY, e.g. 2026-2027"

  const start = Number(match[1])
  const end = Number(match[2])
  if (end !== start + 1) {
    return "The two years must be consecutive, e.g. 2026-2027"
  }
  if (start < 2000 || start > 2100) {
    return "That starting year doesn't look right"
  }
  return null
}
