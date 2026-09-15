import { useEffect, useMemo, useState } from "react"
import {
  ArrowRightIcon,
  CaretRightIcon,
  CircleNotchIcon,
  GraduationCapIcon,
} from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ClassIdentifyPanel } from "@/modules/rollover/components/class-identify-panel"
import type {
  ContextClass,
  RolloverPlan,
  RolloverPlanClass,
} from "@/modules/rollover/lib/types"

/**
 * Step 1 of 3: which grade every class moves into, and — only where it
 * actually matters — who in it repeats instead. Pre-filled — promote to the
 * next grade, same section letter — so the only classes that show a
 * Promote/Graduate choice are the ones actually AT the school's own terminal
 * grade (derived from its classes, never assumed to be 12: a school's
 * structure is its own). Everything below that just states its target;
 * "Graduate" is not an option a Grade 6 class could ever need.
 *
 * A class list on the left, that class's own action on the right — the same
 * shape as Reshuffling, one class at a time (founder, 2026-09-15: "grade
 * promotion can also be like reshuffle, with a side panel and properties to
 * alter on the right").
 *
 * The target section is always "same letter, next grade" here and cannot be
 * edited on this screen — section is entirely Reshuffling's job, including
 * moving a whole class elsewhere (founder, 2026-09-15: this step kept
 * re-doing reshuffling's job by letting the section be changed here too).
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
  const [selected, setSelected] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<Record<string, boolean>>({})

  useEffect(() => {
    apiClient
      .get<{ active_academic_year: string | null; classes: ContextClass[] }>(
        "/api/batches/context"
      )
      .then((r) => {
        // pending = still in the old year, waiting to move — the ones this plans for
        const active = r.classes.filter((c) => c.is_pending_promotion)
        setClasses(active)
        setSelected((prev) => prev ?? active[0]?.id ?? null)

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

  const setDetainedCount = (classId: string, count: number) =>
    setClasses((prev) =>
      (prev ?? []).map((c) =>
        c.id === classId ? { ...c, detained_count: count } : c
      )
    )

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

  const current = classes.find((c) => c.id === selected) ?? null
  const currentRow = current ? rows[current.id] : null

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

      <div className="grid gap-0 overflow-hidden rounded-xl border border-border bg-background sm:grid-cols-[112px_1fr]">
        <div className="max-h-[32rem] overflow-y-auto border-b border-border sm:border-r sm:border-b-0">
          {grades.map((g) =>
            (byGrade.get(g) ?? [])
              .sort((a, b) => a.section.localeCompare(b.section))
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-1 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
                    selected === c.id
                      ? "bg-primary/10 text-foreground"
                      : "text-secondary-foreground hover:bg-muted"
                  )}
                >
                  <span className="flex items-center gap-1 font-medium">
                    {c.grade}
                    {c.section}
                    {c.detained_count > 0 && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {c.detained_count}
                      </span>
                    )}
                  </span>
                  <CaretRightIcon className="size-3 shrink-0 text-muted-foreground" />
                </button>
              ))
          )}
        </div>

        <div className="max-h-[32rem] min-w-0 overflow-y-auto">
          {current && currentRow ? (
            <ClassDetail
              key={current.id}
              cls={current}
              row={currentRow}
              canGraduate={current.grade >= terminalGrade}
              fromYear={plan.from_year}
              toYear={toYear}
              reviewing={!!reviewing[current.id] || current.detained_count > 0}
              onReview={() =>
                setReviewing((prev) => ({ ...prev, [current.id]: true }))
              }
              onPatch={(fn) => patch(current.id, fn)}
              onDetainedCountChange={(count) =>
                setDetainedCount(current.id, count)
              }
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              No classes to promote.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ClassDetail({
  cls,
  row,
  canGraduate,
  fromYear,
  toYear,
  reviewing,
  onReview,
  onPatch,
  onDetainedCountChange,
}: {
  cls: ContextClass
  row: RolloverPlanClass
  canGraduate: boolean
  fromYear: string
  toYear: string
  reviewing: boolean
  onReview: () => void
  onPatch: (fn: (r: RolloverPlanClass) => RolloverPlanClass) => void
  onDetainedCountChange: (count: number) => void
}) {
  const isGraduate = row.action === "graduate"

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Grade {cls.grade}
              {cls.section}
              <span className="ml-1.5 font-normal text-muted-foreground">
                {cls.student_count} students
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{fromYear} batch</p>
          </div>
          <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {isGraduate ? (
                "Graduates"
              ) : (
                <>
                  Grade {row.target?.grade}
                  {row.target?.section}
                </>
              )}
              <span className="ml-1.5 font-normal text-muted-foreground">
                {cls.student_count} students
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {isGraduate ? "Leaves the school" : `${toYear} batch`}
            </p>
          </div>
        </div>

        {canGraduate ? (
          <div className="flex gap-1">
            <button
              type="button"
              aria-pressed={!isGraduate}
              onClick={() =>
                onPatch((r) => ({
                  ...r,
                  action: "promote",
                  target: r.target ?? {
                    grade: cls.grade + 1,
                    section: cls.section,
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
                onPatch((r) => ({
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
          // A Grade 6 class has exactly one valid action — no choice to
          // make, so no button pretending there is one.
          <span className="text-xs text-muted-foreground">Promotes</span>
        )}
      </div>

      <div className="rounded-lg border border-border">
        {reviewing ? (
          <ClassIdentifyPanel
            sourceClassId={cls.id}
            onDetainedCountChange={onDetainedCountChange}
          />
        ) : (
          <div className="flex items-center justify-between gap-3 p-3">
            <p className="text-xs text-muted-foreground">
              Nobody detained here — everyone follows the class.
            </p>
            <Button variant="outline" size="sm" onClick={onReview}>
              Review students
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
