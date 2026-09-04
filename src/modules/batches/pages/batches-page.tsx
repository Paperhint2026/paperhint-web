import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArchiveIcon,
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  CalendarDotsIcon,
  CaretDownIcon,
  ChalkboardIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  GraduationCapIcon,
  PencilSimpleIcon,
  PlusIcon,
  UsersThreeIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { useHeaderActions } from "@/components/layout/header-actions-context"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Sticker } from "@/components/shared/sticker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ContextClass {
  id: string
  grade: number
  section: string
  academic_year: string
  student_count: number
  detained_count: number
  is_pending_promotion: boolean
}

interface ContextResponse {
  active_academic_year: string | null
  classes: ContextClass[]
}

interface TemplateSubject {
  subject_id: string
  subject_name: string
  subject_type: "core" | "elective"
  elective_group_id: string | null
  elective_group_name: string | null
}

interface DraftTeacher {
  teacher_id: string
  full_name: string
  subject_id: string | null
  subject_name: string | null
}

interface DetainedStudent {
  student_id: string
  full_name: string
  roll_number: string | number | null
}

interface PromotionSource extends Omit<ContextClass, "is_pending_promotion" | "detained_count"> {
  subjects: TemplateSubject[]
  teachers: DraftTeacher[]
  detained_students: DetainedStudent[]
  /** The old class whose config seeded this draft — the previous year's
   *  class of the TARGET grade (teachers stay with their grade). When it was
   *  a DIFFERENT section, only subjects were carried (subjects_only) — that
   *  section's teachers may not take the new one. Null = brand-new grade. */
  template_class: {
    id: string
    grade: number
    section: string
    academic_year: string
    subjects_only?: boolean
  } | null
}

interface Draft {
  source: PromotionSource
  action: "promote" | "graduate"
  targetGrade: number
  targetSection: string
  subjects: TemplateSubject[]
  teachers: DraftTeacher[]
  /** per detained student: "spec:<grade>|<SECTION>" (a class in this plan)
   *  or "id:<uuid>" (an existing next-year class) */
  detainedTargets: Record<string, string>
  edited: boolean
}

interface PastBatch {
  id: string
  grade: number
  section: string
  academic_year: string
  archived_at: string
  student_count: number
  promoted_to: { grade: number; section: string; academic_year: string } | null
  subjects: string[]
  teachers: {
    teacher_id: string
    full_name: string
    subject_name: string | null
  }[]
}

interface PastBatchStudent {
  student_id: string
  reason: string
  annual_result: string
  student: {
    id: string
    full_name: string
    roll_number?: string | number
    status: string
  } | null
}

interface TeacherOption {
  id: string
  full_name: string
}

interface SubjectOption {
  id: string
  subject_name: string
}

const classLabel = (c: {
  grade: number
  section: string
  academic_year?: string
}) =>
  `Grade ${c.grade} - ${c.section}${c.academic_year ? ` (${c.academic_year})` : ""}`

// Suggest a few next academic years using whatever format the school already
// uses (e.g. "2025-2026" -> ["2026-2027", ...]).
function deriveYearOptions(existingYears: string[]): string[] {
  const startYears = existingYears
    .map((y) => Number((y ?? "").split("-")[0]))
    .filter((n) => Number.isFinite(n) && n > 1900)

  const maxSeen = startYears.length > 0 ? Math.max(...startYears) : null
  const seed = maxSeen ?? new Date().getFullYear()

  const longFormat = existingYears.some((y) => /^\d{4}-\d{4}$/.test(y))
  const formatYear = (start: number) =>
    longFormat
      ? `${start}-${start + 1}`
      : `${start}-${String((start + 1) % 100).padStart(2, "0")}`

  return [1, 2, 3].map((offset) => formatYear(seed + offset))
}

// ─────────────────────────────────────────────────────────────────────────────
// Page shell
// ─────────────────────────────────────────────────────────────────────────────

function ViewSwitch({
  view,
  onChange,
}: {
  view: "rollover" | "past"
  onChange: (view: "rollover" | "past") => void
}) {
  const options = [
    {
      id: "rollover" as const,
      label: "Year Rollover",
      icon: ArrowsClockwiseIcon,
    },
    { id: "past" as const, label: "Past Batches", icon: ArchiveIcon },
  ]
  return (
    <div className="flex items-center gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={view === o.id}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150",
            view === o.id
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-background text-secondary-foreground hover:bg-muted"
          )}
        >
          <o.icon className="size-3.5" />
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function BatchesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  const [view, setView] = useState<"rollover" | "past">("rollover")

  if (!isAdmin) {
    return (
      <div
        className={cn(
          PAGE_GUTTER,
          PAGE_TOP,
          "flex min-h-full flex-col items-center justify-center gap-4 pb-12"
        )}
      >
        <Sticker name="unimpressed" size={96} />
        <div className="flex max-w-[320px] flex-col items-center gap-1 text-center">
          <p className="text-base font-medium text-secondary-foreground">
            Admins only
          </p>
          <p className="text-sm text-muted-foreground">
            Batch management moves whole classes between years, so it's
            reserved for your school admin.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex min-h-full flex-col gap-5 pb-12"
      )}
    >
      <PageHeader
        icon={ArchiveIcon}
        title="Batches"
        description="Promote, detain, and graduate whole classes at year end. Every move is kept as history."
      />
      <ViewSwitch view={view} onChange={setView} />
      {view === "rollover" ? <RolloverHome /> : <PastBatches />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Rollover home — year pill, pending classes, draft plan
// ─────────────────────────────────────────────────────────────────────────────

function RolloverSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-9 w-72 rounded-full" />
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="size-4 rounded" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

function RolloverHome() {
  const { setHeaderActions } = useHeaderActions()

  const [context, setContext] = useState<ContextResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const [switchOpen, setSwitchOpen] = useState(false)
  const [newClassOpen, setNewClassOpen] = useState(false)

  // pending-class selection (before drafting)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // the draft plan; null = not generated yet
  const [drafts, setDrafts] = useState<Record<string, Draft> | null>(null)
  const [isDrafting, setIsDrafting] = useState(false)
  const [editDraftId, setEditDraftId] = useState<string | null>(null)

  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [subjectCatalog, setSubjectCatalog] = useState<SubjectOption[]>([])

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [done, setDone] = useState<Record<string, number> | null>(null)

  const fetchContext = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const res = await apiClient.get<ContextResponse>("/api/batches/context")
      setContext(res)
      setSelectedIds(
        new Set(
          (res.classes ?? [])
            .filter((c) => c.is_pending_promotion)
            .map((c) => c.id)
        )
      )
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContext()
  }, [fetchContext])

  useEffect(() => {
    setHeaderActions(
      <Button
        size="lg"
        variant="outline"
        className="rounded-full"
        onClick={() => setNewClassOpen(true)}
      >
        <PlusIcon className="size-3.5" />
        <span className="hidden sm:inline">New class</span>
      </Button>
    )
    return () => setHeaderActions(null)
  }, [setHeaderActions])

  const activeYear = context?.active_academic_year ?? null
  const classes = useMemo(() => context?.classes ?? [], [context])
  const pending = useMemo(
    () => classes.filter((c) => c.is_pending_promotion),
    [classes]
  )
  const currentClasses = useMemo(
    () => classes.filter((c) => !c.is_pending_promotion),
    [classes]
  )

  // ── draft generation ────────────────────────────────────────────────────────

  const buildDrafts = async () => {
    if (!activeYear) return
    setIsDrafting(true)
    try {
      const [draftRes, teachersRes, subjectsRes] = await Promise.all([
        apiClient.get<{ classes: PromotionSource[] }>(
          "/api/batches/promotion-draft"
        ),
        apiClient
          .get<{ teachers: TeacherOption[] }>("/api/auth/teachers")
          .catch(() => ({ teachers: [] })),
        apiClient
          .get<{ subjects: SubjectOption[] }>("/api/subjects")
          .catch(() => ({ subjects: [] })),
      ])
      setTeachers(teachersRes.teachers ?? [])
      setSubjectCatalog(subjectsRes.subjects ?? [])

      const next: Record<string, Draft> = {}
      for (const src of draftRes.classes ?? []) {
        if (!selectedIds.has(src.id)) continue
        const graduate = src.grade >= 12
        next[src.id] = {
          source: src,
          action: graduate ? "graduate" : "promote",
          targetGrade: graduate ? src.grade : src.grade + 1,
          targetSection: src.section,
          subjects: [...src.subjects],
          teachers: [...src.teachers],
          detainedTargets: {},
          edited: false,
        }
      }
      setDone(null)
      setDrafts(next)
    } catch (err) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setIsDrafting(false)
    }
  }

  // Detained students repeat their CURRENT grade in the new year. Options:
  // targets in this plan with that grade + existing next-year classes.
  const detainedOptionsFor = useCallback(
    (sourceGrade: number): { value: string; label: string }[] => {
      if (!drafts || !activeYear) return []
      const options: { value: string; label: string }[] = []
      const seen = new Set<string>()
      for (const d of Object.values(drafts)) {
        if (d.action !== "promote" || d.targetGrade !== sourceGrade) continue
        const key = `spec:${d.targetGrade}|${d.targetSection.toUpperCase()}`
        if (seen.has(key)) continue
        seen.add(key)
        options.push({
          value: key,
          label: `Grade ${d.targetGrade} - ${d.targetSection.toUpperCase()} (${activeYear}) — new`,
        })
      }
      for (const c of currentClasses) {
        if (c.grade !== sourceGrade || c.academic_year !== activeYear) continue
        options.push({ value: `id:${c.id}`, label: classLabel(c) })
      }
      return options
    },
    [drafts, activeYear, currentClasses]
  )

  const unresolvedDetainedCount = useMemo(() => {
    if (!drafts) return 0
    let count = 0
    for (const d of Object.values(drafts)) {
      for (const s of d.source.detained_students) {
        if (!d.detainedTargets[s.student_id]) count += 1
      }
    }
    return count
  }, [drafts])

  const draftSummary = useMemo(() => {
    if (!drafts) return null
    let promote = 0
    let repeat = 0
    let graduate = 0
    for (const d of Object.values(drafts)) {
      const rest = d.source.student_count - d.source.detained_students.length
      if (d.action === "graduate") graduate += rest
      else promote += rest
      // detained students count by the admin's actual choice
      for (const s of d.source.detained_students) {
        const choice = d.detainedTargets[s.student_id]
        if (choice === "promote") {
          if (d.action === "graduate") graduate += 1
          else promote += 1
        } else {
          repeat += 1 // chosen repeat target, or still unresolved
        }
      }
    }
    return {
      classes: Object.keys(drafts).length,
      promote,
      repeat,
      graduate,
    }
  }, [drafts])

  const runExecute = async () => {
    if (!drafts || !activeYear) return
    setIsExecuting(true)
    try {
      const plan = Object.values(drafts).map((d) => ({
        source_class_id: d.source.id,
        action: d.action,
        ...(d.action === "promote"
          ? {
              target: {
                grade: d.targetGrade,
                section: d.targetSection.toUpperCase(),
                academic_year: activeYear,
                subjects: d.subjects,
                teacher_assignments: d.teachers
                  .filter((t) => t.subject_id)
                  .map((t) => ({
                    teacher_id: t.teacher_id,
                    subject_id: t.subject_id,
                  })),
              },
            }
          : {}),
        detained_moves: d.source.detained_students.map((s) => {
          const v = d.detainedTargets[s.student_id]
          if (v === "promote") {
            // admin overrides the detain mark — moves with the class
            return { student_id: s.student_id, promote: true }
          }
          if (v?.startsWith("id:")) {
            return { student_id: s.student_id, target_class_id: v.slice(3) }
          }
          const [g, sec] = (v ?? "").slice(5).split("|")
          return {
            student_id: s.student_id,
            target_grade: Number(g),
            target_section: sec,
            target_academic_year: activeYear,
          }
        }),
      }))

      const res = await apiClient.post<{ result: Record<string, number> }>(
        "/api/batches/rollover/execute-plan",
        { plan }
      )
      setDone(res.result)
      setDrafts(null)
      toast.success("Rollover completed")
      await fetchContext()
    } catch (err) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setIsExecuting(false)
      setConfirmOpen(false)
    }
  }

  const togglePending = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <LoadingSwap
      loading={isLoading}
      skeleton={<RolloverSkeleton />}
      className="flex-1"
    >
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
          <Sticker name="worried" size={88} />
          <div className="flex max-w-[360px] flex-col items-center gap-1 text-center">
            <p className="text-base font-medium text-secondary-foreground">
              Couldn't load your classes
            </p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" onClick={fetchContext}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* School year pill + switch */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-sidebar px-3 py-1.5 text-xs font-medium text-secondary-foreground ring-1 ring-border/60">
              <CalendarDotsIcon className="size-3.5 text-muted-foreground" />
              School year:{" "}
              <span className="text-foreground">
                {activeYear ?? "not set"}
              </span>
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full text-xs"
              onClick={() => setSwitchOpen(true)}
            >
              <ArrowsClockwiseIcon className="size-3.5" />
              Start new academic year…
            </Button>
          </div>

          {done && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3.5">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CheckCircleIcon
                  weight="fill"
                  className="size-4.5 text-primary"
                />
                Rollover completed
              </div>
              <p className="text-xs text-muted-foreground">
                {done.moved ?? 0} students moved · {done.graduated ?? 0}{" "}
                graduated · {done.classes_created ?? 0} classes created ·{" "}
                {done.classes_archived ?? 0} archived ·{" "}
                {done.teacher_assignments_ended ?? 0} teacher assignments ended
              </p>
            </div>
          )}

          {!activeYear ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-background px-5 py-10 text-center">
              <Sticker name="idea" size={96} />
              <div className="flex max-w-[380px] flex-col gap-1">
                <p className="text-base font-medium text-secondary-foreground">
                  Set your school's academic year
                </p>
                <p className="text-sm text-muted-foreground">
                  The rollover works off the school year. Set it once and the
                  system knows which classes are current and which are due for
                  promotion.
                </p>
              </div>
              <Button onClick={() => setSwitchOpen(true)}>
                Set academic year
              </Button>
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-background px-5 py-10 text-center">
              <Sticker name="happy" size={96} />
              <div className="flex max-w-[400px] flex-col gap-1">
                <p className="text-base font-medium text-secondary-foreground">
                  Everything is current
                </p>
                <p className="text-sm text-muted-foreground">
                  All {currentClasses.length} active classes are in {activeYear}
                  . When the year ends, switch to the next academic year and
                  the promotion plan will appear here.
                </p>
              </div>
            </div>
          ) : drafts ? (
            <DraftPlan
              drafts={drafts}
              activeYear={activeYear}
              detainedOptionsFor={detainedOptionsFor}
              unresolvedCount={unresolvedDetainedCount}
              summary={draftSummary!}
              isExecuting={isExecuting}
              onEdit={(id) => setEditDraftId(id)}
              onDetainedTarget={(draftId, studentId, value) =>
                setDrafts((prev) =>
                  prev
                    ? {
                        ...prev,
                        [draftId]: {
                          ...prev[draftId],
                          detainedTargets: {
                            ...prev[draftId].detainedTargets,
                            [studentId]: value,
                          },
                        },
                      }
                    : prev
                )
              }
              onDiscard={() => setDrafts(null)}
              onSave={() => setConfirmOpen(true)}
            />
          ) : (
            <section className="flex flex-col gap-3">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {pending.length} class{pending.length === 1 ? "" : "es"}{" "}
                    from the previous year
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Pick which classes to promote into {activeYear}, then
                    review the auto-built plan before anything is saved.
                  </p>
                </div>
                <Button
                  onClick={buildDrafts}
                  disabled={isDrafting || selectedIds.size === 0}
                >
                  {isDrafting ? (
                    <>
                      <CircleNotchIcon className="size-3.5 animate-spin" />
                      Building plan…
                    </>
                  ) : (
                    <>
                      <ArrowsClockwiseIcon className="size-3.5" />
                      Promote {selectedIds.size} class
                      {selectedIds.size === 1 ? "" : "es"}
                    </>
                  )}
                </Button>
              </header>

              <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
                {pending.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={selectedIds.has(c.id)}
                      onCheckedChange={() => togglePending(c.id)}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium text-secondary-foreground">
                        {classLabel(c)}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <UsersThreeIcon className="size-3.5" />
                        {c.student_count} student
                        {c.student_count === 1 ? "" : "s"}
                        {c.detained_count > 0 && (
                          <Badge
                            variant="secondary"
                            className="rounded-full bg-amber-100 px-1.5 py-0 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          >
                            {c.detained_count} detained
                          </Badge>
                        )}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ArrowRightIcon className="size-3" />
                      {c.grade >= 12
                        ? "Graduates"
                        : `Grade ${c.grade + 1} - ${c.section} (${activeYear})`}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <SwitchYearDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        currentYear={activeYear}
        existingYears={classes.map((c) => c.academic_year)}
        onSwitched={() => {
          setDrafts(null)
          fetchContext()
        }}
      />

      <NewClassDialog
        open={newClassOpen}
        onOpenChange={setNewClassOpen}
        onCreated={fetchContext}
        existingYears={classes.map((c) => c.academic_year)}
        activeClasses={classes}
      />

      {drafts && editDraftId && drafts[editDraftId] && (
        <DraftEditDialog
          draft={drafts[editDraftId]}
          activeYear={activeYear ?? ""}
          teachers={teachers}
          subjectCatalog={subjectCatalog}
          onClose={() => setEditDraftId(null)}
          onSave={(updated) => {
            setDrafts((prev) =>
              prev ? { ...prev, [editDraftId]: updated } : prev
            )
            setEditDraftId(null)
          }}
        />
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save rollover?</AlertDialogTitle>
            <AlertDialogDescription>
              {draftSummary
                ? `${draftSummary.classes} classes will move to ${activeYear}: ${draftSummary.promote} students promoted, ${draftSummary.repeat} repeating a grade, ${draftSummary.graduate} graduated.`
                : ""}{" "}
              Previous-year classes are archived into Past Batches and their
              teacher assignments end. This runs as one transaction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExecuting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isExecuting}
              onClick={(e) => {
                e.preventDefault()
                runExecute()
              }}
            >
              {isExecuting ? (
                <>
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                  Running…
                </>
              ) : (
                "Confirm rollover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LoadingSwap>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// The reviewed draft plan
// ─────────────────────────────────────────────────────────────────────────────

function DraftPlan({
  drafts,
  activeYear,
  detainedOptionsFor,
  unresolvedCount,
  summary,
  isExecuting,
  onEdit,
  onDetainedTarget,
  onDiscard,
  onSave,
}: {
  drafts: Record<string, Draft>
  activeYear: string
  detainedOptionsFor: (grade: number) => { value: string; label: string }[]
  unresolvedCount: number
  summary: { classes: number; promote: number; repeat: number; graduate: number }
  isExecuting: boolean
  onEdit: (draftId: string) => void
  onDetainedTarget: (draftId: string, studentId: string, value: string) => void
  onDiscard: () => void
  onSave: () => void
}) {
  const list = Object.values(drafts).sort(
    (a, b) =>
      a.source.grade - b.source.grade ||
      a.source.section.localeCompare(b.source.section)
  )

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Review the promotion plan
          </h3>
          <p className="text-xs text-muted-foreground">
            Nothing is saved yet. Edit any class, resolve detained students,
            then save the rollover.
          </p>
        </div>
        <button
          type="button"
          onClick={onDiscard}
          className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Discard draft
        </button>
      </header>

      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
        {list.map((d) => {
          const unresolved = d.source.detained_students.filter(
            (s) => !d.detainedTargets[s.student_id]
          ).length
          return (
            <div
              key={d.source.id}
              className="flex flex-col rounded-xl border border-border bg-background"
            >
              <div className="flex items-start justify-between gap-2 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-secondary-foreground">
                    <ChalkboardIcon className="size-4 text-muted-foreground" />
                    {classLabel(d.source)}
                    <ArrowRightIcon className="size-3 text-muted-foreground" />
                    {d.action === "graduate" ? (
                      <span className="inline-flex items-center gap-1">
                        <GraduationCapIcon className="size-4" />
                        Graduates
                      </span>
                    ) : (
                      `Grade ${d.targetGrade} - ${d.targetSection.toUpperCase()} (${activeYear})`
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {d.source.student_count} students
                    {d.action === "promote" &&
                      ` · ${d.subjects.length} subjects · ${d.teachers.length} teachers`}
                    {d.source.detained_students.length > 0 &&
                      ` · ${d.source.detained_students.length} detained`}
                  </span>
                  {d.action === "promote" &&
                    (d.source.template_class ? (
                      !d.edited &&
                      (d.source.template_class.subjects_only ? (
                        <span className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                          <WarningIcon className="size-3" />
                          New section — subjects from{" "}
                          {classLabel(d.source.template_class)}; assign
                          teachers in Edit or later.
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/70">
                          Subjects & teachers from{" "}
                          {classLabel(d.source.template_class)}
                        </span>
                      ))
                    ) : d.subjects.length === 0 ? (
                      <span className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                        <WarningIcon className="size-3" />
                        Grade {d.targetGrade} is new for your school — add
                        subjects & teachers in Edit, or configure the class
                        later.
                      </span>
                    ) : null)}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {d.edited && (
                    <Badge
                      variant="secondary"
                      className="rounded-full px-1.5 py-0 text-[10px]"
                    >
                      edited
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEdit(d.source.id)}
                    aria-label={`Edit ${classLabel(d.source)}`}
                  >
                    <PencilSimpleIcon className="size-4" />
                  </Button>
                </div>
              </div>

              {d.source.detained_students.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-dashed border-border px-4 py-3">
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium",
                      unresolved > 0
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {unresolved > 0 && <WarningIcon className="size-3.5" />}
                    Detained students — promote anyway, or repeat Grade{" "}
                    {d.source.grade}:
                  </p>
                  {d.source.detained_students.map((s) => {
                    const repeatOptions = detainedOptionsFor(d.source.grade)
                    const promoteLabel =
                      d.action === "graduate"
                        ? "Graduate with class"
                        : `Promote with class → Grade ${d.targetGrade} - ${d.targetSection.toUpperCase()}`
                    return (
                      <div
                        key={s.student_id}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span className="min-w-32 text-xs font-medium text-secondary-foreground">
                          {s.full_name}
                          {s.roll_number != null && (
                            <span className="ml-1 text-muted-foreground">
                              #{s.roll_number}
                            </span>
                          )}
                        </span>
                        <ArrowRightIcon className="size-3 text-muted-foreground" />
                        <Select
                          value={d.detainedTargets[s.student_id] || undefined}
                          onValueChange={(v) =>
                            onDetainedTarget(d.source.id, s.student_id, v)
                          }
                        >
                          <SelectTrigger className="h-7 w-64 text-xs">
                            <SelectValue placeholder="Promote or repeat…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="promote">
                              {promoteLabel}
                            </SelectItem>
                            {repeatOptions.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                Repeat in {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {repeatOptions.length === 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            (to repeat, create a Grade {d.source.grade} class in{" "}
                            {activeYear} with "New class")
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {summary.classes} classes → {activeYear}
          </span>{" "}
          · {summary.promote} promote · {summary.repeat} repeat ·{" "}
          {summary.graduate} graduate
          {unresolvedCount > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <WarningIcon className="size-3.5" />
              {unresolvedCount} detained student
              {unresolvedCount === 1 ? "" : "s"} unresolved
            </span>
          )}
        </p>
        <Button onClick={onSave} disabled={isExecuting || unresolvedCount > 0}>
          Save rollover
        </Button>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft edit dialog — subjects, teachers, target, action
// ─────────────────────────────────────────────────────────────────────────────

function DraftEditDialog({
  draft,
  activeYear,
  teachers,
  subjectCatalog,
  onClose,
  onSave,
}: {
  draft: Draft
  activeYear: string
  teachers: TeacherOption[]
  subjectCatalog: SubjectOption[]
  onClose: () => void
  onSave: (draft: Draft) => void
}) {
  const [action, setAction] = useState<Draft["action"]>(draft.action)
  // Target is fixed by the plan (next grade, same section) — display only.
  const targetGrade = String(draft.targetGrade)
  const targetSection = draft.targetSection
  const [subjects, setSubjects] = useState<TemplateSubject[]>(draft.subjects)
  const [kept, setKept] = useState<DraftTeacher[]>(draft.teachers)

  // "assign teacher" row
  const [assignSubject, setAssignSubject] = useState("")
  const [assignTeacher, setAssignTeacher] = useState("")

  // "add subject" row
  const [addSubjectId, setAddSubjectId] = useState("")

  const removeSubject = (subjectId: string) => {
    setSubjects((prev) => prev.filter((s) => s.subject_id !== subjectId))
    setKept((prev) => prev.filter((t) => t.subject_id !== subjectId))
  }

  const addSubject = () => {
    if (!addSubjectId) return
    const cat = subjectCatalog.find((s) => s.id === addSubjectId)
    if (!cat || subjects.some((s) => s.subject_id === cat.id)) return
    setSubjects((prev) => [
      ...prev,
      {
        subject_id: cat.id,
        subject_name: cat.subject_name,
        subject_type: "core",
        elective_group_id: null,
        elective_group_name: null,
      },
    ])
    setAddSubjectId("")
  }

  const removeTeacher = (teacherId: string, subjectId: string | null) => {
    setKept((prev) =>
      prev.filter(
        (t) => !(t.teacher_id === teacherId && t.subject_id === subjectId)
      )
    )
  }

  const assign = () => {
    if (!assignSubject || !assignTeacher) return
    const subject = subjects.find((s) => s.subject_id === assignSubject)
    const teacher = teachers.find((t) => t.id === assignTeacher)
    if (!subject || !teacher) return
    if (
      kept.some(
        (t) => t.teacher_id === teacher.id && t.subject_id === subject.subject_id
      )
    ) {
      toast.info("Already assigned")
      return
    }
    setKept((prev) => [
      ...prev,
      {
        teacher_id: teacher.id,
        full_name: teacher.full_name,
        subject_id: subject.subject_id,
        subject_name: subject.subject_name,
      },
    ])
    setAssignSubject("")
    setAssignTeacher("")
  }

  const save = () => {
    const section = targetSection.trim().toUpperCase()
    if (action === "promote" && (!targetGrade || !section)) {
      toast.error("Target grade and section are required")
      return
    }
    onSave({
      ...draft,
      action,
      targetGrade: Number(targetGrade),
      targetSection: section,
      subjects,
      teachers: kept,
      edited: true,
    })
  }

  const addableSubjects = subjectCatalog.filter(
    (c) => !subjects.some((s) => s.subject_id === c.id)
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit {classLabel(draft.source)}</DialogTitle>
          <DialogDescription>
            Changes apply to this draft only — nothing is saved until you run
            the rollover.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
          {/* action */}
          <div className="flex items-center gap-1.5">
            {(["promote", "graduate"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAction(a)}
                aria-pressed={action === a}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-all",
                  action === a
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background text-secondary-foreground hover:bg-muted"
                )}
              >
                {a === "graduate" && <GraduationCapIcon className="size-3.5" />}
                {a}
              </button>
            ))}
          </div>

          {action === "promote" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Target grade</Label>
                  <Input value={`Grade ${targetGrade}`} disabled />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Target section</Label>
                  <Input value={targetSection.toUpperCase()} disabled />
                </div>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                Fixed: the next grade, same section, in {activeYear}. Only
                subjects and teachers are editable here.
              </p>

              {/* subjects */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Subjects ({subjects.length})</Label>
                <div className="flex flex-wrap gap-1.5">
                  {subjects.map((s) => (
                    <span
                      key={s.subject_id}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-secondary-foreground"
                    >
                      {s.subject_name}
                      {s.subject_type === "elective" && (
                        <span className="text-[10px] text-muted-foreground">
                          · {s.elective_group_name || "elective"}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeSubject(s.subject_id)}
                        className="ml-0.5 text-muted-foreground transition-colors hover:text-destructive"
                        aria-label={`Remove ${s.subject_name}`}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
                {addableSubjects.length > 0 && (
                  <div className="mt-1 flex items-center gap-2">
                    <Select
                      value={addSubjectId || undefined}
                      onValueChange={setAddSubjectId}
                    >
                      <SelectTrigger className="h-8 w-56 text-xs">
                        <SelectValue placeholder="Add a subject…" />
                      </SelectTrigger>
                      <SelectContent>
                        {addableSubjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.subject_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={addSubject}
                      disabled={!addSubjectId}
                    >
                      <PlusIcon className="size-3" />
                      Add
                    </Button>
                  </div>
                )}
              </div>

              {/* teachers */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Teachers ({kept.length})</Label>
                {kept.length === 0 ? (
                  <p className="text-xs text-muted-foreground/70">
                    No teachers carried over — assign below, or later from the
                    Teachers page.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {kept.map((t) => (
                      <span
                        key={`${t.teacher_id}-${t.subject_id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-secondary-foreground"
                      >
                        {t.full_name}
                        {t.subject_name && (
                          <span className="text-[10px] text-muted-foreground">
                            · {t.subject_name}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            removeTeacher(t.teacher_id, t.subject_id)
                          }
                          className="ml-0.5 text-muted-foreground transition-colors hover:text-destructive"
                          aria-label={`Remove ${t.full_name}`}
                        >
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Select
                    value={assignSubject || undefined}
                    onValueChange={setAssignSubject}
                  >
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue placeholder="Subject…" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.subject_id} value={s.subject_id}>
                          {s.subject_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={assignTeacher || undefined}
                    onValueChange={setAssignTeacher}
                  >
                    <SelectTrigger className="h-8 w-48 text-xs">
                      <SelectValue placeholder="Teacher…" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={assign}
                    disabled={!assignSubject || !assignTeacher}
                  >
                    <PlusIcon className="size-3" />
                    Assign
                  </Button>
                </div>
              </div>
            </>
          )}

          {action === "graduate" && (
            <p className="rounded-lg border border-border bg-sidebar/50 px-3 py-2.5 text-xs text-muted-foreground">
              This batch passes out of school: students are marked graduated,
              keep all their records, and the class is archived. Detained
              students still repeat their grade — resolve them on the card.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Switch year dialog
// ─────────────────────────────────────────────────────────────────────────────

function SwitchYearDialog({
  open,
  onOpenChange,
  currentYear,
  existingYears,
  onSwitched,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentYear: string | null
  existingYears: string[]
  onSwitched: () => void
}) {
  const options = useMemo(() => {
    const derived = deriveYearOptions(
      existingYears.length > 0
        ? existingYears
        : currentYear
          ? [currentYear]
          : []
    )
    // allow re-selecting the current year's shape too (switch back)
    return currentYear && !derived.includes(currentYear)
      ? [currentYear, ...derived]
      : derived
  }, [existingYears, currentYear])

  const defaultYear =
    options.find((o) => o !== currentYear) ?? options[0] ?? ""
  const [year, setYear] = useState(defaultYear)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) setYear(defaultYear)
  }, [open, defaultYear])

  const save = async () => {
    if (!year) return
    setIsSaving(true)
    try {
      await apiClient.post("/api/batches/switch-year", { academic_year: year })
      toast.success(`School year set to ${year}`)
      onOpenChange(false)
      onSwitched()
    } catch (err) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {currentYear ? "Start a new academic year" : "Set the academic year"}
          </DialogTitle>
          <DialogDescription>
            {currentYear
              ? `Classes of ${currentYear} become the previous batch. Nothing moves yet — you'll promote them in the next step, and you can switch back until a rollover is saved.`
              : "This tells the system which year your school is operating in."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 px-6 py-4">
          <Label className="text-xs">Academic year</Label>
          <Select value={year || undefined} onValueChange={setYear}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                  {y === currentYear ? " (current)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={isSaving || !year || year === currentYear}>
            {isSaving ? (
              <>
                <CircleNotchIcon className="size-3.5 animate-spin" />
                Switching…
              </>
            ) : (
              "Switch year"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// New class dialog — manual escape hatch (splits, extra sections)
// ─────────────────────────────────────────────────────────────────────────────

interface ClassTemplateResponse {
  source_class: {
    id: string
    grade: number
    section: string
    academic_year: string
  } | null
  subjects: TemplateSubject[]
  teachers: DraftTeacher[]
}

const NEW_SECTION = "__new__"

function NewClassDialog({
  open,
  onOpenChange,
  onCreated,
  existingYears,
  activeClasses,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  existingYears: string[]
  activeClasses: ContextClass[]
}) {
  const yearOptions = useMemo(
    () => deriveYearOptions(existingYears),
    [existingYears]
  )

  const [grade, setGrade] = useState("")
  const [sectionChoice, setSectionChoice] = useState("")
  const [customSection, setCustomSection] = useState("")
  const [year, setYear] = useState<string>(yearOptions[0] ?? "")
  const [isSaving, setIsSaving] = useState(false)

  const [template, setTemplate] = useState<ClassTemplateResponse | null>(null)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  const [keptSubjects, setKeptSubjects] = useState<TemplateSubject[]>([])
  const [keptTeachers, setKeptTeachers] = useState<DraftTeacher[]>([])

  const section =
    sectionChoice === NEW_SECTION
      ? customSection.trim().toUpperCase()
      : sectionChoice

  const sectionOptions = useMemo(() => {
    if (!grade) return []
    return [
      ...new Set(
        activeClasses
          .filter((c) => String(c.grade) === grade)
          .map((c) => c.section)
      ),
    ].sort()
  }, [activeClasses, grade])

  useEffect(() => {
    if (open) {
      setYear(yearOptions[0] ?? "")
      setGrade("")
      setSectionChoice("")
      setCustomSection("")
      setTemplate(null)
      setKeptSubjects([])
      setKeptTeachers([])
    }
  }, [open, yearOptions])

  useEffect(() => {
    setSectionChoice("")
    setCustomSection("")
    setTemplate(null)
  }, [grade])

  useEffect(() => {
    if (!open || !grade || !section) {
      setTemplate(null)
      setKeptSubjects([])
      setKeptTeachers([])
      setIsLoadingTemplate(false)
      return
    }
    let cancelled = false
    setIsLoadingTemplate(true)
    apiClient
      .get<ClassTemplateResponse>(
        `/api/batches/class-template?grade=${encodeURIComponent(grade)}&section=${encodeURIComponent(section)}`
      )
      .then((res) => {
        if (cancelled) return
        setTemplate(res)
        setKeptSubjects(res.subjects)
        setKeptTeachers(res.teachers)
      })
      .catch(() => {
        if (!cancelled)
          setTemplate({ source_class: null, subjects: [], teachers: [] })
      })
      .finally(() => {
        setIsLoadingTemplate(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, grade, section])

  const removeSubject = (subjectId: string) => {
    setKeptSubjects((prev) => prev.filter((s) => s.subject_id !== subjectId))
    setKeptTeachers((prev) => prev.filter((t) => t.subject_id !== subjectId))
  }

  const removeTeacher = (teacherId: string, subjectId: string | null) => {
    setKeptTeachers((prev) =>
      prev.filter(
        (t) => !(t.teacher_id === teacherId && t.subject_id === subjectId)
      )
    )
  }

  const create = async (withCarryOver: boolean) => {
    if (!grade || !section || !year) {
      toast.error("Grade, section, and academic year are required")
      return
    }
    setIsSaving(true)
    try {
      const res = await apiClient.post<{
        subjects_created: number
        teachers_assigned: number
      }>("/api/batches/prepare-class", {
        grade: Number(grade),
        section,
        academic_year: year.trim(),
        subjects: withCarryOver ? keptSubjects : [],
        teacher_assignments: withCarryOver
          ? keptTeachers
              .filter((t) => t.subject_id)
              .map((t) => ({
                teacher_id: t.teacher_id,
                subject_id: t.subject_id,
              }))
          : [],
      })
      const parts = [`Grade ${grade} - ${section} created`]
      if (res.subjects_created > 0)
        parts.push(`${res.subjects_created} subjects`)
      if (res.teachers_assigned > 0)
        parts.push(`${res.teachers_assigned} teachers assigned`)
      toast.success(parts.join(" · "))
      onOpenChange(false)
      onCreated()
    } catch (err) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const hasTemplate = !!template?.source_class
  const carryCount = keptSubjects.length + keptTeachers.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New class</DialogTitle>
          <DialogDescription>
            For extra sections or splits the automatic plan can't cover.
            Subjects and teachers from the current year's class are carried
            over unless you remove them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Grade</Label>
              <Select value={grade || undefined} onValueChange={setGrade}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(
                    (g) => (
                      <SelectItem key={g} value={g}>
                        Grade {g}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Section</Label>
              <Select
                value={sectionChoice || undefined}
                onValueChange={setSectionChoice}
                disabled={!grade}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={grade ? "Select…" : "Pick grade first"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {sectionOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      Section {s}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_SECTION}>
                    <span className="inline-flex items-center gap-1">
                      <PlusIcon className="size-3" />
                      New section…
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {sectionChoice === NEW_SECTION && (
                <Input
                  autoFocus
                  value={customSection}
                  onChange={(e) => setCustomSection(e.target.value)}
                  placeholder="e.g. C"
                  maxLength={3}
                  className="mt-1"
                />
              )}
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label className="text-xs">Academic year</Label>
              <Select value={year || undefined} onValueChange={setYear}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y, i) => (
                    <SelectItem key={y} value={y}>
                      {y}
                      {i === 0 ? " (next year)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoadingTemplate && (
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs text-muted-foreground">
              <CircleNotchIcon className="size-3.5 animate-spin" />
              Looking up the current Grade {grade} - {section} class…
            </div>
          )}

          {!isLoadingTemplate && template && hasTemplate && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-sidebar/50 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">
                Carried over from{" "}
                <span className="font-medium text-foreground">
                  Grade {template.source_class!.grade} -{" "}
                  {template.source_class!.section} (
                  {template.source_class!.academic_year})
                </span>
                . Remove anything that changes next year.
              </p>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">
                  Subjects ({keptSubjects.length})
                </Label>
                {keptSubjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground/70">
                    No subjects — the class will be created empty; add subjects
                    later from the class editor.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {keptSubjects.map((s) => (
                      <span
                        key={s.subject_id}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-secondary-foreground"
                      >
                        {s.subject_name}
                        {s.subject_type === "elective" && (
                          <span className="text-[10px] text-muted-foreground">
                            · {s.elective_group_name || "elective"}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeSubject(s.subject_id)}
                          className="ml-0.5 text-muted-foreground transition-colors hover:text-destructive"
                          aria-label={`Remove ${s.subject_name}`}
                        >
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">
                  Teachers ({keptTeachers.length})
                </Label>
                {keptTeachers.length === 0 ? (
                  <p className="text-xs text-muted-foreground/70">
                    No teachers carried over — assign them later from the
                    Teachers page.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {keptTeachers.map((t) => (
                      <span
                        key={`${t.teacher_id}-${t.subject_id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-secondary-foreground"
                      >
                        {t.full_name}
                        {t.subject_name && (
                          <span className="text-[10px] text-muted-foreground">
                            · {t.subject_name}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            removeTeacher(t.teacher_id, t.subject_id)
                          }
                          className="ml-0.5 text-muted-foreground transition-colors hover:text-destructive"
                          aria-label={`Remove ${t.full_name}`}
                        >
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!isLoadingTemplate && template && !hasTemplate && section && (
            <div className="rounded-lg border border-border px-3 py-2.5 text-xs text-muted-foreground">
              No current Grade {grade} - {section} class to copy from. The
              class will be created empty — add subjects from the class editor
              afterwards.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          {hasTemplate && (
            <Button
              variant="outline"
              onClick={() => create(false)}
              disabled={isSaving || !grade || !section || !year}
            >
              Create empty class
            </Button>
          )}
          <Button
            onClick={() => create(true)}
            disabled={isSaving || !grade || !section || !year}
          >
            {isSaving ? (
              <>
                <CircleNotchIcon className="size-3.5 animate-spin" />
                Creating…
              </>
            ) : hasTemplate && carryCount > 0 ? (
              "Create with carry-over"
            ) : (
              "Create class"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Past batches
// ─────────────────────────────────────────────────────────────────────────────

function PastBatchesSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3.5"
        >
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

function PastBatches() {
  const [batches, setBatches] = useState<PastBatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [students, setStudents] = useState<Record<string, PastBatchStudent[]>>(
    {}
  )
  const [loadingStudents, setLoadingStudents] = useState<string | null>(null)
  const [yearFilter, setYearFilter] = useState<string>("all")

  const yearOptions = useMemo(
    () =>
      [...new Set(batches.map((b) => b.academic_year))].sort((a, b) =>
        b.localeCompare(a)
      ),
    [batches]
  )

  // year -> batches, newest year first
  const grouped = useMemo(() => {
    const filtered =
      yearFilter === "all"
        ? batches
        : batches.filter((b) => b.academic_year === yearFilter)
    const byYear = new Map<string, PastBatch[]>()
    for (const b of filtered) {
      if (!byYear.has(b.academic_year)) byYear.set(b.academic_year, [])
      byYear.get(b.academic_year)!.push(b)
    }
    return [...byYear.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, list]) => ({
        year,
        batches: list.sort(
          (a, b) => a.grade - b.grade || a.section.localeCompare(b.section)
        ),
      }))
  }, [batches, yearFilter])

  const fetchBatches = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const res = await apiClient.get<{ batches: PastBatch[] }>(
        "/api/batches/past"
      )
      setBatches(res.batches ?? [])
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  const toggleExpand = async (classId: string) => {
    if (expanded === classId) {
      setExpanded(null)
      return
    }
    setExpanded(classId)
    if (!students[classId]) {
      setLoadingStudents(classId)
      try {
        const res = await apiClient.get<{ students: PastBatchStudent[] }>(
          `/api/batches/past/${classId}/students`
        )
        setStudents((prev) => ({ ...prev, [classId]: res.students ?? [] }))
      } catch (err) {
        if (err instanceof Error) toast.error(err.message)
      } finally {
        setLoadingStudents(null)
      }
    }
  }

  return (
    <LoadingSwap
      loading={isLoading}
      skeleton={<PastBatchesSkeleton />}
      className="flex-1"
    >
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
          <Sticker name="worried" size={88} />
          <div className="flex max-w-[360px] flex-col items-center gap-1 text-center">
            <p className="text-base font-medium text-secondary-foreground">
              Couldn't load past batches
            </p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" onClick={fetchBatches}>
            Try again
          </Button>
        </div>
      ) : batches.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-5">
          <Sticker name="cloud" size={110} />
          <div className="flex max-w-[380px] flex-col items-center gap-1 text-center">
            <p className="text-base font-medium text-secondary-foreground">
              No archived batches yet
            </p>
            <p className="text-sm text-muted-foreground">
              Run a year rollover and the retired classes will line up here,
              with every student's outcome kept for the record.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* year filter */}
          {yearOptions.length > 1 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Batch year</Label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {grouped.map((group) => (
            <section key={group.year} className="flex flex-col gap-2">
              <h3 className="inline-flex w-fit items-center gap-2 rounded-full bg-sidebar px-2.5 py-1 text-xs font-medium text-secondary-foreground ring-1 ring-border/60">
                <CalendarDotsIcon className="size-3.5 text-muted-foreground" />
                {group.year}
                <span className="font-normal text-muted-foreground tabular-nums">
                  {group.batches.length}
                </span>
              </h3>

              {group.batches.map((b) => (
                <div
                  key={b.id}
                  className="overflow-hidden rounded-xl border border-border bg-background"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
                    onClick={() => toggleExpand(b.id)}
                  >
                    <div className="flex items-center gap-3">
                      <CaretDownIcon
                        className={cn(
                          "size-4 text-muted-foreground transition-transform",
                          expanded !== b.id && "-rotate-90"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-secondary-foreground">
                          {classLabel(b)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {b.student_count} student
                          {b.student_count === 1 ? "" : "s"} ·{" "}
                          {b.subjects.length} subject
                          {b.subjects.length === 1 ? "" : "s"} ·{" "}
                          {b.teachers.length} teacher
                          {b.teachers.length === 1 ? "" : "s"} · archived{" "}
                          {b.archived_at
                            ? new Date(b.archived_at).toLocaleDateString()
                            : "—"}
                        </span>
                      </div>
                    </div>
                    {b.promoted_to ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ArrowRightIcon className="size-3" />
                        {classLabel(b.promoted_to)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <GraduationCapIcon className="size-3.5" />
                        Graduated
                      </span>
                    )}
                  </button>

                  {expanded === b.id && (
                    <div className="flex flex-col border-t border-border">
                      {/* subjects + teachers of the batch */}
                      {(b.subjects.length > 0 || b.teachers.length > 0) && (
                        <div className="flex flex-col gap-2.5 border-b border-dashed border-border px-4 py-3">
                          {b.subjects.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[11px] font-medium text-muted-foreground">
                                Subjects
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {b.subjects.map((name) => (
                                  <span
                                    key={name}
                                    className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-secondary-foreground"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {b.teachers.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[11px] font-medium text-muted-foreground">
                                Teachers
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {b.teachers.map((t) => (
                                  <span
                                    key={`${t.teacher_id}-${t.subject_name}`}
                                    className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-secondary-foreground"
                                  >
                                    {t.full_name}
                                    {t.subject_name && (
                                      <span className="text-muted-foreground">
                                        {" "}
                                        · {t.subject_name}
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {loadingStudents === b.id ? (
                        <div className="flex justify-center py-6">
                          <CircleNotchIcon className="size-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="flex flex-col divide-y divide-border">
                          {(students[b.id] ?? []).map((s) => (
                            <div
                              key={`${s.student_id}-${s.reason}`}
                              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
                            >
                              <span className="min-w-40 flex-1 truncate text-xs font-medium text-secondary-foreground">
                                {s.student?.full_name ?? "Unknown"}
                              </span>
                              <span className="w-16 text-xs text-muted-foreground tabular-nums">
                                {s.student?.roll_number ?? "—"}
                              </span>
                              <Badge
                                variant="secondary"
                                className="rounded-full text-[11px] capitalize"
                              >
                                {s.reason.replace("_", "-")}
                              </Badge>
                              <span className="w-20 text-xs text-muted-foreground capitalize">
                                {s.student?.status ?? "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </LoadingSwap>
  )
}
