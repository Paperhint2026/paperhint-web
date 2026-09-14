import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArchiveIcon,
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  CalendarDotsIcon,
  CaretDownIcon,
  CircleNotchIcon,
  GraduationCapIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { showError } from "@/lib/show-error"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { useHeaderActions } from "@/components/layout/header-actions-context"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Sticker } from "@/components/shared/sticker"
import { Button } from "@/components/ui/button"
import { ModuleAction } from "@/components/ui/module-action"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
    <nav
      aria-label="Batches views"
      className="-mb-px flex shrink-0 gap-1 overflow-x-auto border-b border-border"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-current={view === o.id ? "page" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-2 border-b-2 px-3 pb-2.5 text-sm whitespace-nowrap transition-colors",
            view === o.id
              ? "border-primary font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <o.icon className="size-4 shrink-0" />
          {o.label}
        </button>
      ))}
    </nav>
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
            Batch management moves whole classes between years, so it's reserved
            for your school admin.
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
  const navigate = useNavigate()
  const { setHeaderActions } = useHeaderActions()

  const [context, setContext] = useState<ContextResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [switchOpen, setSwitchOpen] = useState(false)

  const fetchContext = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const res = await apiClient.get<ContextResponse>("/api/batches/context")
      setContext(res)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])
  useEffect(() => {
    fetchContext()
  }, [fetchContext])

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

  // One name, one action, wherever it appears (founder, 2026-09-14): while
  // classes are mid-rollover, "Open rollover wizard" is what actually needs
  // doing — starting yet another year makes no sense until this one finishes.
  const hasPending = pending.length > 0
  useEffect(() => {
    setHeaderActions(
      <ModuleAction
        onClick={() =>
          hasPending ? navigate("/rollover") : setSwitchOpen(true)
        }
      >
        <ArrowsClockwiseIcon className="size-3.5" />
        <span className="hidden sm:inline">
          {hasPending ? "Open rollover wizard" : "Start new academic year"}
        </span>
      </ModuleAction>
    )
    return () => setHeaderActions(null)
  }, [hasPending, navigate, setHeaderActions])

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
          {/* The open year is a fact about the school, so it reads as one */}
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDotsIcon className="size-4" />
            School year{" "}
            <span className="font-medium text-foreground">
              {activeYear ?? "not set"}
            </span>
          </p>

          {!activeYear ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-background px-5 py-10 text-center">
              <Sticker name="point" size={96} />
              <div className="flex max-w-[360px] flex-col gap-1">
                <p className="text-base font-medium text-secondary-foreground">
                  No academic year set
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
            /* Nothing to promote, but the batch itself is worth seeing: this is
               the tab's resting state, not an empty one. */
            <CurrentBatch classes={currentClasses} year={activeYear} />
          ) : (
            /* Classes are waiting to move — the rollover wizard is where that
               happens now (module 06): class plan, per-student exceptions,
               review, then one atomic run. */
            <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-background px-5 py-10 text-center">
              <Sticker name="run" size={96} />
              <div className="flex max-w-md flex-col gap-1">
                <p className="text-base font-medium text-secondary-foreground">
                  {pending.length}{" "}
                  {pending.length === 1 ? "class is" : "classes are"} waiting to
                  move into {activeYear}
                </p>
                <p className="text-sm text-muted-foreground">
                  Build the plan, place any exception, then run it — nothing
                  moves until the last step.
                </p>
              </div>
              <Button onClick={() => navigate("/rollover")}>
                Open rollover wizard
              </Button>
            </div>
          )}
        </div>
      )}

      <SwitchYearDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        currentYear={activeYear}
        existingYears={classes.map((c) => c.academic_year)}
        onSwitched={() => fetchContext()}
      />
    </LoadingSwap>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Switch year
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
  const navigate = useNavigate()
  // A school moves forward one year, and never back (truth.md): the next year
  // is not a choice, it is a fact derived from the current one.
  const nextYear = useMemo(
    () =>
      deriveYearOptions(
        existingYears.length > 0
          ? existingYears
          : currentYear
            ? [currentYear]
            : []
      )[0] ?? "",
    [existingYears, currentYear]
  )
  const year = nextYear
  const [isSaving, setIsSaving] = useState(false)
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null)

  const save = async () => {
    if (!year) return
    setIsSaving(true)
    try {
      await apiClient.post("/api/academic-years", { label: year })
      toast.success(`${year} is now the open year`)
      onOpenChange(false)
      onSwitched()
      navigate("/rollover")
    } catch (err) {
      // The gate (founder, 2026-09-13): the open year has to finish first.
      const data =
        err instanceof Error
          ? (err as Error & { data?: { code?: string; ends_on?: string } }).data
          : undefined
      if (data?.code === "year_not_finished" && data.ends_on) {
        setBlockedUntil(data.ends_on)
      } else {
        showError(err)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {currentYear
              ? "Start a new academic year"
              : "Set the academic year"}
          </DialogTitle>
          <DialogDescription>
            {currentYear
              ? `Classes of ${currentYear} become the previous batch. Nothing moves yet — you promote them in the next step. ${currentYear} closes for good once ${year} opens.`
              : "This tells the system which year your school is operating in."}
          </DialogDescription>
        </DialogHeader>
        {blockedUntil ? (
          <div className="flex flex-col gap-1.5 py-2">
            <p className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              {currentYear} runs until{" "}
              <span className="font-medium">{blockedUntil}</span>. The next year
              can open once that date has passed.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 py-2">
            <Label className="text-xs">Opening</Label>
            <div className="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-base font-medium text-foreground tabular-nums">
              {year || "—"}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Always the year after {currentYear ?? "the current one"}. A school
              moves forward one year at a time.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={
              isSaving || !year || year === currentYear || !!blockedUntil
            }
          >
            {isSaving ? (
              <>
                <CircleNotchIcon className="size-3.5 animate-spin" />
                Opening…
              </>
            ) : (
              `Open ${year}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
        showError(err)
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
              <Label className="text-xs text-muted-foreground">
                Batch year
              </Label>
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

/**
 * The batch as it stands: every current class by grade, with how many students
 * sit in each section and how many are marked detained. Shown when nothing is
 * pending, so the tab always tells you something about the year.
 */
function CurrentBatch({
  classes,
  year,
}: {
  classes: ContextClass[]
  year: string | null
}) {
  const byGrade = new Map<number, ContextClass[]>()
  for (const c of classes) {
    const list = byGrade.get(c.grade) ?? []
    list.push(c)
    byGrade.set(c.grade, list)
  }
  const grades = [...byGrade.keys()].sort((a, b) => a - b)
  const students = classes.reduce((n, c) => n + c.student_count, 0)
  const detained = classes.reduce((n, c) => n + c.detained_count, 0)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        All {classes.length} {classes.length === 1 ? "class is" : "classes are"}{" "}
        in <span className="text-foreground">{year}</span>
        {" · "}
        {students} students
        {detained > 0 && (
          <>
            {" · "}
            <span className="text-foreground">{detained}</span> marked detained
          </>
        )}
        . When the year ends, start the next one and the promotion plan appears
        here.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-24 px-3 py-2 font-medium">Grade</th>
              <th className="px-3 py-2 font-medium">Sections</th>
              <th className="w-28 px-3 py-2 text-right font-medium">
                Students
              </th>
              <th className="w-28 px-3 py-2 text-right font-medium">
                Detained
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {grades.map((g) => {
              const rows = byGrade.get(g) ?? []
              const total = rows.reduce((n, c) => n + c.student_count, 0)
              const held = rows.reduce((n, c) => n + c.detained_count, 0)
              return (
                <tr key={g}>
                  <td className="px-3 py-2.5 font-medium text-foreground">
                    Grade {g}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {rows
                        .sort((a, b) => a.section.localeCompare(b.section))
                        .map((c) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground"
                          >
                            {c.section}
                            <span className="text-muted-foreground tabular-nums">
                              {c.student_count}
                            </span>
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-foreground tabular-nums">
                    {total}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {held > 0 ? (
                      <span className="text-foreground">{held}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
