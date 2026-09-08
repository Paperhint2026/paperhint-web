import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import {
  CalendarDotsIcon,
  CalendarBlankIcon,
  ClockIcon,
  GearSixIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CircleNotchIcon,
  EyeIcon,
  EyeSlashIcon,
  ListBulletsIcon,
  PencilSimpleIcon,
  PlusIcon,
  SquaresFourIcon,
  TrashIcon,
  CheckIcon,
  FadersIcon,
  GraduationCapIcon,
  TagIcon,
  UploadSimpleIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import {
  TimeSelectField,
  formatTimeLabel,
} from "@/components/shared/time-select-field"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { getCurrentAcademicYear } from "@/lib/academic-year"
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
import { Calendar } from "@/components/ui/calendar"
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
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  FilterChip,
  FilterChipGroup,
  FilterFieldHeader,
} from "@/components/shared/filter-controls"
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
// Types + constants
// ─────────────────────────────────────────────────────────────────────────────

type EventType =
  | "exam"
  | "holiday"
  | "activity"
  | "meeting"
  | "deadline"
  | "reopening"
  | "other"

interface CalendarMeta {
  id: string
  academic_year: string
  status: "processing" | "ready" | "failed"
  is_published: boolean
  source_path: string | null
}

interface CalendarEvent {
  id: string
  title: string
  description: string | null
  event_type: EventType
  starts_on: string
  ends_on: string | null
  grades: number[] | null
  source: "extracted" | "manual"
  start_time: string | null
  end_time: string | null
}

interface WeekSettings {
  week_start: "monday" | "sunday"
  working_days: 5 | 6
}

interface CalendarResponse {
  calendar: CalendarMeta | null
  events: CalendarEvent[]
  academic_year: string | null
  week_settings?: WeekSettings
}

interface YearRow {
  academic_year: string
  is_published: boolean
  status: string
}

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "exam", label: "Exam" },
  { value: "holiday", label: "Holiday" },
  { value: "activity", label: "Activity" },
  { value: "meeting", label: "Meeting" },
  { value: "deadline", label: "Deadline" },
  { value: "reopening", label: "Reopening" },
  { value: "other", label: "Other" },
]

/** Chip + dot colors per event type — light and dark. */
const TYPE_STYLE: Record<EventType, { chip: string; dot: string }> = {
  exam: {
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  holiday: {
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  activity: {
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  meeting: {
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  deadline: {
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  reopening: {
    chip: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  other: {
    chip: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
}

const gradesLabel = (grades: number[] | null) =>
  grades && grades.length > 0 ? `Grades ${grades.join(", ")}` : "Whole school"

/** The months of an academic year (June -> May). */
function academicYearMonths(academicYear: string): Date[] {
  const start = Number(academicYear.split("-")[0])
  if (!Number.isFinite(start)) return []
  return Array.from({ length: 12 }, (_, i) => addMonths(new Date(start, 5, 1), i))
}

/** Which weekdays the school works, from its week settings. getDay():
 *  0=Sun..6=Sat. Monday-start 6-day => Mon..Sat; Sunday-start 5-day =>
 *  Sun..Thu; etc. */
function workingDaySet(settings?: WeekSettings): Set<number> {
  const start = settings?.week_start === "sunday" ? 0 : 1
  const days = settings?.working_days === 5 ? 5 : 6
  const set = new Set<number>()
  for (let i = 0; i < days; i++) set.add((start + i) % 7)
  return set
}

function eventCoversDay(
  e: CalendarEvent,
  day: Date,
  workingDays?: Set<number>
): boolean {
  const start = parseISO(e.starts_on)
  // Explicit dates always show — a Sunday tournament is real. For ranges
  // ("exam 11th-18th") the school chose the two ENDPOINTS deliberately, so
  // those always render too; only the off days IN BETWEEN are excluded
  // (nothing happens on the Sunday inside an exam window).
  if (!e.ends_on) return isSameDay(start, day)
  const end = parseISO(e.ends_on)
  if (isSameDay(start, day) || isSameDay(end, day)) return true
  if (workingDays && !workingDays.has(day.getDay())) return false
  return isWithinInterval(day, { start, end })
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-40 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="flex min-h-20 flex-col gap-1 bg-background p-2">
            <Skeleton className="h-3 w-5" />
            {i % 5 === 1 && <Skeleton className="h-4 w-full rounded" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CalendarPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const { setHeaderActions } = useHeaderActions()

  const [data, setData] = useState<CalendarResponse | null>(null)
  const [years, setYears] = useState<YearRow[]>([])
  const [selectedYear, setSelectedYear] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const [view, setView] = useState<"month" | "list">("month")
  const [month, setMonth] = useState<Date | null>(null)

  // filters
  const [selectedTypes, setSelectedTypes] = useState<EventType[]>([])
  const [selectedGrades, setSelectedGrades] = useState<number[]>([])
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const activeFilterCount =
    (selectedTypes.length > 0 ? 1 : 0) +
    (selectedGrades.length > 0 ? 1 : 0) +
    (fromDate || toDate ? 1 : 0)

  const clearFilters = () => {
    setSelectedTypes([])
    setSelectedGrades([])
    setFromDate("")
    setToDate("")
  }

  const [uploadOpen, setUploadOpen] = useState(false)
  const [eventDialog, setEventDialog] = useState<
    | { mode: "create"; date?: string }
    | { mode: "edit"; event: CalendarEvent }
    | null
  >(null)
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null)
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const fetchCalendar = useCallback(async (year?: string, silent = false) => {
    if (!silent) setIsLoading(true)
    setError("")
    try {
      const q = year ? `?academic_year=${encodeURIComponent(year)}` : ""
      const [cal, yrs] = await Promise.all([
        apiClient.get<CalendarResponse>(`/api/calendar${q}`),
        apiClient.get<{ years: YearRow[] }>("/api/calendar/years"),
      ])
      setData(cal)
      setYears(yrs.years ?? [])
      if (cal.academic_year) setSelectedYear(cal.academic_year)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCalendar()
  }, [fetchCalendar])

  // A background extraction is running — poll quietly until the status
  // flips, then tell the admin what arrived.
  const wasProcessing = useRef(false)
  useEffect(() => {
    const status = data?.calendar?.status
    if (status === "processing") {
      wasProcessing.current = true
      const t = setTimeout(() => fetchCalendar(selectedYear, true), 5000)
      return () => clearTimeout(t)
    }
    if (wasProcessing.current && status === "ready") {
      wasProcessing.current = false
      toast.success(
        `Extraction finished — ${data?.events.length ?? 0} events. Review the dates, then publish.`
      )
    }
    if (wasProcessing.current && status === "failed") {
      wasProcessing.current = false
      toast.error("Extraction failed — try re-uploading, or add events manually")
    }
  }, [data, selectedYear, fetchCalendar])

  // header action: Upload (admin)
  useEffect(() => {
    if (!isAdmin) {
      setHeaderActions(null)
      return
    }
    setHeaderActions(
      <Button size="lg" className="rounded-full" onClick={() => setUploadOpen(true)}>
        <UploadSimpleIcon className="size-3.5" />
        <span className="hidden sm:inline">Upload calendar</span>
      </Button>
    )
    return () => setHeaderActions(null)
  }, [isAdmin, setHeaderActions])

  const calendar = data?.calendar ?? null
  const allEvents = useMemo(() => data?.events ?? [], [data])

  const events = useMemo(() => {
    return allEvents.filter((e) => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(e.event_type)) {
        return false
      }
      // whole-school events (grades null) apply to every grade
      if (
        selectedGrades.length > 0 &&
        e.grades !== null &&
        !e.grades.some((g) => selectedGrades.includes(g))
      ) {
        return false
      }
      const end = e.ends_on ?? e.starts_on
      if (fromDate && end < fromDate) return false
      if (toDate && e.starts_on > toDate) return false
      return true
    })
  }, [allEvents, selectedTypes, selectedGrades, fromDate, toDate])
  const activeYear = data?.academic_year ?? null

  const months = useMemo(
    () => (activeYear ? academicYearMonths(activeYear) : []),
    [activeYear]
  )

  // default month: today if inside the year, else the first month
  useEffect(() => {
    if (months.length === 0) {
      setMonth(null)
      return
    }
    const today = new Date()
    const inYear = months.find((m) => isSameMonth(m, today))
    setMonth(inYear ?? months[0])
  }, [months])

  const monthIndex = month ? months.findIndex((m) => isSameMonth(m, month)) : -1

  const publish = async (next: boolean) => {
    if (!calendar) return
    setIsPublishing(true)
    try {
      await apiClient.post("/api/calendar/publish", {
        calendar_id: calendar.id,
        publish: next,
      })
      toast.success(next ? "Calendar published — teachers can see it now" : "Calendar unpublished")
      await fetchCalendar(selectedYear)
    } catch (err) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setIsPublishing(false)
    }
  }

  const confirmDelete = async () => {
    if (!eventToDelete) return
    setIsDeleting(true)
    try {
      await apiClient.delete(`/api/calendar/events/${eventToDelete.id}`)
      toast.success("Event deleted")
      setEventToDelete(null)
      await fetchCalendar(selectedYear)
    } catch (err) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const fitViewport = !!calendar && !error

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex flex-col gap-5",
        // month view fills the viewport exactly — the grid flexes, the page
        // never scrolls; list view scrolls as usual
        fitViewport ? "h-full overflow-hidden pb-4" : "min-h-full pb-12"
      )}
    >
      <PageHeader
        icon={CalendarDotsIcon}
        title="Calendar"
        description="The school year at a glance — exams, holidays, activities, and meetings."
      />

      <LoadingSwap
        loading={isLoading}
        skeleton={<CalendarSkeleton />}
        className="min-h-0 flex-1"
      >
        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <Sticker name="worried" size={88} />
            <div className="flex max-w-[360px] flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-secondary-foreground">
                Couldn't load the calendar
              </p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" onClick={() => fetchCalendar(selectedYear)}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {/* controls row */}
            <div className="flex flex-wrap items-center gap-2">
              {years.length > 0 && (
                <Select
                  value={selectedYear || undefined}
                  onValueChange={(y) => {
                    setSelectedYear(y)
                    fetchCalendar(y)
                  }}
                >
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder="Year…" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y.academic_year} value={y.academic_year}>
                        {y.academic_year}
                        {!y.is_published ? " (draft)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {calendar && (
                <div className="flex items-center gap-1.5">
                  {(["month", "list"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      aria-pressed={view === v}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-all",
                        view === v
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-background text-secondary-foreground hover:bg-muted"
                      )}
                    >
                      {v === "month" ? (
                        <SquaresFourIcon className="size-3.5" />
                      ) : (
                        <ListBulletsIcon className="size-3.5" />
                      )}
                      {v}
                    </button>
                  ))}
                </div>
              )}

              {calendar && (
                <CalendarFiltersPopover
                  selectedTypes={selectedTypes}
                  onToggleType={(t) =>
                    setSelectedTypes((prev) =>
                      prev.includes(t)
                        ? prev.filter((x) => x !== t)
                        : [...prev, t]
                    )
                  }
                  selectedGrades={selectedGrades}
                  onToggleGrade={(g) =>
                    setSelectedGrades((prev) =>
                      prev.includes(g)
                        ? prev.filter((x) => x !== g)
                        : [...prev, g].sort((a, b) => a - b)
                    )
                  }
                  fromDate={fromDate}
                  toDate={toDate}
                  onFromDate={setFromDate}
                  onToDate={setToDate}
                  activeCount={activeFilterCount}
                  onClearAll={clearFilters}
                  resultLabel={`${events.length} of ${allEvents.length} events`}
                />
              )}

              {isAdmin && calendar && (
                <div className="ml-auto flex items-center gap-2">
                  <WeekSettingsPopover
                    settings={data?.week_settings}
                    onSaved={() => fetchCalendar(selectedYear)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full text-xs"
                    onClick={() => setEventDialog({ mode: "create" })}
                  >
                    <PlusIcon className="size-3.5" />
                    Add event
                  </Button>
                  <Button
                    size="sm"
                    variant={calendar.is_published ? "outline" : "default"}
                    className="h-8 rounded-full text-xs"
                    onClick={() => publish(!calendar.is_published)}
                    disabled={isPublishing}
                  >
                    {isPublishing ? (
                      <CircleNotchIcon className="size-3.5 animate-spin" />
                    ) : calendar.is_published ? (
                      <EyeSlashIcon className="size-3.5" />
                    ) : (
                      <EyeIcon className="size-3.5" />
                    )}
                    {calendar.is_published ? "Unpublish" : "Publish"}
                  </Button>
                </div>
              )}
            </div>

            {/* active filter chips */}
            {calendar && activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-dashed border-border pt-3">
                {selectedTypes.length > 0 && (
                  <FilterChipGroup icon={TagIcon} label="Type">
                    {selectedTypes.map((t) => (
                      <FilterChip
                        key={t}
                        label={EVENT_TYPES.find((x) => x.value === t)?.label ?? t}
                        onRemove={() =>
                          setSelectedTypes((prev) => prev.filter((x) => x !== t))
                        }
                      />
                    ))}
                  </FilterChipGroup>
                )}
                {selectedGrades.length > 0 && (
                  <FilterChipGroup icon={GraduationCapIcon} label="Grades">
                    {selectedGrades.map((g) => (
                      <FilterChip
                        key={g}
                        label={`Grade ${g}`}
                        onRemove={() =>
                          setSelectedGrades((prev) => prev.filter((x) => x !== g))
                        }
                      />
                    ))}
                  </FilterChipGroup>
                )}
                {(fromDate || toDate) && (
                  <FilterChipGroup icon={CalendarDotsIcon} label="Between">
                    <FilterChip
                      label={`${fromDate ? format(parseISO(fromDate), "d MMM yy") : "start"} – ${toDate ? format(parseISO(toDate), "d MMM yy") : "end"}`}
                      onRemove={() => {
                        setFromDate("")
                        setToDate("")
                      }}
                    />
                  </FilterChipGroup>
                )}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <XIcon className="size-3" />
                  Clear all
                </button>
              </div>
            )}

            {/* processing banner */}
            {calendar?.status === "processing" && (
              <div className="flex items-center gap-2.5 rounded-xl border border-border bg-sidebar/50 px-4 py-3 text-xs text-secondary-foreground">
                <CircleNotchIcon className="size-4 animate-spin text-primary" />
                <span>
                  <span className="font-medium">Extracting events from the uploaded calendar…</span>{" "}
                  A large planner takes a minute or two. You can leave this
                  page — the draft will be waiting when it's done.
                </span>
              </div>
            )}

            {calendar?.status === "failed" && (
              <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-secondary-foreground">
                <WarningIcon className="size-4 shrink-0 text-destructive" />
                <span>
                  <span className="font-medium">The last extraction failed.</span>{" "}
                  Re-upload the file, or add events manually — existing events
                  are untouched.
                </span>
              </div>
            )}

            {/* draft banner */}
            {isAdmin && calendar && calendar.status !== "processing" && !calendar.is_published && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <WarningIcon className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <span className="font-medium">Draft — teachers can't see this yet.</span>{" "}
                  Review the extracted events (dates especially), fix anything
                  the OCR misread, then publish.
                </span>
              </div>
            )}

            {!calendar ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-xl border border-border bg-background px-5 py-14 text-center">
                <Sticker name="cloud" size={110} />
                <div className="flex max-w-[400px] flex-col gap-1">
                  <p className="text-base font-medium text-secondary-foreground">
                    No calendar for {activeYear ?? "this year"} yet
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isAdmin
                      ? "Upload the school's academic calendar PDF and the events will be extracted for your review — or add events by hand."
                      : "Your admin hasn't published the academic calendar yet. Check back soon."}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Button onClick={() => setUploadOpen(true)}>
                      <UploadSimpleIcon className="size-3.5" />
                      Upload calendar
                    </Button>
                    <Button variant="outline" onClick={() => setEventDialog({ mode: "create" })}>
                      <PlusIcon className="size-3.5" />
                      Add event manually
                    </Button>
                  </div>
                )}
              </div>
            ) : view === "month" && month ? (
              <MonthGrid
                month={month}
                events={events}
                onAddAt={(date) => setEventDialog({ mode: "create", date })}
                onShowDetail={(e) => setDetailEvent(e)}
                weekStartsOn={data?.week_settings?.week_start === "sunday" ? 0 : 1}
                weekSettings={data?.week_settings}
                onPrev={() => monthIndex > 0 && setMonth(months[monthIndex - 1])}
                onNext={() =>
                  monthIndex < months.length - 1 && setMonth(months[monthIndex + 1])
                }
                hasPrev={monthIndex > 0}
                hasNext={monthIndex < months.length - 1}
                isAdmin={isAdmin}
              />
            ) : (
              <EventList
                events={events}
                isAdmin={isAdmin}
                onEdit={(e) => setEventDialog({ mode: "edit", event: e })}
                onDelete={(e) => setEventToDelete(e)}
                onShowDetail={(e) => setDetailEvent(e)}
              />
            )}
          </div>
        )}
      </LoadingSwap>

      {isAdmin && (
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          defaultYear={activeYear ?? getCurrentAcademicYear()}
          onUploaded={(year) => fetchCalendar(year)}
        />
      )}

      {isAdmin && eventDialog && activeYear && (
        <EventDialog
          mode={eventDialog.mode}
          event={eventDialog.mode === "edit" ? eventDialog.event : null}
          defaultDate={eventDialog.mode === "create" ? eventDialog.date : undefined}
          academicYear={activeYear}
          onClose={() => setEventDialog(null)}
          onSaved={() => {
            setEventDialog(null)
            fetchCalendar(selectedYear)
          }}
        />
      )}

      {detailEvent && (
        <EventDetailDialog
          event={detailEvent}
          isAdmin={isAdmin}
          onClose={() => setDetailEvent(null)}
          onEdit={(e) => {
            setDetailEvent(null)
            setEventDialog({ mode: "edit", event: e })
          }}
          onDelete={(e) => {
            setDetailEvent(null)
            setEventToDelete(e)
          }}
        />
      )}

      <AlertDialog
        open={!!eventToDelete}
        onOpenChange={(open) => !open && setEventToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event?</AlertDialogTitle>
            <AlertDialogDescription>
              "{eventToDelete?.title}" will be removed from the calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
            >
              {isDeleting ? (
                <>
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <TrashIcon className="size-3.5" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Month grid
// ─────────────────────────────────────────────────────────────────────────────

function MonthGrid({
  month,
  events,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  isAdmin,
  onShowDetail,
  onAddAt,
  weekStartsOn,
  weekSettings,
}: {
  month: Date
  events: CalendarEvent[]
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
  isAdmin: boolean
  onShowDetail: (e: CalendarEvent) => void
  onAddAt: (isoDate: string) => void
  weekStartsOn: 0 | 1
  weekSettings?: WeekSettings
}) {
  const [openDay, setOpenDay] = useState<string | null>(null)
  const workingDays = useMemo(() => workingDaySet(weekSettings), [weekSettings])
  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn })
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [month, weekStartsOn])

  const today = new Date()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          {format(month, "MMMM yyyy")}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onPrev}
            disabled={!hasPrev}
            aria-label="Previous month"
          >
            <CaretLeftIcon className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onNext}
            disabled={!hasNext}
            aria-label="Next month"
          >
            <CaretRightIcon className="size-3.5" />
          </Button>
        </div>
        {/* legend */}
        <div className="ml-auto hidden flex-wrap items-center gap-2.5 sm:flex">
          {EVENT_TYPES.filter((t) => t.value !== "other").map((t) => (
            <span
              key={t.value}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              <span className={cn("size-1.5 rounded-full", TYPE_STYLE[t.value].dot)} />
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border">
        <div className="grid shrink-0 grid-cols-7 border-b border-border bg-sidebar text-center">
          {(weekStartsOn === 0
            ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
          ).map((d) => (
            <div key={d} className="py-1.5 text-[11px] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-px bg-border">
          {days.map((day) => {
            const inMonth = isSameMonth(day, month)
            const dayEvents = inMonth ? events.filter((e) => eventCoversDay(e, day, workingDays)) : []
            const isToday = isSameDay(day, today)
            return (
              <div
                key={day.toISOString()}
                onClick={() => {
                  if (isAdmin && inMonth) onAddAt(format(day, "yyyy-MM-dd"))
                }}
                className={cn(
                  "flex min-h-0 flex-col gap-1 overflow-hidden bg-background p-1.5",
                  !inMonth && "bg-muted/40",
                  isAdmin && inMonth && "cursor-pointer transition-colors hover:bg-primary/[0.04]"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums",
                    isToday
                      ? "bg-primary font-semibold text-primary-foreground"
                      : inMonth
                        ? "text-secondary-foreground"
                        : "text-muted-foreground/50"
                  )}
                >
                  {format(day, "d")}
                </span>
                <div className="flex flex-col gap-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        onShowDetail(e)
                      }}
                      title={`${e.title} · ${gradesLabel(e.grades)}`}
                      className={cn(
                        "cursor-pointer truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight font-medium hover:opacity-80",
                        TYPE_STYLE[e.event_type].chip
                      )}
                    >
                      {e.start_time ? `${e.start_time.slice(0, 5)} ` : ""}
                      {e.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <Popover
                      open={openDay === format(day, "yyyy-MM-dd")}
                      onOpenChange={(o) =>
                        setOpenDay(o ? format(day, "yyyy-MM-dd") : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          onClick={(ev) => ev.stopPropagation()}
                          className="rounded px-1 py-0.5 text-left text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          +{dayEvents.length - 3} more
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="center"
                        className="w-64 p-0"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <div className="flex flex-col items-center gap-0.5 border-b border-border py-2">
                          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                            {format(day, "EEE")}
                          </span>
                          <span className="text-xl font-semibold text-foreground tabular-nums">
                            {format(day, "d")}
                          </span>
                        </div>
                        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto overscroll-contain p-2">
                          {dayEvents.map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => {
                                setOpenDay(null)
                                onShowDetail(e)
                              }}
                              className={cn(
                                "cursor-pointer truncate rounded px-2 py-1 text-left text-[11px] font-medium hover:opacity-80",
                                TYPE_STYLE[e.event_type].chip
                              )}
                            >
                              {e.start_time ? `${e.start_time.slice(0, 5)} ` : ""}
                              {e.title}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// List view
// ─────────────────────────────────────────────────────────────────────────────

function EventList({
  events,
  isAdmin,
  onEdit,
  onDelete,
  onShowDetail,
}: {
  events: CalendarEvent[]
  isAdmin: boolean
  onEdit: (e: CalendarEvent) => void
  onDelete: (e: CalendarEvent) => void
  onShowDetail: (e: CalendarEvent) => void
}) {
  const byMonth = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = format(parseISO(e.starts_on), "MMMM yyyy")
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return [...map.entries()]
  }, [events])

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background px-5 py-10 text-center">
        <Sticker name="sleep" size={88} />
        <p className="text-sm text-muted-foreground">No events yet.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pb-4">
      {byMonth.map(([monthLabel, list]) => (
        <section key={monthLabel} className="flex flex-col gap-2">
          <h3 className="sticky top-0 z-10 inline-flex w-fit items-center gap-2 rounded-full bg-sidebar px-2.5 py-1 text-xs font-medium text-secondary-foreground ring-1 ring-border/60">
            <CalendarDotsIcon className="size-3.5 text-muted-foreground" />
            {monthLabel}
            <span className="font-normal text-muted-foreground tabular-nums">
              {list.length}
            </span>
          </h3>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
            {list.map((e) => (
              <div
                key={e.id}
                onClick={() => onShowDetail(e)}
                className="group flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-muted/30"
              >
                <span className="w-28 shrink-0 text-xs text-muted-foreground tabular-nums">
                  {format(parseISO(e.starts_on), "dd MMM")}
                  {e.ends_on && ` – ${format(parseISO(e.ends_on), "dd MMM")}`}
                  {e.start_time && (
                    <span className="block text-[10px] text-muted-foreground/70">
                      {e.start_time.slice(0, 5)}
                      {e.end_time && ` – ${e.end_time.slice(0, 5)}`}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                    TYPE_STYLE[e.event_type].chip
                  )}
                >
                  {e.event_type}
                </span>
                <span className="min-w-40 flex-1 text-sm font-medium text-secondary-foreground">
                  {e.title}
                  {e.description && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {e.description}
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {gradesLabel(e.grades)}
                </span>
                {e.source === "extracted" && (
                  <Badge
                    variant="secondary"
                    className="rounded-full px-1.5 py-0 text-[10px] text-muted-foreground"
                  >
                    extracted
                  </Badge>
                )}
                {isAdmin && (
                  <span
                    className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(e)}
                      aria-label={`Edit ${e.title}`}
                    >
                      <PencilSimpleIcon className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(e)}
                      aria-label={`Delete ${e.title}`}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Week settings (admin) — drives how "second week of July" style rows in an
// uploaded calendar resolve to dates. Future extractions only.
// ─────────────────────────────────────────────────────────────────────────────

function WeekSettingsPopover({
  settings,
  onSaved,
}: {
  settings?: WeekSettings
  onSaved: () => void
}) {
  const [weekStart, setWeekStart] = useState(settings?.week_start ?? "monday")
  const [workingDays, setWorkingDays] = useState(
    String(settings?.working_days ?? 6)
  )
  const [isSaving, setIsSaving] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setWeekStart(settings?.week_start ?? "monday")
      setWorkingDays(String(settings?.working_days ?? 6))
    }
  }, [open, settings])

  const save = async () => {
    setIsSaving(true)
    try {
      await apiClient.patch("/api/calendar/week-settings", {
        week_start: weekStart,
        working_days: Number(workingDays),
      })
      toast.success("Week settings saved — applies to future uploads")
      setOpen(false)
      onSaved()
    } catch (err) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 rounded-full text-xs">
          <GearSixIcon className="size-3.5" />
          Week settings
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">Working week</p>
            <p className="text-xs text-muted-foreground">
              How "second week of July" style rows in an uploaded calendar
              turn into dates. Applies to future uploads.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Week starts on</Label>
            <Select
              value={weekStart}
              onValueChange={(v) => setWeekStart(v as "monday" | "sunday")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monday">Monday</SelectItem>
                <SelectItem value="sunday">Sunday</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Working days per week</Label>
            <Select value={workingDays} onValueChange={setWorkingDays}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 days</SelectItem>
                <SelectItem value="5">5 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={save} disabled={isSaving}>
            {isSaving ? (
              <>
                <CircleNotchIcon className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload dialog
// ─────────────────────────────────────────────────────────────────────────────

function UploadDialog({
  open,
  onOpenChange,
  defaultYear,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultYear: string
  onUploaded: (year: string) => void
}) {
  const [year, setYear] = useState(defaultYear)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setYear(defaultYear)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ""
    }
  }, [open, defaultYear])

  const yearOptions = useMemo(() => {
    const start = Number(defaultYear.split("-")[0]) || new Date().getFullYear()
    const long = /^\d{4}-\d{4}$/.test(defaultYear)
    const fmt = (s: number) =>
      long ? `${s}-${s + 1}` : `${s}-${String((s + 1) % 100).padStart(2, "0")}`
    return [fmt(start - 1), fmt(start), fmt(start + 1)]
  }, [defaultYear])

  const upload = async () => {
    if (!file || !year) {
      toast.error("Pick the calendar file and the academic year")
      return
    }
    setIsUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("academic_year", year)
      await apiClient.post("/api/calendar/upload", form)
      toast.success("Upload received — extracting events in the background")
      onOpenChange(false)
      onUploaded(year)
    } catch (err) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload academic calendar</DialogTitle>
          <DialogDescription>
            PDF or image of the year calendar. Events are extracted for your
            review — nothing is visible to teachers until you publish.
            Re-uploading replaces extracted events; manually added ones stay.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Academic year</Label>
            <Select value={year || undefined} onValueChange={setYear}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                    {y === defaultYear ? " (current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Calendar file</Label>
            <Input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={upload} disabled={isUploading || !file}>
            {isUploading ? (
              <>
                <CircleNotchIcon className="size-3.5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <UploadSimpleIcon className="size-3.5" />
                Upload & extract
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Filters — event type, grades, date range. Same popover anatomy as the
// list pages' PageToolbar filters.
// ─────────────────────────────────────────────────────────────────────────────

function CalendarFiltersPopover({
  selectedTypes,
  onToggleType,
  selectedGrades,
  onToggleGrade,
  fromDate,
  toDate,
  onFromDate,
  onToDate,
  activeCount,
  onClearAll,
  resultLabel,
}: {
  selectedTypes: EventType[]
  onToggleType: (t: EventType) => void
  selectedGrades: number[]
  onToggleGrade: (g: number) => void
  fromDate: string
  toDate: string
  onFromDate: (v: string) => void
  onToDate: (v: string) => void
  activeCount: number
  onClearAll: () => void
  resultLabel: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 rounded-full text-xs transition-colors",
            activeCount > 0 &&
              "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
          )}
        >
          <FadersIcon className="size-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-80 gap-0 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <FadersIcon className="size-4 text-muted-foreground" />
            Filters
          </p>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear all
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">None applied</span>
          )}
        </div>

        <div className="flex max-h-[60vh] flex-col gap-5 overflow-auto p-4">
          {/* event type */}
          <div className="flex flex-col gap-2">
            <FilterFieldHeader
              icon={TagIcon}
              label="Event type"
              count={selectedTypes.length}
              onClear={() => selectedTypes.forEach((t) => onToggleType(t))}
            />
            <div className="flex flex-wrap gap-1.5">
              {EVENT_TYPES.map((t) => {
                const selected = selectedTypes.includes(t.value)
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => onToggleType(t.value)}
                    aria-pressed={selected}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all duration-150",
                      selected
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background text-secondary-foreground hover:bg-muted"
                    )}
                  >
                    {selected ? (
                      <CheckIcon weight="bold" className="size-3" />
                    ) : (
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          TYPE_STYLE[t.value].dot
                        )}
                      />
                    )}
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* grades */}
          <div className="flex flex-col gap-2">
            <FilterFieldHeader
              icon={GraduationCapIcon}
              label="Grades"
              count={selectedGrades.length}
              onClear={() => selectedGrades.forEach((g) => onToggleGrade(g))}
            />
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onToggleGrade(g)}
                  aria-pressed={selectedGrades.includes(g)}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border text-[11px] font-medium transition-colors tabular-nums",
                    selectedGrades.includes(g)
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Whole-school events always show — they apply to every grade.
            </p>
          </div>

          {/* date range */}
          <div className="flex flex-col gap-2">
            <FilterFieldHeader
              icon={CalendarDotsIcon}
              label="Date range"
              count={fromDate || toDate ? 1 : 0}
              onClear={() => {
                onFromDate("")
                onToDate("")
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <DatePickerField
                value={fromDate}
                onChange={onFromDate}
                placeholder="From"
                dateFormat="d MMM yyyy"
                clearable
              />
              <DatePickerField
                value={toDate}
                onChange={onToDate}
                placeholder="To"
                fromDate={fromDate || undefined}
                dateFormat="d MMM yyyy"
                clearable
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-sidebar px-4 py-2.5 text-xs text-muted-foreground">
          <span>{resultLabel}</span>
          <PopoverClose asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              Done
            </Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Event detail card — what a chip click opens. Read for everyone; edit and
// delete live here for admins (Google Calendar's event card, in our theme).
// ─────────────────────────────────────────────────────────────────────────────

function EventDetailDialog({
  event,
  isAdmin,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent
  isAdmin: boolean
  onClose: () => void
  onEdit: (e: CalendarEvent) => void
  onDelete: (e: CalendarEvent) => void
}) {
  const dateLabel = event.ends_on
    ? `${format(parseISO(event.starts_on), "EEE, d MMM")} – ${format(parseISO(event.ends_on), "EEE, d MMM yyyy")}`
    : format(parseISO(event.starts_on), "EEEE, d MMMM yyyy")

  const timeLabel = event.start_time
    ? `${formatTimeLabel(event.start_time.slice(0, 5))}${event.end_time ? ` – ${formatTimeLabel(event.end_time.slice(0, 5))}` : ""}`
    : "All day"

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-sm" showCloseButton={false}>
        {/* action row */}
        <div className="flex items-center justify-end gap-0.5 px-3 pt-3">
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit(event)}
                aria-label="Edit event"
              >
                <PencilSimpleIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(event)}
                aria-label="Delete event"
              >
                <TrashIcon className="size-4" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-3 px-5 pt-1 pb-5">
          {/* title with type swatch */}
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1 size-3.5 shrink-0 rounded",
                TYPE_STYLE[event.event_type].dot
              )}
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogTitle className="text-base leading-snug font-semibold text-foreground">
                {event.title}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{dateLabel}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 pl-6.5">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ClockIcon className="size-4 shrink-0" />
              {timeLabel}
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <GraduationCapIcon className="size-4 shrink-0" />
              {gradesLabel(event.grades)}
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground capitalize">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  TYPE_STYLE[event.event_type].chip
                )}
              >
                {event.event_type}
              </span>
              {event.source === "extracted" && (
                <Badge
                  variant="secondary"
                  className="rounded-full px-1.5 py-0 text-[10px] text-muted-foreground"
                >
                  extracted
                </Badge>
              )}
            </p>
            {event.description && (
              <p className="text-sm text-secondary-foreground">
                {event.description}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DSM field pieces — same date picker as the student form (Popover +
// Calendar), and a Select-based time picker to match.
// ─────────────────────────────────────────────────────────────────────────────

function DatePickerField({
  value,
  onChange,
  placeholder = "Pick a date",
  fromDate,
  clearable = false,
  dateFormat = "PPP",
}: {
  value: string
  onChange: (iso: string) => void
  placeholder?: string
  fromDate?: string
  clearable?: boolean
  /** date-fns format for the button label; use "d MMM yyyy" in tight spots */
  dateFormat?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!value}
          className="w-full min-w-0 justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
        >
          <CalendarBlankIcon className="size-4 shrink-0" />
          <span className="truncate">
            {value
              ? format(new Date(value + "T00:00:00"), dateFormat)
              : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? new Date(value + "T00:00:00") : undefined}
          disabled={
            fromDate ? { before: new Date(fromDate + "T00:00:00") } : undefined
          }
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : "")
            setOpen(false)
          }}
          captionLayout="dropdown"
        />
        {clearable && value && (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => {
                onChange("")
                setOpen(false)
              }}
            >
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Event add/edit dialog
// ─────────────────────────────────────────────────────────────────────────────

function EventDialog({
  mode,
  event,
  defaultDate,
  academicYear,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit"
  event: CalendarEvent | null
  defaultDate?: string
  academicYear: string
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(event?.title ?? "")
  const [description, setDescription] = useState(event?.description ?? "")
  const [eventType, setEventType] = useState<EventType>(event?.event_type ?? "other")
  const [startsOn, setStartsOn] = useState(event?.starts_on ?? defaultDate ?? "")
  const [endsOn, setEndsOn] = useState(event?.ends_on ?? "")
  const [startTime, setStartTime] = useState(event?.start_time?.slice(0, 5) ?? "")
  const [endTime, setEndTime] = useState(event?.end_time?.slice(0, 5) ?? "")
  const [grades, setGrades] = useState<number[]>(event?.grades ?? [])
  const [isSaving, setIsSaving] = useState(false)

  const toggleGrade = (g: number) =>
    setGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].sort((a, b) => a - b)
    )

  const save = async () => {
    if (!title.trim() || !startsOn) {
      toast.error("Title and start date are required")
      return
    }
    if (endsOn && endsOn < startsOn) {
      toast.error("End date can't be before the start date")
      return
    }
    if (endTime && !startTime) {
      toast.error("An end time needs a start time")
      return
    }
    if (startTime && endTime && !endsOn && endTime <= startTime) {
      toast.error("End time must be after the start time")
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        event_type: eventType,
        starts_on: startsOn,
        ends_on: endsOn || null,
        start_time: startTime || null,
        end_time: endTime || null,
        grades: grades.length > 0 ? grades : null,
      }
      if (mode === "create") {
        await apiClient.post("/api/calendar/events", {
          ...payload,
          academic_year: academicYear,
        })
        toast.success("Event added")
      } else if (event) {
        await apiClient.patch(`/api/calendar/events/${event.id}`, payload)
        toast.success("Event updated")
      }
      onSaved()
    } catch (err) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add event" : "Edit event"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? `Added to the ${academicYear} calendar.`
              : event?.source === "extracted"
                ? "Extracted from the uploaded calendar — fix anything the OCR misread."
                : "Manually added event."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. First Term Examination"
              maxLength={300}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={eventType}
                onValueChange={(v) => setEventType(v as EventType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn("size-2 rounded-full", TYPE_STYLE[t.value].dot)}
                        />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Grades</Label>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGrade(g)}
                    aria-pressed={grades.includes(g)}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border text-[10px] font-medium transition-colors tabular-nums",
                      grades.includes(g)
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                None selected = whole school
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Starts on</Label>
              <DatePickerField value={startsOn} onChange={setStartsOn} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Ends on (optional)</Label>
              <DatePickerField
                value={endsOn ?? ""}
                onChange={setEndsOn}
                placeholder="Same day"
                fromDate={startsOn || undefined}
                clearable
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Start time (optional)</Label>
                <TimeSelectField
                  value={startTime}
                  onChange={(v) => {
                    setStartTime(v)
                    if (!v) setEndTime("")
                  }}
                  placeholder="All day"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">End time (optional)</Label>
                <TimeSelectField
                  value={endTime}
                  onChange={setEndTime}
                  placeholder="—"
                  disabled={!startTime}
                  minTime={startTime || undefined}
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Leave times empty for an all-day event.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Anything teachers should know"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isSaving}>
            {isSaving ? (
              <>
                <CircleNotchIcon className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : mode === "create" ? (
              <>
                <PlusIcon className="size-3.5" />
                Add event
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
