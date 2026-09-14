import { useCallback, useEffect, useMemo, useState } from "react"
import { CircleNotchIcon } from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { ClassRosterPanel } from "@/modules/rollover/components/class-roster-panel"
import type {
  ContextClass,
  RolloverException,
  RolloverPlan,
} from "@/modules/rollover/lib/types"

/**
 * Step 2 of 3: reshuffling. Grade promotion is already decided — this step is
 * only for the exceptions to it: a student who moves to a different section,
 * is detained, or withdraws. A class list on the left, that class's roster on
 * the right — the same master/detail shape as everywhere else in the product,
 * one level deeper than the stepper itself (docs/truth.md, founder 2026-09-14).
 */
export function ReshuffleStep({
  plan,
  onSaved,
}: {
  plan: RolloverPlan
  onSaved: (plan: RolloverPlan) => void
}) {
  const [classes, setClasses] = useState<ContextClass[] | null>(null)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiClient
      .get<{ classes: ContextClass[] }>("/api/batches/context")
      .then((r) => {
        const active = r.classes.filter((c) => c.is_pending_promotion)
        setClasses(active)
        setSelected((prev) => prev ?? active[0]?.id ?? null)
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load classes")
      )
  }, [])

  const exceptionCountByClass = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of plan.plan.students) {
      counts.set(s.source_class_id, (counts.get(s.source_class_id) ?? 0) + 1)
    }
    return counts
  }, [plan.plan.students])

  const classFor = (classId: string) =>
    plan.plan.classes.find((c) => c.source_class_id === classId)

  const actionFor = (classId: string) => classFor(classId)?.action ?? "promote"

  // Each class's roster owns its own slice of exceptions; saving replaces
  // that slice inside the plan's full list rather than the whole thing.
  const saveExceptions = useCallback(
    (sourceClassId: string, exceptions: RolloverException[]) => {
      setSaving(true)
      const others = plan.plan.students.filter(
        (s) => s.source_class_id !== sourceClassId
      )
      apiClient
        .put<{ plan: RolloverPlan }>("/api/rollover/plan/students", {
          students: [...others, ...exceptions],
        })
        .then((r) => onSaved(r.plan))
        .catch((e) => showError(e))
        .finally(() => setSaving(false))
    },
    [plan.plan.students, onSaved]
  )

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!classes) return <Skeleton className="h-64 w-full rounded-xl" />

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Everyone else follows their class. List only who needs to be
          different.
        </p>
        {saving && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <CircleNotchIcon className="size-3 animate-spin" />
            Saving…
          </span>
        )}
      </div>
      <div className="grid gap-0 overflow-hidden rounded-xl border border-border bg-background sm:grid-cols-[220px_1fr]">
        <div className="max-h-[32rem] overflow-y-auto border-b border-border sm:border-r sm:border-b-0">
          {classes.map((c) => {
            const count = exceptionCountByClass.get(c.id) ?? 0
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
                  selected === c.id
                    ? "bg-primary/10 text-foreground"
                    : "text-secondary-foreground hover:bg-muted"
                )}
              >
                <span className="font-medium">
                  {c.grade}
                  {c.section}
                </span>
                {count > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="min-w-0">
          {selected ? (
            <ClassRosterPanel
              key={selected}
              sourceClassId={selected}
              classAction={actionFor(selected)}
              targetGrade={classFor(selected)?.target?.grade}
              toYear={plan.to_year}
              onExceptions={saveExceptions}
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              No classes to reshuffle.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
