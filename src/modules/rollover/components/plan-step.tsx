import { useEffect, useMemo, useState } from "react"
import { CircleNotchIcon, GraduationCapIcon } from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  ContextClass,
  RolloverPlan,
  RolloverPlanClass,
} from "@/modules/rollover/lib/types"

/**
 * Step 1 of 3: which grade every class moves into. Pre-filled — promote to
 * the next grade, same section letter — so the only classes that show a
 * Promote/Graduate choice are the ones actually AT the school's own terminal
 * grade (derived from its classes, never assumed to be 12: a school's
 * structure is its own). Everything below that just states its target;
 * "Graduate" is not an option a Grade 6 class could ever need.
 *
 * Reshuffling students is its own step, right after this one.
 */
export function PlanStep({
  toYear,
  plan,
  onSaved,
}: {
  toYear: string
  plan: RolloverPlan
  onSaved: (plan: RolloverPlan) => void
}) {
  const [classes, setClasses] = useState<ContextClass[] | null>(null)
  const [error, setError] = useState("")
  const [rows, setRows] = useState<Record<string, RolloverPlanClass>>({})
  const [terminalGrade, setTerminalGrade] = useState(12)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiClient
      .get<{ active_academic_year: string | null; classes: ContextClass[] }>(
        "/api/batches/context"
      )
      .then((r) => {
        // pending = still in the old year, waiting to move — the ones this plans for
        const active = r.classes.filter((c) => c.is_pending_promotion)
        setClasses(active)

        const terminal =
          active.length > 0 ? Math.max(...active.map((c) => c.grade), 12) : 12
        setTerminalGrade(terminal)

        const saved = new Map(
          plan.plan.classes.map((c) => [c.source_class_id, c])
        )
        const initial: Record<string, RolloverPlanClass> = {}
        for (const c of active) {
          const isTerminal = c.grade >= terminal
          initial[c.id] = saved.get(c.id) ?? {
            source_class_id: c.id,
            action: isTerminal ? "graduate" : "promote",
            target: isTerminal
              ? undefined
              : {
                  grade: c.grade + 1,
                  section: c.section,
                  academic_year: toYear,
                },
          }
        }
        setRows(initial)
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load classes")
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toYear])

  const patch = (id: string, fn: (r: RolloverPlanClass) => RolloverPlanClass) =>
    setRows((prev) => ({ ...prev, [id]: fn(prev[id]) }))

  const totals = useMemo(() => {
    const list = Object.values(rows)
    return {
      promote: list.filter((r) => r.action === "promote").length,
      graduate: list.filter((r) => r.action === "graduate").length,
    }
  }, [rows])

  // Save shortly after each row change — a series of small corrections, not a
  // form to submit once.
  useEffect(() => {
    if (Object.keys(rows).length === 0) return
    const t = setTimeout(async () => {
      setSaving(true)
      try {
        const r = await apiClient.put<{ plan: RolloverPlan }>(
          "/api/rollover/plan/classes",
          { classes: Object.values(rows) }
        )
        onSaved(r.plan)
      } catch (e) {
        showError(e)
      } finally {
        setSaving(false)
      }
    }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!classes) return <Skeleton className="h-64 w-full rounded-xl" />

  const byGrade = new Map<number, ContextClass[]>()
  for (const c of classes) {
    const l = byGrade.get(c.grade) ?? []
    l.push(c)
    byGrade.set(c.grade, l)
  }
  const grades = [...byGrade.keys()].sort((a, b) => a - b)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {totals.promote} classes promote, {totals.graduate} graduate. Only
          Grade {terminalGrade} — the school's own final grade — can graduate.
        </p>
        {saving && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <CircleNotchIcon className="size-3 animate-spin" />
            Saving…
          </span>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-28 px-3 py-2 font-medium">Class</th>
              <th className="w-28 px-3 py-2 text-right font-medium">
                Students
              </th>
              <th className="w-40 px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Target section</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {grades.map((g) =>
              (byGrade.get(g) ?? [])
                .sort((a, b) => a.section.localeCompare(b.section))
                .map((c) => {
                  const row = rows[c.id]
                  if (!row) return null
                  const isGraduate = row.action === "graduate"
                  const canGraduate = c.grade >= terminalGrade
                  return (
                    <tr key={c.id}>
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        {c.grade}
                        {c.section}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                        {c.student_count}
                        {c.detained_count > 0 && (
                          <span className="ml-1 text-[11px]">
                            ({c.detained_count} detained)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {canGraduate ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              aria-pressed={!isGraduate}
                              onClick={() =>
                                patch(c.id, (r) => ({
                                  ...r,
                                  action: "promote",
                                  target: r.target ?? {
                                    grade: c.grade + 1,
                                    section: c.section,
                                    academic_year: toYear,
                                  },
                                }))
                              }
                              className={cn(
                                "rounded-md border px-2 py-1 text-xs transition-colors",
                                !isGraduate
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border text-muted-foreground hover:bg-muted"
                              )}
                            >
                              Promote
                            </button>
                            <button
                              type="button"
                              aria-pressed={isGraduate}
                              onClick={() =>
                                patch(c.id, (r) => ({
                                  ...r,
                                  action: "graduate",
                                  target: undefined,
                                }))
                              }
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                                isGraduate
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border text-muted-foreground hover:bg-muted"
                              )}
                            >
                              <GraduationCapIcon className="size-3" />
                              Graduate
                            </button>
                          </div>
                        ) : (
                          // A Grade 6 class has exactly one valid action — no
                          // choice to make, so no button pretending there is one.
                          <span className="text-xs text-muted-foreground">
                            Promotes
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {isGraduate ? (
                          <span className="text-xs text-muted-foreground">
                            Leaves the school
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">
                              Grade {row.target?.grade}
                            </span>
                            <Input
                              value={row.target?.section ?? ""}
                              onChange={(e) =>
                                patch(c.id, (r) => ({
                                  ...r,
                                  target: {
                                    grade: r.target?.grade ?? c.grade + 1,
                                    section: e.target.value
                                      .toUpperCase()
                                      .slice(0, 2),
                                    academic_year: toYear,
                                  },
                                }))
                              }
                              className="h-8 w-16 text-center text-sm"
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
