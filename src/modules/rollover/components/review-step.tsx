import { CheckCircleIcon, WarningIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export type PreviewStudentRow = {
  student_id: string
  full_name: string
  roll_number: number | string | null
  from: { grade: number; section: string }
  status: "moved" | "detained" | "graduated" | "withdrawn" | "unresolved"
  to?: {
    grade: number
    section: string
    academic_year: string
    is_new_section: boolean
  } | null
}
export type Preview = {
  to_year: string
  classes: number
  students_with_exceptions: number
  missing_target: string[]
  new_sections: number
  students: PreviewStudentRow[]
  ready: boolean
}
export type ExecuteResult = {
  moved?: number
  graduated?: number
  detained?: number
  withdrawn?: number
  classes_created?: number
  classes_reused?: number
}

/**
 * What will happen — read-only, one row per student, nothing left to
 * imagine. The footer's "Run the rollover" drives the actual execute call
 * (founder, 2026-09-14: "a complete table of all the grades, all the
 * sections, all the students").
 */
export function ReviewStep({
  preview,
  error,
  onRetry,
}: {
  preview: Preview | null
  error: string
  onRetry: () => void
}) {
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!preview) return <Skeleton className="h-48 w-full rounded-xl" />

  const unresolved = preview.students.filter((s) => s.status === "unresolved")

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Classes in the plan" value={preview.classes} />
        <Stat label="Students" value={preview.students.length} />
        <Stat label="New sections" value={preview.new_sections} />
        <Stat label="Opening year" value={preview.to_year} />
      </div>

      {preview.missing_target.length > 0 || unresolved.length > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <WarningIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>
            {preview.missing_target.length > 0 &&
              `${preview.missing_target.length} class${preview.missing_target.length === 1 ? "" : "es"} in the plan ${preview.missing_target.length === 1 ? "has" : "have"} no target section. `}
            {unresolved.length > 0 &&
              `${unresolved.length} student${unresolved.length === 1 ? "" : "s"} could not be placed. `}
            Go back and fix it, then re-check.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <CheckCircleIcon weight="fill" className="size-4 text-primary" />
          Every student is placed. Ready to run.
        </div>
      )}

      <div className="max-h-[28rem] overflow-x-auto overflow-y-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/90 text-left text-xs text-muted-foreground backdrop-blur-sm">
            <tr>
              <th className="px-3 py-2 font-medium">Class</th>
              <th className="px-3 py-2 font-medium">Student</th>
              <th className="px-3 py-2 font-medium">Result</th>
              <th className="px-3 py-2 font-medium">Moves to</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {preview.students.map((s) => (
              <tr key={s.student_id}>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {s.from.grade}
                  {s.from.section}
                </td>
                <td className="px-3 py-2 text-foreground">
                  {s.full_name}
                  {s.roll_number != null && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      #{s.roll_number}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {s.status === "graduated" && (
                    <span className="text-muted-foreground">
                      Leaves the school
                    </span>
                  )}
                  {s.status === "withdrawn" && (
                    <span className="text-muted-foreground">Withdrawn</span>
                  )}
                  {s.status === "unresolved" && (
                    <span className="text-destructive">No target</span>
                  )}
                  {(s.status === "moved" || s.status === "detained") &&
                    s.to && (
                      <span className="text-foreground">
                        Grade {s.to.grade}
                        {s.to.section}
                        {s.to.is_new_section && (
                          <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                            new section
                          </span>
                        )}
                      </span>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button variant="outline" onClick={onRetry} className="self-start">
        Re-check
      </Button>
    </div>
  )
}

function StatusBadge({ status }: { status: PreviewStudentRow["status"] }) {
  const labels: Record<PreviewStudentRow["status"], string> = {
    moved: "Promoted",
    detained: "Detained",
    graduated: "Graduated",
    withdrawn: "Withdrawn",
    unresolved: "Unresolved",
  }
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-0.5 text-xs",
        status === "detained" &&
          "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        status === "unresolved" &&
          "border-destructive/40 bg-destructive/5 text-destructive",
        (status === "moved" ||
          status === "graduated" ||
          status === "withdrawn") &&
          "border-border text-muted-foreground"
      )}
    >
      {labels[status]}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <p className="text-2xl font-semibold text-foreground tabular-nums">
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
