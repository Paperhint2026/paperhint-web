export interface ExamCol {
  id: string
  exam_name: string
  total_marks: number
  created_at: string
}

export interface StudentRow {
  id: string
  full_name: string
  roll_number: number
  register_number?: string | null
}

export interface MarkCell {
  submission_id?: string | null
  final: number | null
  ai: number | null
  status: string
}

export type Tone = "good" | "ok" | "low"

export function scoreTone(pct: number): Tone {
  if (pct >= 80) return "good"
  if (pct >= 50) return "ok"
  return "low"
}

export const TONE_TEXT: Record<Tone, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  ok: "text-foreground",
  low: "text-amber-600 dark:text-amber-400",
}

export const TONE_BAR: Record<Tone, string> = {
  good: "bg-emerald-500",
  ok: "bg-blue-500",
  low: "bg-amber-500",
}

export const TONE_STROKE: Record<Tone, string> = {
  good: "stroke-emerald-500",
  ok: "stroke-blue-500",
  low: "stroke-amber-500",
}

export function isGrading(cell: MarkCell | undefined) {
  return cell?.status === "uploaded" || cell?.status === "processing"
}

export function cellPct(exam: ExamCol, cell: MarkCell | undefined) {
  if (cell?.status !== "graded" || exam.total_marks <= 0) return null
  return ((cell.final ?? 0) / exam.total_marks) * 100
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}
