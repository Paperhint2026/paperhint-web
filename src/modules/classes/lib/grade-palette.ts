/** Cover colours cycle by grade so neighbouring cards never match — the grid
 *  should read like a corridor of different classroom doors. Literal Tailwind
 *  colour pairs (with dark: counterparts) follow the TeacherCard status-badge
 *  precedent. */
const COVERS = [
  {
    cover:
      "bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-700 dark:to-emerald-950",
    disc: "text-emerald-700 dark:text-emerald-400",
    tint: "bg-emerald-100 dark:bg-emerald-900/40",
    wash: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    cover:
      "bg-gradient-to-br from-sky-500 to-sky-700 dark:from-sky-700 dark:to-sky-950",
    disc: "text-sky-700 dark:text-sky-400",
    tint: "bg-sky-100 dark:bg-sky-900/40",
    wash: "bg-sky-50 dark:bg-sky-950/30",
  },
  {
    cover:
      "bg-gradient-to-br from-violet-500 to-violet-700 dark:from-violet-700 dark:to-violet-950",
    disc: "text-violet-700 dark:text-violet-400",
    tint: "bg-violet-100 dark:bg-violet-900/40",
    wash: "bg-violet-50 dark:bg-violet-950/30",
  },
  {
    cover:
      "bg-gradient-to-br from-amber-500 to-amber-700 dark:from-amber-600 dark:to-amber-900",
    disc: "text-amber-600 dark:text-amber-400",
    tint: "bg-amber-100 dark:bg-amber-900/40",
    wash: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    cover:
      "bg-gradient-to-br from-rose-500 to-rose-700 dark:from-rose-700 dark:to-rose-950",
    disc: "text-rose-700 dark:text-rose-400",
    tint: "bg-rose-100 dark:bg-rose-900/40",
    wash: "bg-rose-50 dark:bg-rose-950/30",
  },
  {
    cover:
      "bg-gradient-to-br from-teal-500 to-teal-700 dark:from-teal-700 dark:to-teal-950",
    disc: "text-teal-700 dark:text-teal-400",
    tint: "bg-teal-100 dark:bg-teal-900/40",
    wash: "bg-teal-50 dark:bg-teal-950/30",
  },
] as const

export function coverFor(grade: string) {
  const n = Number(grade)
  const index = Number.isFinite(n)
    ? n
    : [...grade].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return COVERS[Math.abs(index) % COVERS.length]
}
