/**
 * Grades, and the bands they imply. A band is a TAG read back from a grade
 * selection (founder, 2026-09-13) — never a field anyone fills in. Where a
 * school defines its own bands is grade/class creation; this only names what a
 * selection already says.
 */

/** 0 is kindergarten. */
export const GRADES = Array.from({ length: 13 }, (_, i) => i)

export const gradeLabel = (g: number) => (g === 0 ? "KG" : String(g))

const BANDS: { name: string; grades: number[] }[] = [
  { name: "Kindergarten", grades: [0] },
  { name: "Primary", grades: [1, 2, 3, 4, 5] },
  { name: "Middle", grades: [6, 7, 8] },
  { name: "Secondary", grades: [9, 10] },
  { name: "Higher secondary", grades: [11, 12] },
]

/** "Primary", "Primary + Middle", or a plain list when it matches no band. */
/** True when the numbers run without a gap. */
function isRun(grades: number[]): boolean {
  return grades.every((g, i) => i === 0 || g === grades[i - 1] + 1)
}

export function describeGrades(grades: number[], empty = "All grades"): string {
  if (grades.length === 0) return empty
  const sorted = [...grades].sort((a, b) => a - b)
  // An unbroken run reads as a range: "Grades 5 to 10" beats
  // "Middle + Secondary + 5", which is accurate and unreadable.
  if (sorted.length > 2 && isRun(sorted)) {
    const exact = BANDS.find(
      (b) =>
        b.grades.length === sorted.length &&
        b.grades.every((g, i) => g === sorted[i])
    )
    if (!exact)
      return `Grades ${gradeLabel(sorted[0])} to ${gradeLabel(sorted[sorted.length - 1])}`
  }
  const set = new Set(sorted)
  const hit: string[] = []
  const covered = new Set<number>()
  for (const b of BANDS) {
    if (b.grades.every((g) => set.has(g))) {
      hit.push(b.name)
      b.grades.forEach((g) => covered.add(g))
    }
  }
  const rest = sorted.filter((g) => !covered.has(g))
  if (hit.length > 0 && rest.length === 0) return hit.join(" + ")
  if (hit.length > 0)
    return `${hit.join(" + ")} + ${rest.map(gradeLabel).join(", ")}`
  return grades.map(gradeLabel).join(", ")
}
