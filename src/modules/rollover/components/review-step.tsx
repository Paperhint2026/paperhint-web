import { useEffect, useState } from "react"
import {
  CheckCircleIcon,
  CircleNotchIcon,
  WarningIcon,
} from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Sticker } from "@/components/shared/sticker"

type Preview = {
  to_year: string
  classes: number
  students_with_exceptions: number
  missing_target: string[]
  ready: boolean
}
type ExecuteResult = {
  moved?: number
  graduated?: number
  detained?: number
  withdrawn?: number
  classes_created?: number
  classes_reused?: number
}

/** Step 4 and 5: what will happen, then the one atomic call that does it. */
export function ReviewStep({
  planId,
  onExecuted,
}: {
  planId: string
  onExecuted: (result: ExecuteResult) => void
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState("")
  const [executing, setExecuting] = useState(false)

  const load = () => {
    setPreview(null)
    apiClient
      .post<Preview>("/api/rollover/preview", {})
      .then(setPreview)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not build the preview")
      )
  }
  useEffect(load, [planId])

  const execute = async () => {
    setExecuting(true)
    try {
      const r = await apiClient.post<{ result: ExecuteResult }>(
        "/api/rollover/execute",
        {}
      )
      onExecuted(r.result)
    } catch (e) {
      showError(e)
    } finally {
      setExecuting(false)
    }
  }

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
            section. Go back to the class plan step and set one.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <CheckCircleIcon weight="fill" className="size-4 text-primary" />
          Every class has a target. Ready to run.
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={execute} disabled={!preview.ready || executing}>
          {executing && <CircleNotchIcon className="size-4 animate-spin" />}
          Run the rollover
        </Button>
        <Button variant="outline" onClick={load}>
          Re-check
        </Button>
      </div>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Sticker name="point" size={28} />
        This is one action. Every class and student moves together, or nothing
        does.
      </p>
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
