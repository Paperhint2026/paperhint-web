import { CheckCircleIcon, WarningIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export type Preview = {
  to_year: string
  classes: number
  students_with_exceptions: number
  missing_target: string[]
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
 * What will happen — read-only. The footer's "Run the rollover" drives the
 * actual execute call, so this step is purely the review: stats, a warning if
 * something is missing, a way to re-check after fixing it in Plan.
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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Classes in the plan" value={preview.classes} />
        <Stat
          label="Students with an exception"
          value={preview.students_with_exceptions}
        />
        <Stat label="Opening year" value={preview.to_year} />
      </div>

      {preview.missing_target.length > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <WarningIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>
            {preview.missing_target.length} class
            {preview.missing_target.length === 1 ? "" : "es"} in the plan{" "}
            {preview.missing_target.length === 1 ? "has" : "have"} no target
            section. Go back to the plan step and set one.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <CheckCircleIcon weight="fill" className="size-4 text-primary" />
          Every class has a target. Ready to run.
        </div>
      )}

      <Button variant="outline" onClick={onRetry} className="self-start">
        Re-check
      </Button>
    </div>
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
