import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  CalendarCheckIcon,
  CalendarDotsIcon,
  ChalkboardTeacherIcon,
  CircleNotchIcon,
  GraduationCapIcon,
  ClockIcon,
  GearSixIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Sticker } from "@/components/shared/sticker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BellScheduleSetup,
  type Period,
  type WeekSettings,
} from "@/modules/timetable/pages/timetable-page"
import { FormBuilder } from "@/modules/setup/components/form-builder"
import { AcademicYearCard } from "@/modules/setup/components/academic-year-card"

// ─────────────────────────────────────────────────────────────────────────────
// /setup — the school admin's configuration home: working week, bell
// schedule, and the custom form fields for students and teachers. System
// fields (the ones PaperHint's flows depend on) render locked; only custom
// fields can be added, edited, or removed.
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    key: "year",
    label: "Academic year",
    icon: CalendarCheckIcon,
    hint: "Open year & past years",
  },
  {
    key: "week",
    label: "Working week",
    icon: CalendarDotsIcon,
    hint: "Week start & working days",
  },
  {
    key: "bell",
    label: "Bell timing",
    icon: ClockIcon,
    hint: "Periods & breaks",
  },
  {
    key: "student-form",
    label: "Student form",
    icon: GraduationCapIcon,
    hint: "Fields on the student form",
  },
  {
    key: "teacher-form",
    label: "Teacher form",
    icon: ChalkboardTeacherIcon,
    hint: "Fields on the teacher form",
  },
] as const

type SectionKey = (typeof SECTIONS)[number]["key"]

export function SetupPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const navigate = useNavigate()
  const { section } = useParams<{ section: string }>()
  const active: SectionKey = SECTIONS.some((s) => s.key === section)
    ? (section as SectionKey)
    : "year"

  if (!isAdmin) {
    return (
      <div
        className={cn(
          PAGE_GUTTER,
          PAGE_TOP,
          "flex min-h-full flex-col items-center justify-center gap-4 pb-12"
        )}
      >
        <Sticker name="peek" size={96} />
        <p className="text-base font-medium text-secondary-foreground">
          School setup is for admins
        </p>
      </div>
    )
  }

  return (
    // Fixed-height settings shell: the page and the section nav never
    // scroll — only the active section's content pane does.
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "flex h-full min-h-0 flex-col gap-6 overflow-hidden"
      )}
    >
      <PageHeader
        icon={GearSixIcon}
        title="School setup"
        description="The academic year, working week, bell schedule, and the fields on your forms."
      />

      {/* Level 2 — sections as tabs. Six of them, under the seven-tab rule
          (docs/modules/00-principles.md); a side panel here would be a second
          vertical rail beside the app's own. */}
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        <nav
          aria-label="School setup sections"
          className="-mb-px flex shrink-0 gap-1 overflow-x-auto border-b border-border"
        >
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => navigate(`/setup/${s.key}`, { replace: true })}
              aria-current={active === s.key ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-3 pb-2.5 text-sm whitespace-nowrap transition-colors",
                active === s.key
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <s.icon className="size-4 shrink-0" />
              {s.label}
            </button>
          ))}
        </nav>

        {/* Active section — the only scroll container on the page (the form
            builder scrolls its own preview pane instead) */}
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1",
            active === "student-form" || active === "teacher-form"
              ? "flex flex-col"
              : "overflow-y-auto pb-12"
          )}
        >
          {active === "year" && <AcademicYearCard />}
          {active === "week" && <WorkingWeekCard />}
          {active === "bell" && <BellScheduleCard />}
          {active === "student-form" && <FormBuilder entity="student" />}
          {active === "teacher-form" && <FormBuilder entity="teacher" />}
        </div>
      </div>
    </div>
  )
}

// ── Working week ─────────────────────────────────────────────────────────────

function WorkingWeekCard() {
  const [weekStart, setWeekStart] = useState<string>("")
  const [workingDays, setWorkingDays] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    apiClient
      .get<{ week_settings: WeekSettings }>("/api/calendar/week-settings")
      .then((res) => {
        setWeekStart(res.week_settings?.week_start ?? "monday")
        setWorkingDays(String(res.week_settings?.working_days ?? 6))
      })
      .catch(() => {
        setWeekStart("monday")
        setWorkingDays("6")
      })
      .finally(() => setIsLoading(false))
  }, [])

  const save = async () => {
    setIsSaving(true)
    try {
      await apiClient.patch("/api/calendar/week-settings", {
        week_start: weekStart,
        working_days: Number(workingDays),
      })
      toast.success("Working week saved")
    } catch (err) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
      <div className="flex items-center gap-2">
        <CalendarDotsIcon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Working week</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Drives every week-shaped grid — the timetable, and how "second week of
        July" rows in an uploaded calendar turn into dates.
      </p>
      {isLoading ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Week starts on</Label>
            <Select value={weekStart} onValueChange={setWeekStart}>
              <SelectTrigger className="w-40">
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
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 days</SelectItem>
                <SelectItem value="6">6 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} disabled={isSaving}>
            {isSaving ? (
              <CircleNotchIcon className="size-4 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
        </div>
      )}
    </section>
  )
}

// ── Bell schedule ────────────────────────────────────────────────────────────

function BellScheduleCard() {
  const [periods, setPeriods] = useState<Period[] | null>(null)
  const [weekSettings, setWeekSettings] = useState<WeekSettings | undefined>()

  const load = useCallback(() => {
    Promise.all([
      apiClient.get<{ periods: Period[] }>("/api/timetable/periods"),
      apiClient
        .get<{ week_settings: WeekSettings }>("/api/calendar/week-settings")
        .catch(() => ({ week_settings: undefined })),
    ])
      .then(([p, w]) => {
        setPeriods(p.periods ?? [])
        setWeekSettings(w.week_settings)
      })
      .catch(() => setPeriods([]))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
      <div className="flex items-center gap-2">
        <ClockIcon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Bell schedule</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Changing period times updates every timetable. Removing a period is
        blocked while any timetable still uses it.
      </p>
      {periods === null ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : (
        <BellScheduleSetup
          initial={periods}
          weekSettings={weekSettings}
          embedded
          onSaved={load}
        />
      )}
    </section>
  )
}
