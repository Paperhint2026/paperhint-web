import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CaretDownIcon,
  CaretRightIcon,
  CircleNotchIcon,
  GraduationCapIcon,
  UsersIcon,
} from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ClassRosterPanel } from "@/modules/rollover/components/class-roster-panel"
import type {
  ContextClass,
  RolloverException,
  RolloverPlan,
  RolloverPlanClass,
} from "@/modules/rollover/lib/types"

/**
 * The whole rollover as one screen (founder, 2026-09-14): "I would rather
 * click a button, it sorts itself out, then I correct what's needed, then I
 * click another button that does the job." Not three destinations for one
 * task — one table, already filled in, that opens into a class's roster
 * right where that class sits.
 *
 * The plan arrives pre-built: every class defaults to promote, same section
 * letter, into the next grade; the school's own highest grade graduates
 * instead — derived from its classes, never assumed to be 12 (a school's
 * structure is its own; some end at 10, some run through 12).
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
  const [expanded, setExpanded] = useState<string | null>(null)
  const [exceptionsByClass, setExceptionsByClass] = useState<
    Record<string, RolloverException[]>
  >({})
  const [savingClasses, setSavingClasses] = useState(false)
  const [savingStudents, setSavingStudents] = useState(false)

  useEffect(() => {
    apiClient
      .get<{ active_academic_year: string | null; classes: ContextClass[] }>(
        "/api/batches/context"
      )
      .then((r) => {
        // pending = still in the old year, waiting to move — the ones this plans for
        const active = r.classes.filter((c) => c.is_pending_promotion)
        setClasses(active)

        // The terminal grade is whatever this school's highest grade actually
        // is, not a fixed 12 — a school with no grade-12 class yet graduates
        // its highest grade instead of promoting into a grade that doesn't exist.
        const terminalGrade =
          active.length > 0 ? Math.max(...active.map((c) => c.grade), 12) : 12

        const saved = new Map(
          plan.plan.classes.map((c) => [c.source_class_id, c])
        )
        const initial: Record<string, RolloverPlanClass> = {}
        for (const c of active) {
          const isTerminal = c.grade >= terminalGrade
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

        const exByClass: Record<string, RolloverException[]> = {}
        for (const e of plan.plan.students) {
          ;(exByClass[e.source_class_id] ??= []).push(e)
        }
        setExceptionsByClass(exByClass)
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

  const saveClasses = useCallback(
    async (next: Record<string, RolloverPlanClass>) => {
      setSavingClasses(true)
      try {
        const r = await apiClient.put<{ plan: RolloverPlan }>(
          "/api/rollover/plan/classes",
          { classes: Object.values(next) }
        )
        onSaved(r.plan)
      } catch (e) {
        showError(e)
      } finally {
        setSavingClasses(false)
      }
    },
    [onSaved]
  )

  // Save shortly after each row change — editing the plan is a series of small
  // corrections, not a form to submit once.
  useEffect(() => {
    if (Object.keys(rows).length === 0) return
    const t = setTimeout(() => saveClasses(rows), 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const saveStudents = useCallback(
    async (next: Record<string, RolloverException[]>) => {
      setSavingStudents(true)
      try {
        const all = Object.values(next).flat()
        const r = await apiClient.put<{ plan: RolloverPlan }>(
          "/api/rollover/plan/students",
          { students: all }
        )
        onSaved(r.plan)
      } catch (e) {
        showError(e)
      } finally {
        setSavingStudents(false)
      }
    },
    [onSaved]
  )

  const onExceptionsForClass = (
    sourceClassId: string,
    exceptions: RolloverException[]
  ) => {
    setExceptionsByClass((prev) => ({ ...prev, [sourceClassId]: exceptions }))
  }

  const [exceptionsLoaded, setExceptionsLoaded] = useState(false)
  useEffect(() => {
    // Skip the very first render's worth of state (the initial load from the
    // saved plan) — only edits made in this session should trigger a save.
    if (!exceptionsLoaded) {
      setExceptionsLoaded(true)
      return
    }
    const t = setTimeout(() => saveStudents(exceptionsByClass), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exceptionsByClass])

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
          {totals.promote} classes promote, {totals.graduate} graduate. Open a
          class to detain, reshuffle or withdraw a student in it — everyone else
          follows the class.
        </p>
        {(savingClasses || savingStudents) && (
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
              <th className="w-8 px-3 py-2" />
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
                  const isOpen = expanded === c.id
                  const exceptionCount = exceptionsByClass[c.id]?.length ?? 0
                  return (
                    <>
                      <tr
                        key={c.id}
                        className={cn(
                          "cursor-pointer",
                          isOpen && "bg-muted/30"
                        )}
                        onClick={() => setExpanded(isOpen ? null : c.id)}
                      >
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {isOpen ? (
                            <CaretDownIcon className="size-3.5" />
                          ) : (
                            <CaretRightIcon className="size-3.5" />
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-foreground">
                          {c.grade}
                          {c.section}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <UsersIcon className="size-3" />
                            {c.student_count}
                          </span>
                          {(c.detained_count > 0 || exceptionCount > 0) && (
                            <span className="ml-1 text-[11px]">
                              {c.detained_count > 0 &&
                                `${c.detained_count} detained`}
                              {c.detained_count > 0 &&
                                exceptionCount > 0 &&
                                " · "}
                              {exceptionCount > 0 &&
                                `${exceptionCount} exception${exceptionCount === 1 ? "" : "s"}`}
                            </span>
                          )}
                        </td>
                        <td
                          className="px-3 py-2.5"
                          onClick={(e) => e.stopPropagation()}
                        >
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
                        </td>
                        <td
                          className="px-3 py-2.5"
                          onClick={(e) => e.stopPropagation()}
                        >
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
                      {isOpen && (
                        <tr key={`${c.id}-roster`}>
                          <td colSpan={5} className="bg-muted/10 p-0">
                            <ClassRosterPanel
                              sourceClassId={c.id}
                              classAction={row.action}
                              onExceptions={onExceptionsForClass}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
