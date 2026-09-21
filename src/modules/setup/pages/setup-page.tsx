import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  CalendarCheckIcon,
  CalendarDotsIcon,
  ClipboardTextIcon,
  ChalkboardTeacherIcon,
  CircleNotchIcon,
  GraduationCapIcon,
  ClockIcon,
  GearSixIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { showError } from "@/lib/show-error"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    key: "attendance",
    label: "Attendance",
    icon: ClipboardTextIcon,
    hint: "Per period or per day",
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
          {active === "attendance" && <AttendanceModeCard />}
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
      showError(err)
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

/* ── Setup › Attendance ─────────────────────────────────────────────────────
   The school opts for how the student roll is taken (founder, 2026-09-18):
   per period (each period's teacher) or once per day (a teacher of the
   class). Teachers' own check-in is unaffected by the mode. */

type TeacherCheckin = "admin_only" | "button" | "geo" | "photo_geo"

function AttendanceModeCard() {
  const [mode, setMode] = useState<"per_period" | "per_day" | null>(null)
  const [checkin, setCheckin] = useState<TeacherCheckin>("button")
  const [schoolLoc, setSchoolLoc] = useState<{ lat: number; lng: number; radius_m: number } | null>(null)
  const [autoApprove, setAutoApprove] = useState(true)
  const [autoMins, setAutoMins] = useState("15")
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")
  const [radius, setRadius] = useState("500")

  useEffect(() => {
    apiClient
      .get<{
        attendance_mode: "per_period" | "per_day"
        teacher_checkin: TeacherCheckin
        school_location: { lat: number; lng: number; radius_m: number } | null
        sub_auto_approve: boolean
        sub_auto_approve_mins: number
      }>("/api/attendance/settings")
      .then((r) => {
        setMode(r.attendance_mode)
        setCheckin(r.teacher_checkin)
        setSchoolLoc(r.school_location)
        setAutoApprove(r.sub_auto_approve)
        setAutoMins(String(r.sub_auto_approve_mins ?? 15))
        if (r.school_location) {
          setLat(String(r.school_location.lat))
          setLng(String(r.school_location.lng))
          setRadius(String(r.school_location.radius_m))
        }
      })
      .catch(() => setMode("per_period"))
  }, [])

  const save = async (next: "per_period" | "per_day") => {
    const prev = mode
    setMode(next)
    setSaving(true)
    try {
      await apiClient.put("/api/attendance/settings", {
        attendance_mode: next,
      })
      toast.success(
        next === "per_period"
          ? "Attendance is now taken every period"
          : "Attendance is now taken once a day"
      )
    } catch (e) {
      setMode(prev)
      toast.error(e instanceof Error ? e.message : "Could not save")
    } finally {
      setSaving(false)
    }
  }

  const saveCheckin = async (next: TeacherCheckin) => {
    const prev = checkin
    setCheckin(next)
    setSaving(true)
    try {
      await apiClient.put("/api/attendance/settings", { teacher_checkin: next })
      toast.success("Teacher check-in updated")
    } catch (e) {
      setCheckin(prev)
      toast.error(e instanceof Error ? e.message : "Could not save")
    } finally {
      setSaving(false)
    }
  }

  const fillCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("This browser has no location access")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6))
        setLng(pos.coords.longitude.toFixed(6))
        setLocating(false)
      },
      () => {
        setLocating(false)
        toast.error("Location was denied — allow it, or paste coordinates from Google Maps")
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const locValid = (() => {
    const la = Number(lat), ln = Number(lng), r = Number(radius)
    return Number.isFinite(la) && Math.abs(la) <= 90 && Number.isFinite(ln) && Math.abs(ln) <= 180 && Number.isFinite(r) && r >= 50 && r <= 5000
  })()

  const saveSchoolLocation = async () => {
    if (!locValid) return
    const loc = { lat: Number(lat), lng: Number(lng), radius_m: Number(radius) }
    setSaving(true)
    try {
      await apiClient.put("/api/attendance/settings", { school_location: loc })
      setSchoolLoc(loc)
      toast.success("School location saved — check-ins are now range-checked")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    } finally {
      setSaving(false)
    }
  }

  const OPTIONS = [
    {
      key: "per_period" as const,
      title: "Every period",
      body: "Each period's teacher takes the roll for that period — the fullest record, and the one substitutions will lean on.",
    },
    {
      key: "per_day" as const,
      title: "Once a day",
      body: "One roll per section per day, taken by a teacher of that class — lighter for schools that only track daily presence.",
    },
  ]

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
      <div className="flex items-center gap-2">
        <ClipboardTextIcon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          Student attendance
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        How the student roll is taken. Existing registers keep their record if
        you switch; the marking screens follow the new choice from the next
        roll.
      </p>
      {mode === null ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              disabled={saving}
              onClick={() => mode !== o.key && save(o.key)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors",
                mode === o.key
                  ? "border-primary/40 bg-primary/5"
                  : "border-border hover:bg-muted/60"
              )}
            >
              <span
                className={cn(
                  "text-sm font-medium",
                  mode === o.key ? "text-primary" : "text-foreground"
                )}
              >
                {o.title}
              </span>
              <span className="text-xs text-muted-foreground">{o.body}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 border-t border-border pt-4">
        <h2 className="text-sm font-semibold text-foreground">
          Teacher check-in
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        How a teacher is marked present for the day. The office can always
        correct the staff roll, whatever you pick.
      </p>
      {mode === null ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {CHECKIN_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                disabled={saving}
                onClick={() => checkin !== o.key && saveCheckin(o.key)}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors",
                  checkin === o.key
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:bg-muted/60"
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium",
                    checkin === o.key ? "text-primary" : "text-foreground"
                  )}
                >
                  {o.title}
                </span>
                <span className="text-xs text-muted-foreground">{o.body}</span>
              </button>
            ))}
          </div>
          {(checkin === "geo" || checkin === "photo_geo") && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <span className="text-xs text-muted-foreground">
                {schoolLoc
                  ? `School location saved · check-ins beyond ${schoolLoc.radius_m} m are flagged`
                  : "No school location yet — check-ins record a location but nothing is range-checked. Paste coordinates (Google Maps → right-click the school → copy), or use your current location while at the school."}
              </span>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loc-lat" className="text-xs">
                    Latitude
                  </Label>
                  <Input
                    id="loc-lat"
                    className="w-36"
                    placeholder="13.0827"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loc-lng" className="text-xs">
                    Longitude
                  </Label>
                  <Input
                    id="loc-lng"
                    className="w-36"
                    placeholder="80.2707"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loc-radius" className="text-xs">
                    Radius (m)
                  </Label>
                  <Input
                    id="loc-radius"
                    className="w-24"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                  />
                </div>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fillCurrentLocation}
                    disabled={locating}
                  >
                    {locating ? (
                      <CircleNotchIcon className="size-4 animate-spin" />
                    ) : (
                      "Use current location"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveSchoolLocation}
                    disabled={saving || !locValid}
                  >
                    {schoolLoc ? "Update" : "Save location"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-2 flex items-center gap-2 border-t border-border pt-4">
        <h2 className="text-sm font-semibold text-foreground">
          Substitution auto-approve
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        When an away teacher&apos;s period has exactly one volunteer and is
        about to start, confirm that volunteer automatically so nobody is left
        waiting on a busy office. Only volunteers are ever auto-confirmed.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            const next = !autoApprove
            setAutoApprove(next)
            try {
              await apiClient.put("/api/attendance/settings", { sub_auto_approve: next })
              toast.success(next ? "Auto-approve on" : "Auto-approve off")
            } catch (e) {
              setAutoApprove(!next)
              toast.error(e instanceof Error ? e.message : "Could not save")
            }
          }}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            autoApprove
              ? "bg-primary/10 text-primary"
              : "border border-border text-muted-foreground hover:bg-muted"
          )}
        >
          {autoApprove ? "On" : "Off"}
        </button>
        {autoApprove && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            when the period starts within
            <Input
              className="h-8 w-16 text-xs"
              value={autoMins}
              onChange={(e) => setAutoMins(e.target.value)}
              onBlur={async () => {
                const mins = Number(autoMins)
                if (!Number.isFinite(mins) || mins < 5 || mins > 60) {
                  setAutoMins("15")
                  return
                }
                try {
                  await apiClient.put("/api/attendance/settings", { sub_auto_approve_mins: Math.round(mins) })
                  toast.success(`Auto-approve window: ${Math.round(mins)} min`)
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not save")
                }
              }}
            />
            minutes (5–60)
          </span>
        )}
      </div>
    </section>
  )
}

const CHECKIN_OPTIONS: { key: TeacherCheckin; title: string; body: string }[] = [
  {
    key: "admin_only",
    title: "Office marks it",
    body: "No self check-in. The admin marks every teacher on the staff roll.",
  },
  {
    key: "button",
    title: "One tap",
    body: "Teachers tap \u201cI\u2019m present\u201d — taken on trust, no proof captured.",
  },
  {
    key: "geo",
    title: "Location",
    body: "The tap captures GPS. With the school location set, far-away check-ins are flagged to the office.",
  },
  {
    key: "photo_geo",
    title: "Photo + location",
    body: "A camera selfie and GPS, stored with the server\u2019s timestamp — the strongest proof without hardware.",
  },
]

