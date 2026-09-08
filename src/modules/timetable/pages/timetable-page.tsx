import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { TimeSelectField } from "@/components/shared/time-select-field"
import {
  ArrowsClockwiseIcon,
  ArrowUUpLeftIcon,
  ArrowUUpRightIcon,
  CaretRightIcon,
  ChalkboardTeacherIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  CopyIcon,
  GearSixIcon,
  InfoIcon,
  PlusIcon,
  SparkleIcon,
  TableIcon,
  TrashIcon,
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
import { Textarea } from "@/components/ui/textarea"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Period {
  id: string
  period_number: number
  name: string
  start_time: string
  end_time: string
  is_break: boolean
}

interface ReadinessSection {
  id: string
  grade: number
  section: string
  academic_year: string
  subject_count: number
  missing_teacher: { subject_name: string; subject_type: string }[]
  slot_count: number
  ready: boolean
}

interface WeekSettings {
  week_start: "monday" | "sunday"
  working_days: 5 | 6
}

interface BuilderSubject {
  class_subject_id: string
  subject_id: string
  subject_name: string
  default_teacher_id: string | null
  default_teacher_name: string | null
}

interface ElectiveGroup {
  elective_group_id: string
  elective_group_name: string
  options: string[]
}

interface TeacherOption {
  id: string
  full_name: string
  department_name?: string | null
}

interface SlotDraft {
  kind: "subject" | "custom" | "elective"
  class_subject_id?: string
  subject_name?: string
  custom_label?: string
  elective_group_id?: string
  elective_label?: string
  teacher_id?: string | null
  teacher_name?: string | null
  block_id?: string | null
}

interface TimetableResponse {
  class: { id: string; grade: number; section: string; academic_year: string }
  slots: (SlotDraft & {
    id: string
    day_of_week: number
    period_id: string
    class_subject_id: string | null
    custom_label: string | null
    elective_group_id: string | null
    elective_label: string | null
    teacher_id: string | null
    teacher_name: string | null
    block_id: string | null
  })[]
  subjects: BuilderSubject[]
  elective_groups: ElectiveGroup[]
  teachers: TeacherOption[]
  grade_teacher_ids: string[]
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const cellKey = (day: number, periodId: string) => `${day}|${periodId}`

function workingDayNumbers(settings?: WeekSettings): number[] {
  const start = settings?.week_start === "sunday" ? 0 : 1
  const count = settings?.working_days === 5 ? 5 : 6
  return Array.from({ length: count }, (_, i) => (start + i) % 7)
}

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  )
}

export function TimetablePage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const { setHeaderActions } = useHeaderActions()

  const [periods, setPeriods] = useState<Period[]>([])
  const [readiness, setReadiness] = useState<ReadinessSection[]>([])
  const [weekSettings, setWeekSettings] = useState<WeekSettings | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const [bellOpen, setBellOpen] = useState(false)
  const [teacherLoadOpen, setTeacherLoadOpen] = useState(false)
  // Deep link: /timetable?class=<id> preselects a section (used by the
  // grade overview sheet's "Create timetable" / "Open in builder" buttons).
  const [searchParams] = useSearchParams()
  const [selectedClassId, setSelectedClassId] = useState<string>(
    searchParams.get("class") ?? ""
  )

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const [p, r, cal] = await Promise.all([
        apiClient.get<{ periods: Period[] }>("/api/timetable/periods"),
        apiClient.get<{ bell_schedule_ready: boolean; sections: ReadinessSection[] }>(
          "/api/timetable/readiness"
        ),
        apiClient.get<{ week_settings?: WeekSettings }>("/api/calendar"),
      ])
      setPeriods(p.periods ?? [])
      setReadiness(r.sections ?? [])
      setWeekSettings(cal.week_settings)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!isAdmin || periods.length === 0) {
      setHeaderActions(null)
      return
    }
    setHeaderActions(
      <div className="flex items-center gap-2">
        <Button
          size="lg"
          variant="outline"
          className="rounded-full"
          onClick={() => setTeacherLoadOpen(true)}
        >
          <ChalkboardTeacherIcon className="size-3.5" />
          <span className="hidden sm:inline">Teacher load</span>
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="rounded-full"
          onClick={() => setBellOpen(true)}
        >
          <GearSixIcon className="size-3.5" />
          <span className="hidden sm:inline">Bell schedule</span>
        </Button>
      </div>
    )
    return () => setHeaderActions(null)
  }, [isAdmin, periods.length, setHeaderActions])

  if (!isAdmin) {
    return (
      <div
        className={cn(
          PAGE_GUTTER,
          PAGE_TOP,
          "flex min-h-full flex-col gap-5 pb-12"
        )}
      >
        <PageHeader
          icon={TableIcon}
          title="Timetable"
          description="Your week at a glance — or any section's full timetable."
        />
        <TeacherTimetableView />
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
        icon={TableIcon}
        title="Timetable"
        description="The bell schedule and each section's weekly periods."
      />

      <LoadingSwap loading={isLoading} skeleton={<PageSkeleton />} className="flex-1">
        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <Sticker name="worried" size={88} />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={fetchAll}>
              Try again
            </Button>
          </div>
        ) : periods.length === 0 ? (
          <BellScheduleSetup
            initial={[]}
            onSaved={fetchAll}
            weekSettings={weekSettings}
          />
        ) : (
          <div className="flex flex-col gap-5">
            <ReadinessStrip
              sections={readiness}
              selectedClassId={selectedClassId}
              onSelect={setSelectedClassId}
            />
            {selectedClassId ? (
              <SectionBuilder
                key={selectedClassId}
                classId={selectedClassId}
                periods={periods}
                weekSettings={weekSettings}
                readiness={readiness}
                onSaved={fetchAll}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-background px-5 py-12 text-center">
                <Sticker name="point" size={96} />
                <p className="text-sm text-muted-foreground">
                  Pick a section above to build or edit its timetable.
                </p>
              </div>
            )}
          </div>
        )}
      </LoadingSwap>

      {teacherLoadOpen && (
        <TeacherLoadDialog
          days={workingDayNumbers(weekSettings)}
          teachable={periods.filter((p) => !p.is_break)}
          onClose={() => setTeacherLoadOpen(false)}
        />
      )}

      {bellOpen && (
        <Dialog open onOpenChange={(o) => !o && setBellOpen(false)}>
          <DialogContent className="flex max-h-[90vh] flex-col gap-0 sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Bell schedule</DialogTitle>
              <DialogDescription>
                Changing period times updates every timetable. Removing a
                period is blocked while any timetable still uses it.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-6 py-4">
              <BellScheduleSetup
                initial={periods}
                weekSettings={weekSettings}
                embedded
                onSaved={() => {
                  setBellOpen(false)
                  fetchAll()
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Bell schedule — day-shape generator + editable rows
// ─────────────────────────────────────────────────────────────────────────────

interface BreakSpec {
  name: string
  after_period: number
  minutes: number
}

function addMinutes(t: string, mins: number): string {
  const [h, m] = t.split(":").map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

function BellScheduleSetup({
  initial,
  onSaved,
  weekSettings,
  embedded = false,
}: {
  initial: Period[]
  onSaved: () => void
  weekSettings?: WeekSettings
  embedded?: boolean
}) {
  const [startTime, setStartTime] = useState("08:30")
  const [endTime, setEndTime] = useState("15:30")
  const [periodMinutes, setPeriodMinutes] = useState("45")
  const [breaks, setBreaks] = useState<BreakSpec[]>([
    { name: "Recess", after_period: 2, minutes: 15 },
    { name: "Lunch", after_period: 5, minutes: 40 },
  ])

  const [rows, setRows] = useState<(Omit<Period, "id" | "period_number"> & { id?: string })[]>(
    initial.map(({ id, name, start_time, end_time, is_break }) => ({
      id,
      name,
      start_time: start_time.slice(0, 5),
      end_time: end_time.slice(0, 5),
      is_break,
    }))
  )
  const [isSaving, setIsSaving] = useState(false)

  const generate = () => {
    const mins = Number(periodMinutes)
    if (!startTime || !endTime || !mins || endTime <= startTime) {
      toast.error("Check the school start/end times and period length")
      return
    }
    const out: typeof rows = []
    let cursor = startTime
    let periodNo = 0
    const sortedBreaks = [...breaks].sort((a, b) => a.after_period - b.after_period)
    while (addMinutes(cursor, mins) <= endTime && out.length < 20) {
      periodNo += 1
      const pEnd = addMinutes(cursor, mins)
      out.push({ name: `Period ${periodNo}`, start_time: cursor, end_time: pEnd, is_break: false })
      cursor = pEnd
      const brk = sortedBreaks.find((b) => b.after_period === periodNo)
      if (brk && brk.minutes > 0) {
        const bEnd = addMinutes(cursor, brk.minutes)
        if (bEnd > endTime) break
        out.push({ name: brk.name || "Break", start_time: cursor, end_time: bEnd, is_break: true })
        cursor = bEnd
      }
    }
    if (out.length === 0) {
      toast.error("That day shape produces no periods")
      return
    }
    setRows(out)
  }

  const updateRow = (i: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const saveBell = async () => {
    if (rows.length === 0) {
      toast.error("Generate or add the day's periods first")
      return
    }
    for (const r of rows) {
      if (!r.name.trim() || !r.start_time || !r.end_time || r.end_time <= r.start_time) {
        toast.error(`Check the row "${r.name || "?"}" — times must be valid`)
        return
      }
    }
    setIsSaving(true)
    try {
      await apiClient.put("/api/timetable/periods", { periods: rows })
      toast.success("Bell schedule saved")
      onSaved()
    } catch (err) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const days = workingDayNumbers(weekSettings)

  return (
    <div className={cn("flex flex-col gap-5", !embedded && "max-w-3xl")}>
      {!embedded && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-foreground">Set up the school day</h3>
          <p className="text-xs text-muted-foreground">
            Describe the day's shape and the periods are drawn for you — then
            tweak any row. The week runs {days.map((d) => DAY_SHORT[d]).join(", ")}{" "}
            (change in Calendar → Week settings).
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">School starts</Label>
            <TimeSelectField
              value={startTime}
              onChange={setStartTime}
              placeholder="Start"
              clearable={false}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">School ends</Label>
            <TimeSelectField
              value={endTime}
              onChange={setEndTime}
              placeholder="End"
              clearable={false}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Period length</Label>
            <Select value={periodMinutes} onValueChange={setPeriodMinutes}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["30", "35", "40", "45", "50", "55", "60"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs">Breaks</Label>
          {breaks.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                value={b.name}
                onChange={(e) =>
                  setBreaks((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder="Name"
                className="h-8 w-32 text-xs"
              />
              <span className="text-xs text-muted-foreground">after period</span>
              <Input
                type="number"
                min={1}
                max={12}
                value={b.after_period}
                onChange={(e) =>
                  setBreaks((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, after_period: Number(e.target.value) } : x))
                  )
                }
                className="h-8 w-16 text-xs"
              />
              <span className="text-xs text-muted-foreground">for</span>
              <Input
                type="number"
                min={5}
                max={90}
                step={5}
                value={b.minutes}
                onChange={(e) =>
                  setBreaks((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, minutes: Number(e.target.value) } : x))
                  )
                }
                className="h-8 w-16 text-xs"
              />
              <span className="text-xs text-muted-foreground">min</span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setBreaks((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Remove break"
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-fit text-xs"
            onClick={() =>
              setBreaks((prev) => [...prev, { name: "Break", after_period: prev.length + 2, minutes: 15 }])
            }
          >
            <PlusIcon className="size-3" />
            Add break
          </Button>
        </div>

        <Button onClick={generate} className="w-fit">
          <ArrowsClockwiseIcon className="size-3.5" />
          {rows.length > 0 ? "Regenerate periods" : "Generate periods"}
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs">
            The day ({rows.filter((r) => !r.is_break).length} periods) — edit any row before saving
          </Label>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
            {rows.map((r, i) => (
              <div
                key={i}
                className={cn("flex flex-wrap items-center gap-2 px-3 py-2", r.is_break && "bg-sidebar/60")}
              >
                <Input
                  value={r.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                  className="h-8 w-36 text-xs"
                />
                <TimeSelectField
                  value={r.start_time}
                  onChange={(v) => updateRow(i, { start_time: v })}
                  placeholder="Start"
                  clearable={false}
                  className="h-8 w-32 text-xs"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <TimeSelectField
                  value={r.end_time}
                  onChange={(v) => updateRow(i, { end_time: v })}
                  placeholder="End"
                  clearable={false}
                  className="h-8 w-32 text-xs"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox checked={r.is_break} onCheckedChange={(v) => updateRow(i, { is_break: !!v })} />
                  Break
                </label>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Remove row"
                >
                  <TrashIcon className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <Button onClick={saveBell} disabled={isSaving} className="w-fit">
            {isSaving ? (
              <>
                <CircleNotchIcon className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save bell schedule"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Readiness strip
// ─────────────────────────────────────────────────────────────────────────────

function ReadinessStrip({
  sections,
  selectedClassId,
  onSelect,
}: {
  sections: ReadinessSection[]
  selectedClassId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Pick a section. Sections missing a subject teacher can't be built yet —
        assign teachers first.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sections.map((s) => {
          const selected = s.id === selectedClassId
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => s.ready && onSelect(s.id)}
              disabled={!s.ready}
              title={
                s.ready
                  ? `${s.slot_count} slots placed`
                  : s.subject_count === 0
                    ? "No subjects yet"
                    : `No teacher: ${s.missing_teacher.map((m) => m.subject_name).join(", ")}`
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                selected
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : s.ready
                    ? "border-border bg-background text-secondary-foreground hover:bg-muted"
                    : "cursor-not-allowed border-border bg-muted/40 text-muted-foreground/60"
              )}
            >
              {s.ready ? (
                s.slot_count > 0 ? (
                  <CheckCircleIcon weight="fill" className="size-3.5 text-primary" />
                ) : null
              ) : (
                <WarningIcon className="size-3.5 text-amber-600" />
              )}
              {s.grade}-{s.section}
            </button>
          )
        })}
      </div>
      {sections.some((s) => !s.ready) && (
        <p className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <WarningIcon className="size-3" />
          {sections
            .filter((s) => !s.ready)
            .map((s) =>
              s.subject_count === 0
                ? `${s.grade}-${s.section}: no subjects`
                : `${s.grade}-${s.section}: no teacher for ${s.missing_teacher.map((m) => m.subject_name).join(", ")}`
            )
            .join(" · ")}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section builder
// ─────────────────────────────────────────────────────────────────────────────

function SectionBuilder({
  classId,
  periods,
  weekSettings,
  readiness,
  onSaved,
}: {
  classId: string
  periods: Period[]
  weekSettings?: WeekSettings
  readiness: ReadinessSection[]
  onSaved: () => void
}) {
  const [data, setData] = useState<TimetableResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [draft, setDraft] = useState<Map<string, SlotDraft>>(new Map())
  const [dirty, setDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [conflicts, setConflicts] = useState<Map<string, string>>(new Map())
  const [warnings, setWarnings] = useState<
    { day_of_week: number; period_id: string; message: string }[]
  >([])
  const [editorCell, setEditorCell] = useState<{ day: number; periodId: string } | null>(null)
  const [copyDayOpen, setCopyDayOpen] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [genIssues, setGenIssues] = useState<string[]>([])
  const [genQuality, setGenQuality] = useState<{
    variationScore: number
    breakdown?: Record<string, number>
    similarDays?: { days: number[]; similarity: number }[]
    concentratedTokens?: { token: string; entropy: number }[]
    candidatesTried?: number
    optimizerIterations?: number
  } | null>(null)
  // survives across dialog opens so a second "AI fill" REFINES the last
  // generation (same quotas, fresh prompt, current grid as context);
  // Discard clears it and the next fill starts from scratch
  const [genSession, setGenSession] = useState<{
    quotas: Record<string, number>
    electiveQuotas: Record<string, number>
    customRows: { label: string; quota: number }[]
  } | null>(null)
  const [orientation, setOrientation] = useState<"periods-rows" | "days-rows">("days-rows")

  const days = workingDayNumbers(weekSettings)
  const teachable = useMemo(() => periods.filter((p) => !p.is_break), [periods])

  // A draft in progress means the next AI action is a REFINE of that grid,
  // never a fresh fill. The session (quotas etc.) is derived from the grid
  // itself — the truest source: it survives reload/logout with the server
  // draft and reflects manual cell edits, not just the last dialog run.
  const isDraftInProgress = dirty && draft.size > 0
  const draftSession = useMemo(() => {
    if (draft.size === 0) return null
    const quotas: Record<string, number> = {}
    const electiveQuotas: Record<string, number> = {}
    const customs = new Map<string, number>()
    for (const sl of draft.values()) {
      if (sl.kind === "subject" && sl.class_subject_id) {
        quotas[sl.class_subject_id] = (quotas[sl.class_subject_id] ?? 0) + 1
      } else if (sl.kind === "elective" && sl.elective_group_id) {
        electiveQuotas[sl.elective_group_id] =
          (electiveQuotas[sl.elective_group_id] ?? 0) + 1
      } else if (sl.kind === "custom" && sl.custom_label) {
        customs.set(sl.custom_label, (customs.get(sl.custom_label) ?? 0) + 1)
      }
    }
    return {
      quotas,
      electiveQuotas,
      customRows: [...customs].map(([label, quota]) => ({ label, quota })),
    }
  }, [draft])
  const effectiveSession = isDraftInProgress ? (draftSession ?? genSession) : genSession

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [res, draftRes] = await Promise.all([
        apiClient.get<TimetableResponse>(`/api/timetable/${classId}`),
        apiClient
          .get<{ draft: { slots: ({ key: string } & SlotDraft)[]; quality: unknown } | null }>(
            `/api/timetable/${classId}/draft`
          )
          .catch(() => ({ draft: null })),
      ])
      setData(res)

      // A server-side draft (unsaved work from an earlier visit/session)
      // outranks the published grid — restore it so the admin continues
      // where they left off. Discard deletes it; Save publishes over it.
      const draftSlots = draftRes.draft?.slots
      if (Array.isArray(draftSlots) && draftSlots.length > 0) {
        const map = new Map<string, SlotDraft>()
        for (const { key, ...slot } of draftSlots) map.set(key, slot)
        setDraft(map)
        setDirty(true)
        setGenQuality(
          (draftRes.draft?.quality as typeof genQuality) ?? null
        )
        toast.info("Restored your unsaved draft — save to publish, or discard")
      } else {
        const map = new Map<string, SlotDraft>()
        for (const s of res.slots) {
          map.set(cellKey(s.day_of_week, s.period_id), {
            kind: s.kind,
            class_subject_id: s.class_subject_id ?? undefined,
            subject_name:
              s.kind === "subject"
                ? res.subjects.find((x) => x.class_subject_id === s.class_subject_id)?.subject_name
                : undefined,
            custom_label: s.custom_label ?? undefined,
            elective_group_id: s.elective_group_id ?? undefined,
            elective_label: s.elective_label ?? undefined,
            teacher_id: s.teacher_id,
            teacher_name: s.teacher_name,
            block_id: s.block_id,
          })
        }
        setDraft(map)
        setDirty(false)
        setGenQuality(null)
      }
      setConflicts(new Map())
      setWarnings([])
      setGenIssues([])
      setGenSession(null)
      setHistory([])
      setFuture([])
    } catch (err) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [classId])

  useEffect(() => {
    load()
  }, [load])

  // Autosave the working grid to the server draft (debounced, best-effort).
  // The draft survives section switches, reloads and logout; it is deleted
  // when the admin saves (publishes) or discards. Teachers never see it.
  useEffect(() => {
    if (!dirty || isLoading || isSaving) return
    const t = setTimeout(() => {
      const slots = [...draft.entries()].map(([key, slot]) => ({ key, ...slot }))
      apiClient
        .put(`/api/timetable/${classId}/draft`, { slots, quality: genQuality })
        .catch(() => {}) // a failed autosave must never interrupt editing
    }, 1200)
    return () => clearTimeout(t)
  }, [draft, dirty, genQuality, classId, isLoading, isSaving])

  // Discard = delete the server draft, then reload the published grid.
  const discardDraft = async () => {
    setDirty(false) // cancels any pending autosave timer before the delete
    try {
      await apiClient.delete(`/api/timetable/${classId}/draft`)
    } catch {
      // best-effort: a stale draft row gets overwritten by the next autosave
    }
    await load()
  }

  const setCell = (day: number, periodId: string, slot: SlotDraft | null) => {
    pushHistory()
    setDraft((prev) => {
      const next = new Map(prev)
      const key = cellKey(day, periodId)
      const old = prev.get(key)
      if (old?.block_id) {
        for (const [k, v] of prev) {
          if (v.block_id === old.block_id) next.delete(k)
        }
      }
      if (slot === null) next.delete(key)
      else next.set(key, slot)
      return next
    })
    setDirty(true)
    setConflicts((prev) => {
      const next = new Map(prev)
      next.delete(cellKey(day, periodId))
      return next
    })
  }

  const setDouble = (day: number, periodId: string, slot: SlotDraft) => {
    const idx = teachable.findIndex((p) => p.id === periodId)
    const next = teachable[idx + 1]
    if (!next) return
    pushHistory()
    const blockId = crypto.randomUUID()
    setDraft((prev) => {
      const map = new Map(prev)
      map.set(cellKey(day, periodId), { ...slot, block_id: blockId })
      map.set(cellKey(day, next.id), { ...slot, block_id: blockId })
      return map
    })
    setDirty(true)
  }

  // One direct fetch instead of apiClient: a 409 carries the per-cell
  // conflict list in its body, which the shared client discards.
  const doSave = async () => {
    setIsSaving(true)
    setConflicts(new Map())
    try {
      const slots = [...draft.entries()].map(([key, s]) => {
        const [day, periodId] = key.split("|")
        return {
          day_of_week: Number(day),
          period_id: periodId,
          kind: s.kind,
          class_subject_id: s.class_subject_id,
          custom_label: s.custom_label,
          elective_group_id: s.elective_group_id,
          elective_label: s.elective_label,
          teacher_id: s.teacher_id ?? null,
          block_id: s.block_id ?? null,
        }
      })
      const raw = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/timetable/${classId}/slots`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({ slots }),
        }
      )
      const body = await raw.json().catch(() => ({}))
      if (raw.status === 409 && Array.isArray(body.conflicts)) {
        const map = new Map<string, string>()
        for (const c of body.conflicts) {
          map.set(cellKey(c.day_of_week, c.period_id), c.message)
        }
        setConflicts(map)
        const shown = body.conflicts.slice(0, 3).map((c: { message: string }) => c.message)
        const more = body.conflicts.length - shown.length
        toast.error(
          `${body.conflicts.length} teacher clash${body.conflicts.length > 1 ? "es" : ""} — nothing was saved`,
          { description: shown.join(" · ") + (more > 0 ? ` · +${more} more (see red cells)` : "") }
        )
        return
      }
      if (!raw.ok) {
        toast.error(body.error || `Save failed (${raw.status})`)
        return
      }
      setDirty(false)
      setWarnings(body.warnings ?? [])
      toast.success("Timetable saved")
      onSaved()
    } catch (err) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Undo / redo ──────────────────────────────────────────────────────────
  // Snapshots of the draft map, bounded. Every mutation (cell edit, swap,
  // copy day, AI fill) pushes the pre-change state; undo/redo walk the two
  // stacks. Cleared on load/discard — history never crosses a section.
  const [history, setHistory] = useState<Map<string, SlotDraft>[]>([])
  const [future, setFuture] = useState<Map<string, SlotDraft>[]>([])

  const pushHistory = () => {
    setHistory((prev) => [...prev.slice(-49), new Map(draft)])
    setFuture([])
  }

  const undo = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      setFuture((f) => [...f, new Map(draft)])
      setDraft(last)
      setDirty(true)
      setConflicts(new Map())
      return prev.slice(0, -1)
    })
  }

  const redo = () => {
    setFuture((prev) => {
      if (prev.length === 0) return prev
      const next = prev[prev.length - 1]
      setHistory((h) => [...h, new Map(draft)])
      setDraft(next)
      setDirty(true)
      setConflicts(new Map())
      return prev.slice(0, -1)
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return
      const target = e.target as HTMLElement | null
      if (target && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  // ── Drag a filled cell onto another cell: swap (or move onto empty) ──────
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dropKey, setDropKey] = useState<string | null>(null)

  const swapCells = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return
    const a = draft.get(fromKey)
    const b = draft.get(toKey)
    if (!a && !b) return
    if (a?.block_id || b?.block_id) {
      toast.error("Double periods can't be swapped by drag — edit the cell instead")
      return
    }
    pushHistory()
    setDraft((prev) => {
      const next = new Map(prev)
      if (b) next.set(fromKey, b)
      else next.delete(fromKey)
      if (a) next.set(toKey, a)
      else next.delete(toKey)
      return next
    })
    setDirty(true)
    setConflicts((prev) => {
      const next = new Map(prev)
      next.delete(fromKey)
      next.delete(toKey)
      return next
    })
  }

  // Custom labels already on the grid ("PT", "Library"…) — feed the cell
  // editor's label combobox and the "apply teacher to all X periods" option.
  const customLabelStats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of draft.values()) {
      if (s.kind === "custom" && s.custom_label) {
        counts.set(s.custom_label, (counts.get(s.custom_label) ?? 0) + 1)
      }
    }
    return counts
  }, [draft])

  // Save a custom cell AND stamp its teacher onto every other cell with the
  // same label — one history entry, so a single undo reverts the lot.
  const applyCustomAcrossLabel = (day: number, periodId: string, slot: SlotDraft) => {
    pushHistory()
    setDraft((prev) => {
      const next = new Map(prev)
      next.set(cellKey(day, periodId), slot)
      for (const [key, s] of prev) {
        if (key === cellKey(day, periodId)) continue
        if (s.kind === "custom" && s.custom_label === slot.custom_label && !s.block_id) {
          next.set(key, { ...s, teacher_id: slot.teacher_id, teacher_name: slot.teacher_name })
        }
      }
      return next
    })
    setDirty(true)
    setConflicts(new Map()) // many cells changed — the auto-check re-verifies
  }

  const dragProps = (key: string, slot: SlotDraft | undefined) => ({
    draggable: !!slot && !slot.block_id,
    onDragStart: (e: React.DragEvent) => {
      setDragKey(key)
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", key)
    },
    onDragEnd: () => {
      setDragKey(null)
      setDropKey(null)
    },
    onDragOver: (e: React.DragEvent) => {
      if (dragKey && dragKey !== key) {
        e.preventDefault()
        setDropKey(key)
      }
    },
    onDragLeave: () => setDropKey((cur) => (cur === key ? null : cur)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      const from = e.dataTransfer.getData("text/plain") || dragKey
      if (from) swapCells(from, key)
      setDragKey(null)
      setDropKey(null)
    },
  })

  // Dry-run the save validator against the current draft: teacher clashes
  // vs every other saved section + elective alignment. Same verdict the
  // save gate gives, without writing anything. Runs two ways:
  //  - silently, debounced, after every draft change (red cells appear on
  //    their own as you drag/edit)
  //  - loudly from the "Check clashes" button (adds the verdict toast)
  const [isChecking, setIsChecking] = useState(false)
  const runValidation = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setIsChecking(true)
    try {
      const slots = [...draft.entries()].map(([key, s]) => {
        const [day, periodId] = key.split("|")
        return {
          day_of_week: Number(day),
          period_id: periodId,
          kind: s.kind,
          class_subject_id: s.class_subject_id,
          custom_label: s.custom_label,
          elective_group_id: s.elective_group_id,
          elective_label: s.elective_label,
          teacher_id: s.teacher_id ?? null,
          block_id: s.block_id ?? null,
        }
      })
      const res = await apiClient.post<{
        ok: boolean
        conflicts: { day_of_week: number; period_id: string; message: string }[]
        warnings: { day_of_week: number; period_id: string; message: string }[]
      }>(`/api/timetable/${classId}/validate`, { slots })
      setWarnings(res.warnings ?? [])
      if (res.ok) {
        setConflicts(new Map())
        if (!opts?.silent) toast.success("All good — no teacher clashes with any other section")
      } else {
        const map = new Map<string, string>()
        for (const c of res.conflicts) map.set(cellKey(c.day_of_week, c.period_id), c.message)
        setConflicts(map)
        if (opts?.silent) {
          // brief nudge only — the admin may be mid-swap; details are on the
          // red cells (hover) and behind the "Check clashes" button
          toast.error("Double booked — see the red cells", { duration: 2000 })
        } else {
          const shown = res.conflicts.slice(0, 3).map((c) => c.message)
          const more = res.conflicts.length - shown.length
          toast.error(
            `${res.conflicts.length} clash${res.conflicts.length > 1 ? "es" : ""} found`,
            { description: shown.join(" · ") + (more > 0 ? ` · +${more} more (see red cells)` : "") }
          )
        }
      }
    } catch (err) {
      if (!opts?.silent && err instanceof Error) toast.error(err.message)
    } finally {
      if (!opts?.silent) setIsChecking(false)
    }
  }
  const checkClashes = () => runValidation()

  // Live check: any draft change re-validates after a short pause, so an
  // overlapping drop turns red without pressing the button. The clash toast
  // still fires (it names who is double-booked and where); the all-clear
  // toast stays button-only to avoid noise on every edit.
  useEffect(() => {
    if (!dirty || isLoading || draft.size === 0) return
    const t = setTimeout(() => {
      runValidation({ silent: true })
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty, isLoading])

  const copyDay = (fromDay: number, toDays: number[]) => {
    pushHistory()
    setDraft((prev) => {
      const next = new Map(prev)
      for (const to of toDays) {
        for (const p of teachable) next.delete(cellKey(to, p.id))
        for (const p of teachable) {
          const src = prev.get(cellKey(fromDay, p.id))
          if (src) next.set(cellKey(to, p.id), { ...src, block_id: null })
        }
      }
      return next
    })
    setDirty(true)
    setCopyDayOpen(false)
    toast.success("Day copied — review and save")
  }

  const cls = data?.class
  const readinessRow = readiness.find((r) => r.id === classId)

  if (isLoading || !data) {
    return <Skeleton className="h-72 w-full rounded-xl" />
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Grade {cls?.grade} - {cls?.section}{" "}
          <span className="font-normal text-muted-foreground">({cls?.academic_year})</span>
        </h3>
        {readinessRow && (
          <Badge variant="secondary" className="rounded-full text-[10px]">
            {draft.size} slots
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <LayoutTile
              selected={orientation === "periods-rows"}
              onClick={() => setOrientation("periods-rows")}
              label="Periods ↓"
              variant="periods-rows"
            />
            <LayoutTile
              selected={orientation === "days-rows"}
              onClick={() => setOrientation("days-rows")}
              label="Days ↓"
              variant="days-rows"
            />
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              onClick={undo}
              disabled={history.length === 0}
              aria-label="Undo"
              title="Undo (Cmd/Ctrl+Z)"
            >
              <ArrowUUpLeftIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              onClick={redo}
              disabled={future.length === 0}
              aria-label="Redo"
              title="Redo (Shift+Cmd/Ctrl+Z)"
            >
              <ArrowUUpRightIcon className="size-3.5" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full text-xs"
            onClick={() => setSummaryOpen(true)}
            disabled={draft.size === 0}
          >
            <InfoIcon className="size-3.5" />
            Summary
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full text-xs"
            onClick={() => setCopyDayOpen(true)}
          >
            <CopyIcon className="size-3.5" />
            Copy day
          </Button>
          <Button
            size="sm"
            className="h-8 rounded-full text-xs"
            onClick={() => setGenOpen(true)}
          >
            <SparkleIcon className="size-3.5" />
            {isDraftInProgress ? "Refine" : "AI fill"}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        {orientation === "days-rows" ? (
          <table className="w-full border-collapse bg-background text-xs">
            <thead>
              <tr className="bg-sidebar">
                <th className="w-24 border-b border-border px-2 py-2 text-left font-medium text-muted-foreground">
                  Day
                </th>
                {periods.map((p) =>
                  p.is_break ? (
                    <th
                      key={p.id}
                      className="w-8 border-b border-l border-border bg-sidebar/80 px-1 py-2 align-middle"
                    >
                      <span className="mx-auto block text-[9px] font-medium tracking-wide text-muted-foreground/70 uppercase [writing-mode:vertical-rl]">
                        {p.name}
                      </span>
                    </th>
                  ) : (
                    <th
                      key={p.id}
                      className="min-w-24 border-b border-l border-border px-2 py-2 text-center font-medium text-muted-foreground"
                    >
                      {p.name}
                      <span className="block text-[9px] font-normal text-muted-foreground/70">
                        {fmtTime(p.start_time.slice(0, 5))}
                      </span>
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d}>
                  <td className="border-b border-border px-2 py-1.5 font-medium text-secondary-foreground">
                    {DAY_SHORT[d]}
                  </td>
                  {periods.map((p) => {
                    if (p.is_break) {
                      return (
                        <td
                          key={p.id}
                          className="border-b border-l border-border bg-sidebar/60 px-0.5"
                        />
                      )
                    }
                    const key = cellKey(d, p.id)
                    const slot = draft.get(key)
                    const conflict = conflicts.get(key)

                    if (slot?.block_id) {
                      const idx = teachable.findIndex((x) => x.id === p.id)
                      const prevPeriod = teachable[idx - 1]
                      if (
                        prevPeriod &&
                        draft.get(cellKey(d, prevPeriod.id))?.block_id === slot.block_id
                      ) {
                        return null // covered by the colSpan before it
                      }
                    }
                    const isDoubleStart = (() => {
                      if (!slot?.block_id) return false
                      const idx = teachable.findIndex((x) => x.id === p.id)
                      const nextPeriod = teachable[idx + 1]
                      return (
                        !!nextPeriod &&
                        draft.get(cellKey(d, nextPeriod.id))?.block_id === slot.block_id
                      )
                    })()

                    return (
                      <td
                        key={key}
                        colSpan={isDoubleStart ? 2 : 1}
                        onClick={() => setEditorCell({ day: d, periodId: p.id })}
                        {...dragProps(key, slot)}
                        className={cn(
                          "cursor-pointer border-b border-l border-border px-1.5 py-1.5 align-middle transition-colors hover:bg-primary/[0.04]",
                          conflict && "bg-destructive/10 ring-1 ring-destructive/50 ring-inset",
                          dragKey === key && "opacity-40",
                          dropKey === key && "bg-primary/10 ring-1 ring-primary/50 ring-inset"
                        )}
                        title={conflict}
                      >
                        {slot ? (
                          <div className="flex flex-col items-center gap-0.5 text-center">
                            <span className="font-medium text-secondary-foreground">
                              {slot.kind === "subject"
                                ? slot.subject_name
                                : slot.kind === "custom"
                                  ? slot.custom_label
                                  : slot.elective_label}
                            </span>
                            {slot.kind === "elective" ? (
                              <span className="text-[10px] text-violet-600 dark:text-violet-400">
                                elective
                              </span>
                            ) : slot.teacher_name ? (
                              <span className="truncate text-[10px] text-muted-foreground">
                                {slot.teacher_name}
                              </span>
                            ) : null}
                            {isDoubleStart && (
                              <span className="text-[9px] text-muted-foreground/60">double</span>
                            )}
                          </div>
                        ) : (
                          <span className="block text-center text-muted-foreground/30">+</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
        <table className="w-full border-collapse bg-background text-xs">
          <thead>
            <tr className="bg-sidebar">
              <th className="w-32 border-b border-border px-2 py-2 text-left font-medium text-muted-foreground">
                Period
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  className="min-w-28 border-b border-l border-border px-2 py-2 text-center font-medium text-muted-foreground"
                >
                  {DAY_NAMES[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => {
              if (p.is_break) {
                return (
                  <tr key={p.id} className="bg-sidebar/60">
                    <td className="border-b border-border px-2 py-1 text-[10px] text-muted-foreground">
                      {p.name} · {fmtTime(p.start_time.slice(0, 5))}
                    </td>
                    <td
                      colSpan={days.length}
                      className="border-b border-l border-border px-2 py-1 text-center text-[10px] tracking-wide text-muted-foreground/60 uppercase"
                    >
                      {p.name}
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={p.id}>
                  <td className="border-b border-border px-2 py-1.5 align-middle">
                    <span className="font-medium text-secondary-foreground">{p.name}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {fmtTime(p.start_time.slice(0, 5))} – {fmtTime(p.end_time.slice(0, 5))}
                    </span>
                  </td>
                  {days.map((d) => {
                    const key = cellKey(d, p.id)
                    const slot = draft.get(key)
                    const conflict = conflicts.get(key)

                    if (slot?.block_id) {
                      const idx = teachable.findIndex((x) => x.id === p.id)
                      const prevPeriod = teachable[idx - 1]
                      if (
                        prevPeriod &&
                        draft.get(cellKey(d, prevPeriod.id))?.block_id === slot.block_id
                      ) {
                        return null // covered by the rowSpan above
                      }
                    }
                    const isDoubleStart = (() => {
                      if (!slot?.block_id) return false
                      const idx = teachable.findIndex((x) => x.id === p.id)
                      const nextPeriod = teachable[idx + 1]
                      return (
                        !!nextPeriod &&
                        draft.get(cellKey(d, nextPeriod.id))?.block_id === slot.block_id
                      )
                    })()

                    return (
                      <td
                        key={key}
                        rowSpan={isDoubleStart ? 2 : 1}
                        onClick={() => setEditorCell({ day: d, periodId: p.id })}
                        {...dragProps(key, slot)}
                        className={cn(
                          "cursor-pointer border-b border-l border-border px-1.5 py-1 align-middle transition-colors hover:bg-primary/[0.04]",
                          conflict && "bg-destructive/10 ring-1 ring-destructive/50 ring-inset",
                          dragKey === key && "opacity-40",
                          dropKey === key && "bg-primary/10 ring-1 ring-primary/50 ring-inset"
                        )}
                        title={conflict}
                      >
                        {slot ? (
                          <div className="flex flex-col items-center gap-0.5 text-center">
                            <span className="font-medium text-secondary-foreground">
                              {slot.kind === "subject"
                                ? slot.subject_name
                                : slot.kind === "custom"
                                  ? slot.custom_label
                                  : slot.elective_label}
                            </span>
                            {slot.kind === "elective" ? (
                              <span className="text-[10px] text-violet-600 dark:text-violet-400">
                                elective
                              </span>
                            ) : slot.teacher_name ? (
                              <span className="truncate text-[10px] text-muted-foreground">
                                {slot.teacher_name}
                              </span>
                            ) : null}
                            {isDoubleStart && (
                              <span className="text-[9px] text-muted-foreground/60">double</span>
                            )}
                          </div>
                        ) : (
                          <span className="block text-center text-muted-foreground/30">+</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        )}
      </div>

      {genIssues.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
            AI generation didn't produce a timetable:
          </p>
          {genIssues.map((issue, i) => (
            <p key={i} className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
              <WarningIcon className="mt-0.5 size-3 shrink-0" />
              {issue}
            </p>
          ))}
        </div>
      )}

      {genQuality && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-sidebar/50 px-4 py-2 text-xs">
          <span className="font-medium text-secondary-foreground">
            Variation score: {genQuality.variationScore}/100
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              genQuality.variationScore >= 90
                ? "bg-primary/10 text-primary"
                : genQuality.variationScore >= 75
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : genQuality.variationScore >= 60
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-destructive/10 text-destructive"
            )}
          >
            {genQuality.variationScore >= 90
              ? "excellent"
              : genQuality.variationScore >= 75
                ? "good"
                : genQuality.variationScore >= 60
                  ? "acceptable"
                  : "repetitive"}
          </span>
          {genQuality.candidatesTried != null && (
            <span className="text-muted-foreground">
              {genQuality.candidatesTried} candidate
              {genQuality.candidatesTried === 1 ? "" : "s"}
              {genQuality.optimizerIterations
                ? ` · ${genQuality.optimizerIterations} optimizer swaps`
                : ""}
            </span>
          )}
          {(genQuality.similarDays?.length ?? 0) > 0 && (
            <span className="text-muted-foreground">
              · similar day pairs: {genQuality.similarDays!.length}
            </span>
          )}
          {genQuality.candidatesTried === 1 && genQuality.variationScore < 75 && (
            <span className="text-muted-foreground">
              · refine keeps your layout, so the score carries over — Discard and AI
              fill fresh for more variety
            </span>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
          {warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
              <WarningIcon className="mt-0.5 size-3 shrink-0" />
              {w.message}
            </p>
          ))}
        </div>
      )}

      {dirty && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-xs text-muted-foreground">
            Unsaved changes — drag a class onto another cell to swap; clashes are
            checked on save.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={discardDraft} disabled={isSaving}>
              Discard
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={checkClashes}
              disabled={isSaving || isChecking}
            >
              {isChecking ? (
                <>
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                  Checking…
                </>
              ) : (
                "Check clashes"
              )}
            </Button>
            <Button size="sm" onClick={doSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save timetable"
              )}
            </Button>
          </div>
        </div>
      )}

      {editorCell && data && (
        <CellEditor
          classId={classId}
          day={editorCell.day}
          period={periods.find((p) => p.id === editorCell.periodId)!}
          nextPeriodFree={(() => {
            const idx = teachable.findIndex((p) => p.id === editorCell.periodId)
            const next = teachable[idx + 1]
            return !!next && !draft.get(cellKey(editorCell.day, next.id))
          })()}
          current={draft.get(cellKey(editorCell.day, editorCell.periodId)) ?? null}
          subjects={data.subjects}
          electiveGroups={data.elective_groups}
          teachers={data.teachers}
          gradeTeacherIds={data.grade_teacher_ids}
          grade={data.class.grade}
          onClose={() => setEditorCell(null)}
          onClear={() => {
            setCell(editorCell.day, editorCell.periodId, null)
            setEditorCell(null)
          }}
          existingCustomLabels={[...customLabelStats.keys()]}
          customLabelCount={(label) => customLabelStats.get(label) ?? 0}
          onSave={(slot, asDouble, applyToAllLabel) => {
            if (applyToAllLabel && slot.kind === "custom" && slot.custom_label) {
              applyCustomAcrossLabel(editorCell.day, editorCell.periodId, slot)
            } else if (asDouble) {
              setDouble(editorCell.day, editorCell.periodId, slot)
            } else {
              setCell(editorCell.day, editorCell.periodId, slot)
            }
            setEditorCell(null)
          }}
        />
      )}

      {copyDayOpen && (
        <CopyDayDialog days={days} onClose={() => setCopyDayOpen(false)} onCopy={copyDay} />
      )}

      {summaryOpen && (
        <TimetableSummaryDialog
          draft={draft}
          days={days}
          teachable={teachable}
          gradeLabel={`Grade ${cls?.grade} - ${cls?.section}`}
          onClose={() => setSummaryOpen(false)}
        />
      )}

      {genOpen && data && (
        <AIGenerateDialog
          classId={classId}
          capacity={days.length * teachable.length}
          subjects={data.subjects}
          electiveGroups={data.elective_groups}
          hasExisting={draft.size > 0}
          session={effectiveSession}
          currentSlots={
            effectiveSession
              ? [...draft.entries()].map(([key, sl]) => {
                  const [day, periodId] = key.split("|")
                  return {
                    day_of_week: Number(day),
                    period_id: periodId,
                    kind: sl.kind,
                    class_subject_id: sl.class_subject_id ?? null,
                    custom_label: sl.custom_label ?? null,
                    elective_group_id: sl.elective_group_id ?? null,
                    block_id: sl.block_id ?? null,
                  }
                })
              : null
          }
          onClose={() => setGenOpen(false)}
          onSession={(sess) => setGenSession(sess)}
          onGenerated={(slots, issues, quality) => {
            setGenQuality(
              (quality as {
                variationScore: number
                breakdown?: Record<string, number>
                similarDays?: { days: number[]; similarity: number }[]
                concentratedTokens?: { token: string; entropy: number }[]
                candidatesTried?: number
                optimizerIterations?: number
              } | null) ?? null
            )
            // Failure contract: the server returns issues WITH an empty grid
            // when no hard-valid timetable could be produced (infeasible
            // requirements or generation failed). Keep the current draft
            // untouched — only show the diagnostics.
            if (slots.length === 0 && issues.length > 0) {
              setGenIssues(issues)
              setGenOpen(false)
              toast.error("Generation failed — see the notes below the grid")
              return
            }
            const map = new Map<string, SlotDraft>()
            for (const sl of slots) {
              map.set(cellKey(sl.day_of_week, sl.period_id), {
                kind: sl.kind,
                class_subject_id: sl.class_subject_id ?? undefined,
                subject_name:
                  sl.kind === "subject"
                    ? data.subjects.find((x) => x.class_subject_id === sl.class_subject_id)?.subject_name
                    : undefined,
                custom_label: sl.custom_label ?? undefined,
                elective_group_id: sl.elective_group_id ?? undefined,
                elective_label: sl.elective_label ?? undefined,
                teacher_id: sl.teacher_id,
                teacher_name: sl.teacher_id
                  ? data.teachers.find((t) => t.id === sl.teacher_id)?.full_name ?? null
                  : null,
                block_id: sl.block_id,
              })
            }
            pushHistory()
            setDraft(map)
            setDirty(true)
            setGenIssues([])
            setConflicts(new Map())
            setGenOpen(false)
            toast.success("Grid filled — review and save")
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI generation dialog — quotas + free-text requirements. The result lands
// in the builder DRAFT; saving still runs the clash validator.
// ─────────────────────────────────────────────────────────────────────────────

interface GeneratedSlot {
  day_of_week: number
  period_id: string
  kind: "subject" | "custom" | "elective"
  class_subject_id: string | null
  custom_label: string | null
  elective_group_id: string | null
  elective_label: string | null
  teacher_id: string | null
  block_id: string | null
}

interface GenSession {
  quotas: Record<string, number>
  electiveQuotas: Record<string, number>
  customRows: { label: string; quota: number }[]
}

function AIGenerateDialog({
  classId,
  capacity,
  subjects,
  electiveGroups,
  hasExisting,
  session,
  currentSlots,
  onClose,
  onSession,
  onGenerated,
}: {
  classId: string
  capacity: number
  subjects: BuilderSubject[]
  electiveGroups: ElectiveGroup[]
  hasExisting: boolean
  session: GenSession | null
  currentSlots:
    | {
        day_of_week: number
        period_id: string
        kind: string
        class_subject_id: string | null
        custom_label: string | null
        elective_group_id: string | null
        block_id: string | null
      }[]
    | null
  onClose: () => void
  onSession: (s: GenSession) => void
  onGenerated: (slots: GeneratedSlot[], issues: string[], quality: unknown) => void
}) {
  const isRefine = !!session
  // even split as the starting point, leaving a little room
  const slotsPerEntity = Math.max(
    1,
    Math.floor((capacity * 0.9) / Math.max(1, subjects.length + electiveGroups.length))
  )
  const [quotas, setQuotas] = useState<Record<string, number>>(
    session?.quotas ??
      Object.fromEntries(subjects.map((s) => [s.class_subject_id, slotsPerEntity]))
  )
  const [electiveQuotas, setElectiveQuotas] = useState<Record<string, number>>(
    session?.electiveQuotas ??
      Object.fromEntries(electiveGroups.map((g) => [g.elective_group_id, Math.min(slotsPerEntity, 6)]))
  )
  const [customRows, setCustomRows] = useState<{ label: string; quota: number }[]>(
    session?.customRows ?? [{ label: "PT", quota: 2 }]
  )
  const [requirements, setRequirements] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  const total =
    Object.values(quotas).reduce((a, b) => a + (b || 0), 0) +
    Object.values(electiveQuotas).reduce((a, b) => a + (b || 0), 0) +
    customRows.reduce((a, r) => a + (r.quota || 0), 0)

  const generate = async () => {
    if (total === 0) return toast.error("Set at least one quota")
    if (total > capacity) return toast.error(`Quotas total ${total} but the week has ${capacity} cells`)
    setIsGenerating(true)
    try {
      const res = await apiClient.post<{ slots: GeneratedSlot[]; issues: string[]; quality: unknown }>(
        `/api/timetable/${classId}/generate`,
        {
          quotas: subjects.map((s) => ({
            class_subject_id: s.class_subject_id,
            periods_per_week: quotas[s.class_subject_id] || 0,
          })),
          elective_quotas: electiveGroups.map((g) => ({
            elective_group_id: g.elective_group_id,
            periods_per_week: electiveQuotas[g.elective_group_id] || 0,
          })),
          custom_quotas: customRows
            .filter((r) => r.label.trim() && r.quota > 0)
            .map((r) => ({ label: r.label.trim(), periods_per_week: r.quota })),
          requirements,
          current_slots: isRefine ? currentSlots : null,
        }
      )
      onSession({ quotas, electiveQuotas, customRows })
      onGenerated(res.slots ?? [], res.issues ?? [], (res as { quality?: unknown }).quality as never)
    } catch (err) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !isGenerating && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isRefine ? "Refine with AI" : "Fill the grid with AI"}</DialogTitle>
          <DialogDescription>
            {isRefine
              ? "Describe what to change — the AI edits the current grid, keeping the rest in place. The configs below reflect the grid; adjust them if the split itself should change."
              : `Set weekly periods per subject and describe any rules. The result is a draft — review it, then save.${hasExisting ? " Generating replaces the current grid." : ""}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label className="text-xs">Weekly periods per subject</Label>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  total > capacity ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {total} / {capacity} cells
              </span>
            </div>
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {subjects.map((s) => (
                <div key={s.class_subject_id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs text-secondary-foreground">
                    {s.subject_name}
                    {s.default_teacher_name && (
                      <span className="text-muted-foreground"> · {s.default_teacher_name}</span>
                    )}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={quotas[s.class_subject_id] ?? 0}
                    onChange={(e) =>
                      setQuotas((prev) => ({
                        ...prev,
                        [s.class_subject_id]: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="h-7 w-16 text-xs"
                  />
                </div>
              ))}
              {electiveGroups.map((g) => (
                <div key={g.elective_group_id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs text-secondary-foreground">
                    {g.elective_group_name}
                    <span className="text-[10px] text-violet-600 dark:text-violet-400"> · elective</span>
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={electiveQuotas[g.elective_group_id] ?? 0}
                    onChange={(e) =>
                      setElectiveQuotas((prev) => ({
                        ...prev,
                        [g.elective_group_id]: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="h-7 w-16 text-xs"
                  />
                </div>
              ))}
              {customRows.map((r, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                  <Input
                    value={r.label}
                    onChange={(e) =>
                      setCustomRows((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))
                      )
                    }
                    placeholder="PT, Library…"
                    className="h-7 min-w-0 flex-1 text-xs"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={r.quota}
                    onChange={(e) =>
                      setCustomRows((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, quota: Math.max(0, Number(e.target.value)) } : x
                        )
                      )
                    }
                    className="h-7 w-16 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setCustomRows((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="Remove"
                  >
                    <XIcon className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-fit text-xs"
              onClick={() => setCustomRows((prev) => [...prev, { label: "", quota: 1 }])}
            >
              <PlusIcon className="size-3" />
              Add custom period
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">
              {isRefine ? "What should change?" : "Requirements (optional)"}
            </Label>
            <Textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
              placeholder={
                isRefine
                  ? "e.g. Move PT to Wednesday and Friday. Make the second Science class alternate days. Swap Maths and English on Monday."
                  : "e.g. Science lab as a continuous double once a week. No Maths in the last period. Hindi right after lunch."
              }
            />
          </div>

          <p className="text-[10px] text-muted-foreground">
            The AI respects other sections' timetables — your teachers won't be
            double-booked. Anything it can't satisfy comes back as a note for
            you to fix by hand.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={generate} disabled={isGenerating || total === 0}>
            {isGenerating ? (
              <>
                <CircleNotchIcon className="size-3.5 animate-spin" />
                Generating… (~30s)
              </>
            ) : (
              <>
                <SparkleIcon className="size-3.5" />
                {isRefine ? "Refine" : "Generate"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout switcher tiles — miniature previews of the two grid orientations,
// in the spirit of the settings page's theme cards.
// ─────────────────────────────────────────────────────────────────────────────

function LayoutTile({
  selected,
  onClick,
  label,
  variant,
}: {
  selected: boolean
  onClick: () => void
  label: string
  variant: "periods-rows" | "days-rows"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={
        variant === "periods-rows"
          ? "Periods as rows, days across the top"
          : "Days as rows, periods across the top"
      }
      className={cn(
        "group flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-all",
        selected
          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-background hover:bg-muted/50"
      )}
    >
      <span className="flex h-9 w-14 flex-col gap-0.5 overflow-hidden rounded-sm border border-border/60 bg-sidebar p-0.5">
        {variant === "periods-rows" ? (
          <>
            {/* header: days across the top */}
            <span className="flex gap-0.5">
              <span className="h-1 w-2.5 shrink-0 rounded-[1px] bg-muted-foreground/50" />
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} className="h-1 flex-1 rounded-[1px] bg-muted-foreground/30" />
              ))}
            </span>
            {/* period rows with a horizontal break band */}
            {[0, 1].map((r) => (
              <span key={r} className="flex flex-1 gap-0.5">
                <span className="w-2.5 shrink-0 rounded-[1px] bg-muted-foreground/25" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <span key={i} className="flex-1 rounded-[1px] bg-muted-foreground/15" />
                ))}
              </span>
            ))}
            <span className="h-0.5 w-full rounded-[1px] bg-primary/40" />
            <span className="flex flex-1 gap-0.5">
              <span className="w-2.5 shrink-0 rounded-[1px] bg-muted-foreground/25" />
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} className="flex-1 rounded-[1px] bg-muted-foreground/15" />
              ))}
            </span>
          </>
        ) : (
          <span className="flex flex-1 gap-0.5">
            {/* day labels down the left */}
            <span className="flex w-2.5 shrink-0 flex-col gap-0.5">
              <span className="h-1 rounded-[1px] bg-muted-foreground/50" />
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} className="flex-1 rounded-[1px] bg-muted-foreground/25" />
              ))}
            </span>
            {/* period columns with a vertical break band */}
            {[0, 1].map((c) => (
              <span key={c} className="flex flex-1 flex-col gap-0.5">
                <span className="h-1 rounded-[1px] bg-muted-foreground/30" />
                <span className="flex-1 rounded-[1px] bg-muted-foreground/15" />
              </span>
            ))}
            <span className="w-0.5 rounded-[1px] bg-primary/40" />
            {[0, 1].map((c) => (
              <span key={c} className="flex flex-1 flex-col gap-0.5">
                <span className="h-1 rounded-[1px] bg-muted-foreground/30" />
                <span className="flex-1 rounded-[1px] bg-muted-foreground/15" />
              </span>
            ))}
          </span>
        )}
      </span>
      <span
        className={cn(
          "text-[10px] font-medium",
          selected ? "text-primary" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cell editor dialog
// ─────────────────────────────────────────────────────────────────────────────

function CellEditor({
  classId,
  day,
  period,
  nextPeriodFree,
  current,
  subjects,
  electiveGroups,
  teachers,
  gradeTeacherIds,
  grade,
  existingCustomLabels,
  customLabelCount,
  onClose,
  onClear,
  onSave,
}: {
  classId: string
  day: number
  period: Period
  nextPeriodFree: boolean
  current: SlotDraft | null
  subjects: BuilderSubject[]
  electiveGroups: ElectiveGroup[]
  teachers: TeacherOption[]
  gradeTeacherIds: string[]
  grade: number
  existingCustomLabels: string[]
  customLabelCount: (label: string) => number
  onClose: () => void
  onClear: () => void
  onSave: (slot: SlotDraft, asDouble: boolean, applyToAllLabel?: boolean) => void
}) {
  const [kind, setKind] = useState<SlotDraft["kind"]>(current?.kind ?? "subject")
  const [classSubjectId, setClassSubjectId] = useState(current?.class_subject_id ?? "")
  const [teacherId, setTeacherId] = useState<string>(current?.teacher_id ?? "")
  const [customLabel, setCustomLabel] = useState(current?.custom_label ?? "PT")
  const [applyAll, setApplyAll] = useState(true)
  const [electiveGroupId, setElectiveGroupId] = useState(current?.elective_group_id ?? "")
  const [asDouble, setAsDouble] = useState(false)
  const [busy, setBusy] = useState<Record<string, string>>({})
  const [alignAfter, setAlignAfter] = useState(true)

  // busy teachers at this cell
  useEffect(() => {
    apiClient
      .get<{ busy: Record<string, string> }>(
        `/api/timetable/teacher-busy?day=${day}&period_id=${period.id}&exclude_class_id=${classId}`
      )
      .then((r) => setBusy(r.busy ?? {}))
      .catch(() => setBusy({}))
  }, [day, period.id, classId])

  // picking a subject defaults its teacher
  useEffect(() => {
    if (kind !== "subject" || !classSubjectId) return
    const s = subjects.find((x) => x.class_subject_id === classSubjectId)
    if (s && !current?.teacher_id) setTeacherId(s.default_teacher_id ?? "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classSubjectId, kind])

  const save = async () => {
    if (kind === "subject") {
      const s = subjects.find((x) => x.class_subject_id === classSubjectId)
      if (!s) return toast.error("Pick a subject")
      onSave(
        {
          kind,
          class_subject_id: s.class_subject_id,
          subject_name: s.subject_name,
          teacher_id: teacherId || null,
          teacher_name: teachers.find((t) => t.id === teacherId)?.full_name ?? null,
        },
        asDouble && nextPeriodFree
      )
    } else if (kind === "custom") {
      if (!customLabel.trim()) return toast.error("Give the period a label")
      const label = customLabel.trim()
      const others = customLabelCount(label) - (current?.custom_label === label ? 1 : 0)
      onSave(
        {
          kind,
          custom_label: label,
          teacher_id: teacherId || null,
          teacher_name: teachers.find((t) => t.id === teacherId)?.full_name ?? null,
        },
        asDouble && nextPeriodFree,
        applyAll && others > 0
      )
      if (applyAll && others > 0) {
        toast.success(
          `Teacher set on all ${others + 1} "${label}" periods this week`
        )
      }
    } else {
      const g = electiveGroups.find((x) => x.elective_group_id === electiveGroupId)
      if (!g) return toast.error("Pick the elective group")
      onSave(
        {
          kind,
          elective_group_id: g.elective_group_id,
          elective_label: g.elective_group_name,
          teacher_id: null,
          teacher_name: null,
        },
        false
      )
      if (alignAfter) {
        try {
          const res = await apiClient.post<{ results: { class: string; status: string }[] }>(
            "/api/timetable/align-elective",
            {
              grade,
              day_of_week: day,
              period_id: period.id,
              elective_group_id: g.elective_group_id,
              elective_label: g.elective_group_name,
              source_class_id: classId,
            }
          )
          const aligned = res.results.filter((r) => r.status === "aligned").length
          const blocked = res.results.filter((r) => r.status === "cell_occupied")
          if (aligned > 0) toast.success(`Elective aligned in ${aligned} sibling section${aligned > 1 ? "s" : ""}`)
          if (blocked.length > 0)
            toast.warning(`Cell occupied in ${blocked.map((b) => b.class).join(", ")} — align manually`)
        } catch (err) {
          if (err instanceof Error) toast.error(err.message)
        }
      }
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {DAY_NAMES[day]} · {period.name}
          </DialogTitle>
          <DialogDescription>
            {fmtTime(period.start_time.slice(0, 5))} –{" "}
            {fmtTime(period.end_time.slice(0, 5))}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
          {/* kind toggle */}
          <div className="flex items-center gap-1.5">
            {(
              [
                ["subject", "Subject"],
                ["elective", "Elective"],
                ["custom", "Custom"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                  kind === k
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background text-secondary-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {kind === "subject" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Subject</Label>
                <Select value={classSubjectId || undefined} onValueChange={setClassSubjectId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick a subject…" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.class_subject_id} value={s.class_subject_id}>
                        {s.subject_name}
                        {s.default_teacher_name ? ` · ${s.default_teacher_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TeacherPicker
                teachers={teachers}
                gradeTeacherIds={gradeTeacherIds}
                busy={busy}
                value={teacherId}
                onChange={setTeacherId}
              />
            </>
          )}

          {kind === "custom" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Class</Label>
                <CustomLabelCombobox
                  value={customLabel}
                  onChange={setCustomLabel}
                  existingLabels={existingCustomLabels}
                />
              </div>
              <TeacherPicker
                teachers={teachers}
                gradeTeacherIds={gradeTeacherIds}
                busy={busy}
                value={teacherId}
                onChange={setTeacherId}
                optionalNote="Optional — a lab handled by a teacher makes them busy here; PT with no teacher clashes with nothing."
              />
              {customLabelCount(customLabel.trim()) -
                (current?.custom_label === customLabel.trim() ? 1 : 0) >
                0 && (
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={applyAll}
                    onCheckedChange={(v) => setApplyAll(!!v)}
                    className="mt-0.5"
                  />
                  <span>
                    Also set this teacher for every "{customLabel.trim()}"
                    period on this section's week (
                    {customLabelCount(customLabel.trim()) -
                      (current?.custom_label === customLabel.trim() ? 1 : 0)}{" "}
                    more).
                  </span>
                </label>
              )}
            </>
          )}

          {kind === "elective" && (
            <>
              {electiveGroups.length === 0 ? (
                <p className="rounded-lg border border-border bg-sidebar/50 px-3 py-2.5 text-xs text-muted-foreground">
                  This class has no elective groups. Set them up in the class
                  editor first.
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Elective group</Label>
                    <Select
                      value={electiveGroupId || undefined}
                      onValueChange={setElectiveGroupId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick the group…" />
                      </SelectTrigger>
                      <SelectContent>
                        {electiveGroups.map((g) => (
                          <SelectItem key={g.elective_group_id} value={g.elective_group_id}>
                            {g.elective_group_name} ({g.options.join(" / ")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={alignAfter}
                      onCheckedChange={(v) => setAlignAfter(!!v)}
                      className="mt-0.5"
                    />
                    <span>
                      Also place this elective at the same time in every Grade{" "}
                      {grade} section, so the grade's students can regroup by
                      option.
                    </span>
                  </label>
                </>
              )}
            </>
          )}

          {kind !== "elective" && nextPeriodFree && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={asDouble} onCheckedChange={(v) => setAsDouble(!!v)} />
              Double period — also fill the next period (continuous lab/class)
            </label>
          )}
        </div>

        <DialogFooter className="gap-2">
          {current && (
            <Button
              variant="outline"
              className="mr-auto text-destructive hover:text-destructive"
              onClick={onClear}
            >
              <TrashIcon className="size-3.5" />
              Clear
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>
            <CaretRightIcon className="size-3.5" />
            Place
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TeacherPicker({
  teachers,
  gradeTeacherIds,
  busy,
  value,
  onChange,
  optionalNote,
}: {
  teachers: TeacherOption[]
  gradeTeacherIds: string[]
  busy: Record<string, string>
  value: string
  onChange: (v: string) => void
  optionalNote?: string
}) {
  const NONE = "__none__"
  const OTHER = "__other__"
  const [allOpen, setAllOpen] = useState(false)
  const [search, setSearch] = useState("")

  const gradeSet = new Set(gradeTeacherIds)
  // this grade's teachers first; a picked outsider stays visible in the list
  const primary = teachers.filter(
    (t) => gradeSet.has(t.id) || t.id === value
  )

  const filteredAll = teachers.filter(
    (t) =>
      !search.trim() ||
      t.full_name.toLowerCase().includes(search.trim().toLowerCase()) ||
      (t.department_name ?? "").toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">Teacher</Label>
      <Select
        value={value || NONE}
        onValueChange={(v) => {
          if (v === OTHER) {
            setSearch("")
            setAllOpen(true)
            return
          }
          onChange(v === NONE ? "" : v)
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>
            <span className="text-muted-foreground">No teacher</span>
          </SelectItem>
          {primary.map((t) => (
            <SelectItem key={t.id} value={t.id} disabled={!!busy[t.id]}>
              {t.full_name}
              {busy[t.id] ? ` — in ${busy[t.id]}` : ""}
            </SelectItem>
          ))}
          <SelectItem value={OTHER}>
            <span className="text-primary">Other teacher…</span>
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="text-[10px] text-muted-foreground">
        Showing this grade's teachers{optionalNote ? ` · ${optionalNote}` : "."}
      </p>

      {allOpen && (
        <Dialog open onOpenChange={(o) => !o && setAllOpen(false)}>
          <DialogContent className="flex max-h-[80vh] flex-col gap-0 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Pick any teacher</DialogTitle>
              <DialogDescription>
                The whole staff room — busy teachers are marked for this
                period.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 px-6 py-4">
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or department…"
              />
              <div className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto overscroll-contain rounded-lg border border-border">
                {filteredAll.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Nobody matches that.
                  </p>
                ) : (
                  filteredAll.map((t) => {
                    const isBusy = !!busy[t.id]
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          onChange(t.id)
                          setAllOpen(false)
                        }}
                        className={cn(
                          "flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors",
                          isBusy
                            ? "cursor-not-allowed opacity-50"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium text-secondary-foreground">
                            {t.full_name}
                            {gradeSet.has(t.id) && (
                              <span className="ml-1.5 text-[10px] text-primary">
                                this grade
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {t.department_name || "No department"}
                          </span>
                        </span>
                        {isBusy && (
                          <span className="shrink-0 text-[10px] text-amber-700 dark:text-amber-400">
                            in {busy[t.id]}
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Teacher load dialog — school-wide workload from SAVED timetables: weekly
// total and per-day counts per teacher, the sections they appear in, and any
// same-cell overlaps (which the save validator should have made impossible).
// ─────────────────────────────────────────────────────────────────────────────

interface TeacherLoadCell {
  day_of_week: number
  period_id: string
  class: string
  label: string
  is_draft: boolean
}

interface TeacherLoadRow {
  id: string
  full_name: string
  total: number
  per_day: Record<string, number>
  classes: string[]
  cells: TeacherLoadCell[]
}

interface TeacherClash {
  teacher_name: string
  day_of_week: number
  period_name: string
  classes: string[]
}

function TeacherLoadDialog({
  days,
  teachable,
  onClose,
}: {
  days: number[]
  teachable: Period[]
  onClose: () => void
}) {
  const periodsPerDay = teachable.length
  const [rows, setRows] = useState<TeacherLoadRow[] | null>(null)
  const [clashes, setClashes] = useState<TeacherClash[]>([])
  const [draftClasses, setDraftClasses] = useState<string[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    apiClient
      .get<{ teachers: TeacherLoadRow[]; clashes: TeacherClash[]; draft_classes?: string[] }>(
        "/api/timetable/teacher-load"
      )
      .then((res) => {
        setRows(res.teachers ?? [])
        setClashes(res.clashes ?? [])
        setDraftClasses(res.draft_classes ?? [])
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load"))
  }, [])

  // A day at 100% of teachable periods is back-to-back all day; ≥75% is heavy.
  const heavy = Math.max(1, Math.ceil(periodsPerDay * 0.75))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Teacher load</DialogTitle>
          <DialogDescription>
            Periods per teacher across every section — saved timetables plus
            unsaved drafts (a draft replaces its section's saved grid here,
            just as saving it would).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
          {loadError ? (
            <p className="text-sm text-muted-foreground">{loadError}</p>
          ) : rows === null ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved timetable slots yet — save a section first.
            </p>
          ) : (
            <>
              {clashes.length > 0 ? (
                <div className="flex flex-col gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-xs font-medium text-destructive">
                    {clashes.length} overlap{clashes.length > 1 ? "s" : ""} found — the
                    same teacher is in two sections at once:
                  </p>
                  {clashes.map((c, i) => (
                    <p key={i} className="flex items-start gap-1.5 text-xs text-destructive">
                      <WarningIcon className="mt-0.5 size-3 shrink-0" />
                      {c.teacher_name} — {DAY_NAMES[c.day_of_week]} {c.period_name}:{" "}
                      {c.classes.join(", ")}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/40">
                  <CheckCircleIcon
                    weight="fill"
                    className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  />
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    No overlaps — every teacher is in at most one class per period,
                    drafts included.
                  </p>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-sidebar">
                      <th className="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">
                        Teacher
                      </th>
                      {days.map((d) => (
                        <th
                          key={d}
                          className="w-11 border-b border-l border-border px-1 py-2 text-center font-medium text-muted-foreground"
                        >
                          {DAY_SHORT[d]}
                        </th>
                      ))}
                      <th className="w-14 border-b border-l border-border px-2 py-2 text-center font-medium text-muted-foreground">
                        / week
                      </th>
                      <th className="border-b border-l border-border px-3 py-2 text-left font-medium text-muted-foreground">
                        Sections
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => {
                      const expanded = expandedId === t.id
                      const cellMap = new Map<string, TeacherLoadCell[]>()
                      if (expanded) {
                        for (const c of t.cells) {
                          const k = `${c.day_of_week}|${c.period_id}`
                          if (!cellMap.has(k)) cellMap.set(k, [])
                          cellMap.get(k)!.push(c)
                        }
                      }
                      return (
                        <Fragment key={t.id}>
                          <tr
                            className="cursor-pointer hover:bg-muted/40"
                            onClick={() => setExpandedId(expanded ? null : t.id)}
                          >
                            <td className="border-b border-border px-3 py-2 font-medium text-foreground">
                              <span className="flex items-center gap-1">
                                <CaretRightIcon
                                  className={cn(
                                    "size-3 shrink-0 text-muted-foreground transition-transform",
                                    expanded && "rotate-90"
                                  )}
                                />
                                {t.full_name}
                              </span>
                            </td>
                            {days.map((d) => {
                              const n = t.per_day[String(d)] ?? 0
                              return (
                                <td
                                  key={d}
                                  className={cn(
                                    "border-b border-l border-border px-1 py-2 text-center tabular-nums",
                                    n === 0
                                      ? "text-muted-foreground/40"
                                      : n >= periodsPerDay
                                        ? "bg-destructive/10 font-semibold text-destructive"
                                        : n >= heavy
                                          ? "bg-amber-100 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                          : "text-foreground"
                                  )}
                                >
                                  {n === 0 ? "·" : n}
                                </td>
                              )
                            })}
                            <td className="border-b border-l border-border px-2 py-2 text-center font-semibold tabular-nums text-foreground">
                              {t.total}
                            </td>
                            <td className="border-b border-l border-border px-3 py-2 text-muted-foreground">
                              {t.classes.join(", ")}
                            </td>
                          </tr>
                          {expanded && (
                            <tr>
                              <td
                                colSpan={days.length + 3}
                                className="border-b border-border bg-sidebar/40 px-3 py-3"
                              >
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse text-[11px]">
                                    <thead>
                                      <tr>
                                        <th className="w-12 px-1 py-1 text-left font-medium text-muted-foreground">
                                          Day
                                        </th>
                                        {teachable.map((p) => (
                                          <th
                                            key={p.id}
                                            className="px-1 py-1 text-center font-medium text-muted-foreground"
                                          >
                                            P{p.period_number}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {days.map((d) => (
                                        <tr key={d}>
                                          <td className="px-1 py-1 font-medium text-secondary-foreground">
                                            {DAY_SHORT[d]}
                                          </td>
                                          {teachable.map((p) => {
                                            const here = cellMap.get(`${d}|${p.id}`) ?? []
                                            const isClash = here.length > 1
                                            return (
                                              <td
                                                key={p.id}
                                                className={cn(
                                                  "rounded px-1 py-1 text-center",
                                                  here.length === 0
                                                    ? "text-muted-foreground/30"
                                                    : isClash
                                                      ? "bg-destructive/15 font-semibold text-destructive"
                                                      : "text-foreground"
                                                )}
                                                title={here
                                                  .map(
                                                    (c) =>
                                                      `${c.class}${c.is_draft ? "*" : ""}${c.label ? ` — ${c.label}` : ""}`
                                                  )
                                                  .join(" / ")}
                                              >
                                                {here.length === 0
                                                  ? "·"
                                                  : here
                                                      .map((c) => `${c.class}${c.is_draft ? "*" : ""}`)
                                                      .join(" / ")}
                                              </td>
                                            )
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-muted-foreground">
                A day highlighted amber has {heavy}+ of {periodsPerDay} periods; red is
                every period of the day back-to-back.
                {draftClasses.length > 0 && (
                  <>
                    {" "}* counts an unsaved draft ({draftClasses.join(", ")}) — numbers
                    change if the draft is edited or discarded.
                  </>
                )}
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary dialog — how the week is split: per-subject weekly totals, the
// per-day distribution, and per-day load. Reads the current draft (saved or
// not), so it always reflects what's on screen.
// ─────────────────────────────────────────────────────────────────────────────

function TimetableSummaryDialog({
  draft,
  days,
  teachable,
  gradeLabel,
  onClose,
}: {
  draft: Map<string, SlotDraft>
  days: number[]
  teachable: Period[]
  gradeLabel: string
  onClose: () => void
}) {
  const rows = useMemo(() => {
    // Group cells by what occupies them. Key: subject/elective by id,
    // custom by label. A double period is two cells → counts as 2.
    const byKey = new Map<
      string,
      { name: string; teacher: string | null; kind: SlotDraft["kind"]; perDay: Map<number, number>; total: number }
    >()
    for (const [key, sl] of draft) {
      const day = Number(key.split("|")[0])
      const groupKey =
        sl.kind === "subject"
          ? `s:${sl.class_subject_id}`
          : sl.kind === "elective"
            ? `e:${sl.elective_group_id}`
            : `c:${sl.custom_label}`
      const name =
        sl.kind === "subject"
          ? sl.subject_name ?? "Subject"
          : sl.kind === "elective"
            ? sl.elective_label ?? "Elective"
            : sl.custom_label ?? "Activity"
      if (!byKey.has(groupKey)) {
        byKey.set(groupKey, {
          name,
          teacher: sl.teacher_name ?? null,
          kind: sl.kind,
          perDay: new Map(),
          total: 0,
        })
      }
      const row = byKey.get(groupKey)!
      row.perDay.set(day, (row.perDay.get(day) ?? 0) + 1)
      row.total += 1
      if (!row.teacher && sl.teacher_name) row.teacher = sl.teacher_name
    }
    return [...byKey.values()].sort(
      (a, b) => b.total - a.total || a.name.localeCompare(b.name)
    )
  }, [draft])

  const perDayTotals = useMemo(() => {
    const m = new Map<number, number>()
    for (const key of draft.keys()) {
      const day = Number(key.split("|")[0])
      m.set(day, (m.get(day) ?? 0) + 1)
    }
    return m
  }, [draft])

  const totalCells = days.length * teachable.length
  const filled = draft.size
  const free = totalCells - filled

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Weekly summary</DialogTitle>
          <DialogDescription>
            {gradeLabel} — how the {totalCells} periods of the week are split.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {filled} / {totalCells} periods filled
            </Badge>
            {free > 0 && (
              <Badge variant="outline" className="rounded-full text-[10px]">
                {free} free
              </Badge>
            )}
            <Badge variant="outline" className="rounded-full text-[10px]">
              {days.length} days × {teachable.length} periods
            </Badge>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-sidebar">
                  <th className="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">
                    Class
                  </th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className="w-11 border-b border-l border-border px-1 py-2 text-center font-medium text-muted-foreground"
                    >
                      {DAY_SHORT[d]}
                    </th>
                  ))}
                  <th className="w-14 border-b border-l border-border px-2 py-2 text-center font-medium text-muted-foreground">
                    / week
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.kind}:${row.name}`} className="hover:bg-muted/40">
                    <td className="border-b border-border px-3 py-2">
                      <span className="font-medium text-foreground">{row.name}</span>
                      {row.teacher && (
                        <span className="block text-[10px] text-muted-foreground">
                          {row.teacher}
                        </span>
                      )}
                    </td>
                    {days.map((d) => {
                      const n = row.perDay.get(d) ?? 0
                      return (
                        <td
                          key={d}
                          className={cn(
                            "border-b border-l border-border px-1 py-2 text-center tabular-nums",
                            n === 0 ? "text-muted-foreground/40" : "text-foreground",
                            n > 1 && "font-semibold"
                          )}
                        >
                          {n === 0 ? "·" : n}
                        </td>
                      )
                    })}
                    <td className="border-b border-l border-border px-2 py-2 text-center font-semibold tabular-nums text-foreground">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-sidebar/60">
                  <td className="px-3 py-2 font-medium text-muted-foreground">Per day</td>
                  {days.map((d) => (
                    <td
                      key={d}
                      className="border-l border-border px-1 py-2 text-center font-medium tabular-nums text-secondary-foreground"
                    >
                      {perDayTotals.get(d) ?? 0}
                    </td>
                  ))}
                  <td className="border-l border-border px-2 py-2 text-center font-semibold tabular-nums text-foreground">
                    {filled}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy-day dialog
// ─────────────────────────────────────────────────────────────────────────────

function CopyDayDialog({
  days,
  onClose,
  onCopy,
}: {
  days: number[]
  onClose: () => void
  onCopy: (from: number, to: number[]) => void
}) {
  const [from, setFrom] = useState<number>(days[0])
  const [to, setTo] = useState<number[]>([])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Copy a day</DialogTitle>
          <DialogDescription>
            Copies every slot of one day onto other days (replacing them) —
            in this draft only, nothing saves yet.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Copy from</Label>
            <Select value={String(from)} onValueChange={(v) => setFrom(Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {days.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {DAY_NAMES[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Paste onto</Label>
            <div className="flex flex-wrap gap-1.5">
              {days
                .filter((d) => d !== from)
                .map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setTo((prev) =>
                        prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                      )
                    }
                    aria-pressed={to.includes(d)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-all",
                      to.includes(d)
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background text-secondary-foreground hover:bg-muted"
                    )}
                  >
                    {DAY_SHORT[d]}
                  </button>
                ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onCopy(from, to)} disabled={to.length === 0}>
            <CopyIcon className="size-3.5" />
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// Custom-class label picker — a select over the labels this grid already
// uses plus the common defaults. Typing filters; typing something new offers
// "Add" so one-off classes stay possible without polluting the quick list.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CUSTOM_LABELS = ["PT", "Library", "Music", "Art", "Science Lab", "Assembly", "CCA"]

function CustomLabelCombobox({
  value,
  onChange,
  existingLabels,
}: {
  value: string
  onChange: (v: string) => void
  existingLabels: string[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const options = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const l of [...existingLabels, ...DEFAULT_CUSTOM_LABELS]) {
      const key = l.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(l.trim())
    }
    return out
  }, [existingLabels])

  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options
  const exactMatch = options.some((o) => o.toLowerCase() === q)

  const pick = (label: string) => {
    onChange(label)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!value}
          className="w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
        >
          {value || "Pick a class…"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <div className="border-b border-border p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) {
                e.preventDefault()
                pick(filtered[0] ?? query.trim())
              }
            }}
            placeholder="Filter or type a new class…"
            className="h-8 text-xs"
            maxLength={80}
          />
        </div>
        <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto p-1">
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => pick(o)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                value.trim().toLowerCase() === o.toLowerCase()
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-secondary-foreground hover:bg-muted"
              )}
            >
              {o}
            </button>
          ))}
          {q && !exactMatch && (
            <button
              type="button"
              onClick={() => pick(query.trim())}
              className="rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-primary transition-colors hover:bg-muted"
            >
              ＋ Add "{query.trim()}"
            </button>
          )}
          {filtered.length === 0 && !q && (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">No classes yet — type to add one.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Teacher view — "My schedule" (their own week across sections) with a
// switch to any section's full timetable. Strictly read-only: teachers see,
// admins build.
// ─────────────────────────────────────────────────────────────────────────────

interface MyScheduleSlot {
  day_of_week: number
  period_id: string
  kind: string
  label: string
  class: { id: string; grade: number; section: string }
}

interface ClassGridData {
  slots: {
    day_of_week: number
    period_id: string
    kind: string
    class_subject_id: string | null
    custom_label: string | null
    elective_label: string | null
    teacher_id: string | null
  }[]
  subjects: { class_subject_id: string; subject_name: string }[]
  teachers: { id: string; full_name: string }[]
}

function TeacherTimetableView() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [weekSettings, setWeekSettings] = useState<WeekSettings | undefined>()
  const [mySlots, setMySlots] = useState<MyScheduleSlot[] | null>(null)
  const [classes, setClasses] = useState<
    { id: string; grade: number; section: string }[]
  >([])
  const [view, setView] = useState<"mine" | "class">("mine")
  const [classId, setClassId] = useState("")
  const [classCache, setClassCache] = useState<
    Record<string, ClassGridData | "loading">
  >({})
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      apiClient.get<{ periods: Period[] }>("/api/timetable/periods"),
      apiClient.get<{ slots: MyScheduleSlot[] }>("/api/timetable/my-schedule"),
      apiClient.get<{ classes: { id: string; grade: number; section: string }[] }>(
        "/api/classes"
      ),
      apiClient
        .get<{ week_settings?: WeekSettings }>("/api/calendar")
        .catch(() => ({ week_settings: undefined })),
    ])
      .then(([p, mine, cls, cal]) => {
        setPeriods(p.periods ?? [])
        setMySlots(mine.slots ?? [])
        setClasses(
          (cls.classes ?? []).sort(
            (a, b) => a.grade - b.grade || a.section.localeCompare(b.section)
          )
        )
        setWeekSettings(cal.week_settings)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      )
  }, [])

  // lazy-load a section's grid when picked
  useEffect(() => {
    if (view !== "class" || !classId || classCache[classId]) return
    const id = classId
    setClassCache((prev) => ({ ...prev, [id]: "loading" }))
    apiClient
      .get<ClassGridData>(`/api/timetable/${id}`)
      .then((res) =>
        setClassCache((prev) => ({
          ...prev,
          [id]: {
            slots: res.slots ?? [],
            subjects: res.subjects ?? [],
            teachers: res.teachers ?? [],
          },
        }))
      )
      .catch(() =>
        setClassCache((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, classId, classCache])

  const days = workingDayNumbers(weekSettings)
  const today = new Date().getDay()

  const myByCell = useMemo(() => {
    const m = new Map<string, MyScheduleSlot>()
    for (const s of mySlots ?? []) m.set(`${s.day_of_week}|${s.period_id}`, s)
    return m
  }, [mySlots])
  const myWeekTotal = mySlots?.length ?? 0

  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>
  }
  if (mySlots === null || periods.length === 0) {
    return <Skeleton className="h-72 w-full rounded-xl" />
  }

  const selected = classId ? classCache[classId] : undefined
  const cellBase =
    "border-b border-l border-border px-1.5 py-1.5 text-center align-middle"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-border bg-background p-0.5">
          {(
            [
              { key: "mine", label: "My schedule" },
              { key: "class", label: "Class timetable" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              aria-pressed={view === t.key}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs transition-colors",
                view === t.key
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {view === "mine" && (
          <Badge variant="secondary" className="rounded-full text-[10px]">
            {myWeekTotal} period{myWeekTotal === 1 ? "" : "s"} / week
          </Badge>
        )}
      </div>

      {view === "class" && (
        <div className="flex flex-wrap gap-1.5">
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setClassId(c.id)}
              aria-pressed={classId === c.id}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                classId === c.id
                  ? "border-primary/40 bg-primary/10 font-medium text-primary"
                  : "border-border bg-background text-secondary-foreground hover:bg-muted"
              )}
            >
              {c.grade}-{c.section}
            </button>
          ))}
        </div>
      )}

      {view === "mine" ? (
        myWeekTotal === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background px-5 py-12 text-center">
            <Sticker name="sleep" size={96} />
            <p className="text-sm text-muted-foreground">
              Nothing on your timetable yet — it appears here once the admin
              publishes section timetables.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse bg-background text-xs">
              <thead>
                <tr className="bg-sidebar">
                  <th className="sticky left-0 z-10 w-16 border-b border-border bg-sidebar px-2 py-2 text-left font-medium text-muted-foreground after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border">
                    Day
                  </th>
                  {periods.map((p) =>
                    p.is_break ? (
                      <th
                        key={p.id}
                        className="w-8 border-b border-l border-border bg-sidebar/80 px-1 py-2 align-middle"
                      >
                        <span className="mx-auto block text-[9px] font-medium tracking-wide text-muted-foreground/70 uppercase [writing-mode:vertical-rl]">
                          {p.name}
                        </span>
                      </th>
                    ) : (
                      <th
                        key={p.id}
                        className="min-w-24 border-b border-l border-border px-1 py-2 text-center font-medium text-muted-foreground"
                      >
                        {p.name}
                        <span className="block text-[9px] font-normal text-muted-foreground/70">
                          {fmtTime(p.start_time.slice(0, 5))}
                        </span>
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d} className={cn(d === today && "bg-primary/[0.04]")}>
                    <td className="sticky left-0 z-10 border-b border-border bg-background px-2 py-2 font-medium text-secondary-foreground after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border">
                      {DAY_SHORT[d]}
                      {d === today && (
                        <span className="block text-[9px] font-normal text-primary">
                          today
                        </span>
                      )}
                    </td>
                    {periods.map((p) => {
                      if (p.is_break) {
                        return (
                          <td
                            key={p.id}
                            className="border-b border-l border-border bg-sidebar/60 px-0.5"
                          />
                        )
                      }
                      const slot = myByCell.get(`${d}|${p.id}`)
                      if (!slot) {
                        return (
                          <td key={p.id} className={cn(cellBase, "text-muted-foreground/30")}>
                            ·
                          </td>
                        )
                      }
                      return (
                        <td key={p.id} className={cellBase}>
                          <span className="block font-medium text-secondary-foreground">
                            {slot.label}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {slot.class.grade}-{slot.class.section}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : !classId ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background px-5 py-12 text-center">
          <Sticker name="point" size={96} />
          <p className="text-sm text-muted-foreground">
            Pick a section above to see its full timetable.
          </p>
        </div>
      ) : !selected || selected === "loading" ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : selected.slots.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background px-5 py-12 text-center">
          <Sticker name="sleep" size={96} />
          <p className="text-sm text-muted-foreground">
            This section has no published timetable yet.
          </p>
        </div>
      ) : (
        (() => {
          const subjectName = new Map(
            selected.subjects.map((s) => [s.class_subject_id, s.subject_name])
          )
          const teacherName = new Map(
            selected.teachers.map((t) => [t.id, t.full_name])
          )
          const byCell = new Map(
            selected.slots.map((sl) => [`${sl.day_of_week}|${sl.period_id}`, sl])
          )
          return (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse bg-background text-xs">
                <thead>
                  <tr className="bg-sidebar">
                    <th className="sticky left-0 z-10 w-16 border-b border-border bg-sidebar px-2 py-2 text-left font-medium text-muted-foreground after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border">
                      Day
                    </th>
                    {periods.map((p) =>
                      p.is_break ? (
                        <th
                          key={p.id}
                          className="w-8 border-b border-l border-border bg-sidebar/80 px-1 py-2 align-middle"
                        >
                          <span className="mx-auto block text-[9px] font-medium tracking-wide text-muted-foreground/70 uppercase [writing-mode:vertical-rl]">
                            {p.name}
                          </span>
                        </th>
                      ) : (
                        <th
                          key={p.id}
                          className="min-w-24 border-b border-l border-border px-1 py-2 text-center font-medium text-muted-foreground"
                        >
                          {p.name}
                          <span className="block text-[9px] font-normal text-muted-foreground/70">
                            {fmtTime(p.start_time.slice(0, 5))}
                          </span>
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d} className={cn(d === today && "bg-primary/[0.04]")}>
                      <td className="sticky left-0 z-10 border-b border-border bg-background px-2 py-2 font-medium text-secondary-foreground after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border">
                        {DAY_SHORT[d]}
                      </td>
                      {periods.map((p) => {
                        if (p.is_break) {
                          return (
                            <td
                              key={p.id}
                              className="border-b border-l border-border bg-sidebar/60 px-0.5"
                            />
                          )
                        }
                        const sl = byCell.get(`${d}|${p.id}`)
                        if (!sl) {
                          return (
                            <td
                              key={p.id}
                              className={cn(cellBase, "text-muted-foreground/30")}
                            >
                              ·
                            </td>
                          )
                        }
                        const label =
                          sl.kind === "subject"
                            ? subjectName.get(sl.class_subject_id ?? "") ?? "Subject"
                            : sl.kind === "custom"
                              ? sl.custom_label
                              : sl.elective_label
                        const teacher = sl.teacher_id
                          ? teacherName.get(sl.teacher_id)
                          : null
                        return (
                          <td key={p.id} className={cellBase}>
                            <span className="block font-medium text-secondary-foreground">
                              {label}
                            </span>
                            {teacher && (
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {teacher}
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()
      )}
    </div>
  )
}
