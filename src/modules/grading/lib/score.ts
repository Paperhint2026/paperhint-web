/** Score colour by share of total — the same bands as the class marks page. */
export function scoreTone(marks: number, total: number) {
  const pct = total > 0 ? (marks / total) * 100 : 0
  if (pct >= 60)
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
  if (pct >= 35)
    return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
  return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
}

export function percentOf(marks: number, total: number) {
  return total > 0 ? Math.round((marks / total) * 100) : 0
}

/** "77", "73.5" — drop a trailing .0 but keep half marks. */
export function formatMarks(n: number | null | undefined) {
  if (n === null || n === undefined) return "–"
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
