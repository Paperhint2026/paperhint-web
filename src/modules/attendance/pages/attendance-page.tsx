import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import {
  ArrowLeftIcon,
  CameraIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  ClipboardTextIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DatePickerField } from "@/components/shared/date-picker-field"
import { Sticker } from "@/components/shared/sticker"

/**
 * Attendance (module 09 · A9). Per the founder's model: the roll is taken PER
 * PERIOD by that period's teacher — so a teacher lands on "my periods today"
 * and marks each one, while an admin lands on the day view: every section ×
 * period, taken vs missing, and who marked. Absence digests to parents ride
 * the notifications rail later; this page only records.
 */

type Status = "present" | "absent" | "late" | "leave"

type TodayPeriod = {
  class_id: string
  period_id: string | null
  class_label: string
  period_number: number | null
  period_name: string
  start_time: string | null
  end_time: string | null
  subject: string
  marked_at: string | null
}

type SelfAttendance = { status: Status; marked_at: string } | null

type RosterStudent = { id: string; full_name: string; roll_number: number | null }

type OverviewCell = {
  period_id: string
  subject: string
  teacher_name: string | null
  taken: boolean
  marked_by_name: string | null
  marked_at: string | null
  absent: number | null
}

type Overview = {
  date: string
  periods: { id: string; period_number: number; name: string }[]
  sections: { class_id: string; label: string; cells: OverviewCell[] }[]
  totals: { expected: number; taken: number; missing: number }
}

const STATUS_ORDER: Status[] = ["present", "absent", "late", "leave"]
const STATUS_NAME: Record<Status, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  leave: "On leave",
}
const STATUS_LABEL: Record<Status, string> = {
  present: "P",
  absent: "A",
  late: "L",
  leave: "Lv",
}
const STATUS_STYLE: Record<Status, string> = {
  present: "bg-primary/10 text-primary border-primary/30",
  absent: "bg-destructive/10 text-destructive border-destructive/30",
  late: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  leave: "bg-muted text-muted-foreground border-border",
}

function fmtClock(iso: string | null) {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function fmtTime(t: string | null) {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  const am = h < 12
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${am ? "am" : "pm"}`
}

export function AttendancePage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  return (
    <div className={cn("flex flex-col gap-5 pb-12", PAGE_GUTTER, PAGE_TOP)}>
      <PageHeader
        icon={ClipboardTextIcon}
        title="Attendance"
        description={
          isAdmin
            ? "The day's roll across the school — every section, every period, and the registers still to come in."
            : "Your periods today. Open one and take the roll."
        }
      />
      {isAdmin ? <AdminAttendance /> : <TeacherToday />}
    </div>
  )
}

function AdminAttendance() {
  const [tab, setTab] = useState<"students" | "teachers" | "leave">("students")
  const [pending, setPending] = useState(0)
  useEffect(() => {
    apiClient
      .get<{ pending: number }>("/api/leaves")
      .then((r) => setPending(r.pending ?? 0))
      .catch(() => {})
  }, [tab])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 self-start rounded-lg bg-muted p-1">
        {(["students", "teachers", "leave"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
            {t === "leave" && pending > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {pending}
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === "students" ? (
        <AdminDayView />
      ) : tab === "teachers" ? (
        <AdminTeacherRoll />
      ) : (
        <AdminLeaveList onPendingChange={setPending} />
      )}
    </div>
  )
}

/* ── Admin: the staff roll ──────────────────────────────────────────────── */

type TeacherRow = {
  id: string
  full_name: string
  designation: string | null
  status: Status | null
  marked_at: string | null
  self_marked: boolean | null
  method: CheckinMethod | null
  distance_m: number | null
  out_of_range: boolean | null
  photo_url: string | null
}

function AdminTeacherRoll() {
  const [date, setDate] = useState("")
  const [rows, setRows] = useState<TeacherRow[] | null>(null)
  const [totals, setTotals] = useState({ total: 0, marked: 0, unmarked: 0 })

  const load = useCallback((d?: string) => {
    setRows(null)
    apiClient
      .get<{ date: string; teachers: TeacherRow[]; totals: typeof totals }>(
        `/api/attendance/teachers${d ? `?date=${d}` : ""}`
      )
      .then((r) => {
        setDate(r.date)
        setRows(r.teachers)
        setTotals(r.totals)
      })
      .catch(() => setRows([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const set = async (teacher_id: string, status: Status) => {
    try {
      await apiClient.put("/api/attendance/teachers", { teacher_id, date, status })
      setRows((prev) =>
        (prev ?? []).map((r) =>
          r.id === teacher_id ? { ...r, status, self_marked: false } : r
        )
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <DatePickerField value={date} onChange={load} className="w-52" disableFuture />
        {rows && (
          <span className="text-xs text-muted-foreground">
            {totals.marked} of {totals.total} marked
            {totals.unmarked > 0 ? ` — ${totals.unmarked} not yet` : ""}
          </span>
        )}
      </div>
      {rows === null ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-background">
          {rows.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">
                  {t.full_name}
                </span>
                {t.status && (
                  <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    {t.self_marked ? "self-marked" : "set by admin"}
                    {t.marked_at ? ` at ${fmtClock(t.marked_at)}` : ""}
                    {t.distance_m != null && (
                      <span
                        className={cn(
                          t.out_of_range && "font-medium text-destructive"
                        )}
                      >
                        · {t.distance_m >= 1000 ? `${(t.distance_m / 1000).toFixed(1)} km` : `${t.distance_m} m`} from school
                        {t.out_of_range ? " (out of range)" : ""}
                      </span>
                    )}
                    {t.photo_url && (
                      <a
                        href={t.photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        photo
                      </a>
                    )}
                  </span>
                )}
              </span>
              <div className="flex gap-1">
                {STATUS_ORDER.map((st) => (
                  <Tooltip key={st}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={STATUS_NAME[st]}
                        onClick={() => set(t.id, st)}
                        className={cn(
                          "min-w-8 rounded-md border px-1.5 py-1 text-[11px] font-semibold transition-colors",
                          t.status === st
                            ? STATUS_STYLE[st]
                            : "border-transparent text-muted-foreground/50 hover:bg-muted"
                        )}
                      >
                        {STATUS_LABEL[st]}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{STATUS_NAME[st]}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Teacher: my periods today ──────────────────────────────────────────── */

function TeacherToday() {
  const [date, setDate] = useState("")
  const [periods, setPeriods] = useState<TodayPeriod[] | null>(null)
  const [self, setSelf] = useState<SelfAttendance>(null)
  const [checkinMethod, setCheckinMethod] = useState<CheckinMethod>("button")
  const [open, setOpen] = useState<TodayPeriod | null>(null)
  const [myClasses, setMyClasses] = useState<{ class_id: string; label: string }[]>([])
  const [classView, setClassView] = useState<{ class_id: string; label: string } | null>(null)

  const load = useCallback((d?: string) => {
    setPeriods(null)
    apiClient
      .get<{
        date: string
        periods: TodayPeriod[]
        self: SelfAttendance
        teacher_checkin: CheckinMethod
        class_teacher_of: { class_id: string; label: string }[]
      }>(`/api/attendance/today${d ? `?date=${d}` : ""}`)
      .then((r) => {
        setDate(r.date)
        setPeriods(r.periods)
        setSelf(r.self)
        setCheckinMethod(r.teacher_checkin ?? "button")
        setMyClasses(r.class_teacher_of ?? [])
      })
      .catch(() => setPeriods([]))
  }, [])
  useEffect(() => {
    load()
  }, [load])



  if (open) {
    return (
      <RosterMarking
        period={open}
        date={date}
        onBack={() => {
          setOpen(null)
          load(date)
        }}
      />
    )
  }

  if (classView) {
    return (
      <ClassDayView
        classId={classView.class_id}
        label={classView.label}
        initialDate={date}
        onBack={() => setClassView(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CheckInCard
        method={checkinMethod}
        self={self}
        date={date}
        onChecked={(s) => setSelf(s)}
      />

      <LeaveCard />

      <div className="flex items-center gap-3">
        <DatePickerField value={date} onChange={load} className="w-52" disableFuture />
        {periods && (
          <span className="text-xs text-muted-foreground">
            {periods.filter((p) => p.marked_at).length} of {periods.length}{" "}
            registers taken
          </span>
        )}
      </div>

      {periods === null ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : periods.length === 0 ? (
        <>
          <MyClassStrip classes={myClasses} onOpen={setClassView} />
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background px-5 py-12 text-center">
            <Sticker name="greet" size={88} />
            <p className="text-sm text-muted-foreground">
              No periods scheduled for you on this day.
            </p>
          </div>
        </>
      ) : (
        <>
          <MyClassStrip classes={myClasses} onOpen={setClassView} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {periods.map((p) => (
            <button
              key={`${p.class_id}|${p.period_id}`}
              type="button"
              onClick={() => setOpen(p)}
              className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/60"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-secondary-foreground">
                {p.period_number ?? "D"}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {p.class_label} · {p.subject}
                </span>
                <span className="text-xs text-muted-foreground">
                  {p.start_time
                    ? `${fmtTime(p.start_time)} – ${fmtTime(p.end_time)}`
                    : p.period_name}
                </span>
              </span>
              {p.marked_at ? (
                <CheckCircleIcon weight="fill" className="size-5 shrink-0 text-primary" />
              ) : (
                <Badge variant="secondary" className="shrink-0 rounded-full text-[10px]">
                  Take roll
                </Badge>
              )}
            </button>
          ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── The teacher's own check-in, per the school's chosen method ─────────── */

type CheckinMethod = "admin_only" | "button" | "geo" | "photo_geo"

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("No location access in this browser"))
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Location was denied — allow it and retry")), {
      enableHighAccuracy: true,
      timeout: 15000,
    })
  })
}

function CheckInCard({
  method,
  self,
  date,
  onChecked,
}: {
  method: CheckinMethod
  self: SelfAttendance
  date: string
  onChecked: (s: SelfAttendance) => void
}) {
  const [busy, setBusy] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  const checkIn = async (status: "present" | "late") => {
    setBusy(true)
    try {
      const form = new FormData()
      form.append("date", date)
      form.append("status", status)
      if (method === "geo" || method === "photo_geo") {
        const pos = await getPosition()
        form.append("latitude", String(pos.coords.latitude))
        form.append("longitude", String(pos.coords.longitude))
        form.append("accuracy_m", String(Math.round(pos.coords.accuracy ?? 0)))
      }
      if (method === "photo_geo") {
        if (!photo) throw new Error("Take a photo first")
        form.append("photo", photo)
      }
      const r = await apiClient.post<{ out_of_range: boolean | null }>(
        "/api/attendance/self",
        form
      )
      onChecked({ status, marked_at: new Date().toISOString() })
      setPhoto(null)
      toast.success(
        r.out_of_range
          ? "Checked in — you appear to be away from school; the office will see that"
          : status === "present"
            ? "Marked present"
            : "Marked late"
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not check in")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
      <span className="text-sm font-medium text-foreground">
        Your attendance
      </span>
      {self ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircleIcon weight="fill" className="size-4 text-primary" />
          Marked {self.status} for {date}
          {self.marked_at ? ` at ${fmtClock(self.marked_at)}` : ""}
        </span>
      ) : method === "admin_only" ? (
        <span className="text-xs text-muted-foreground">
          Not marked yet — your school marks the staff roll at the office.
        </span>
      ) : (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {method === "photo_geo" && (
            <>
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-secondary-foreground transition-colors hover:bg-muted"
              >
                <CameraIcon className="size-4" />
                {photo ? "Photo ready ✓ — retake" : "Take a photo"}
              </button>
              <CameraCaptureDialog
                open={cameraOpen}
                onClose={() => setCameraOpen(false)}
                onCapture={(file) => {
                  setPhoto(file)
                  setCameraOpen(false)
                }}
              />
            </>
          )}
          <Button
            size="sm"
            onClick={() => checkIn("present")}
            disabled={busy || (method === "photo_geo" && !photo)}
          >
            {busy ? (
              <CircleNotchIcon className="size-4 animate-spin" />
            ) : method === "geo" || method === "photo_geo" ? (
              "I'm at school"
            ) : (
              "I'm present"
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => checkIn("late")}
            disabled={busy || (method === "photo_geo" && !photo)}
          >
            Came in late
          </Button>
        </div>
      )}
    </div>
  )
}

/* ── Live camera capture — getUserMedia, not a file picker ───────────────── */

function CameraCaptureDialog({
  open,
  onClose,
  onCapture,
}: {
  open: boolean
  onClose: () => void
  onCapture: (file: File) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError("")
    setReady(false)
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setReady(true)
      })
      .catch(() =>
        setError("Camera was denied — allow camera access and reopen.")
      )
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [open])

  const capture = () => {
    const video = videoRef.current
    if (!video || !ready) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapture(new File([blob], "checkin.jpg", { type: "image/jpeg" }))
      },
      "image/jpeg",
      0.82
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check-in photo</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* mirrored like a selfie preview; the captured frame is unmirrored */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-[4/3] w-full -scale-x-100 rounded-lg bg-black object-cover"
            />
            <Button onClick={capture} disabled={!ready}>
              <CameraIcon className="size-4" />
              {ready ? "Capture" : "Starting camera…"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ── Roster marking for one period ──────────────────────────────────────── */

function RosterMarking({
  period,
  date,
  onBack,
}: {
  period: TodayPeriod
  date: string
  onBack: () => void
}) {
  const [students, setStudents] = useState<RosterStudent[] | null>(null)
  const [marks, setMarks] = useState<Record<string, Status>>({})
  const [meta, setMeta] = useState<{
    marked_by_name: string | null
    marked_at: string
    updated_at?: string | null
  } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiClient
      .get<{
        students: RosterStudent[]
        entries: { student_id: string; status: Status }[]
        register: {
          marked_by_name: string | null
          marked_at: string
          updated_at: string | null
        } | null
      }>(
        `/api/attendance/roster?class_id=${period.class_id}${period.period_id ? `&period_id=${period.period_id}` : ""}&date=${date}`
      )
      .then((r) => {
        setStudents(r.students)
        // Everyone starts present; an existing register overlays its truth.
        const initial: Record<string, Status> = {}
        for (const s of r.students) initial[s.id] = "present"
        for (const e of r.entries) initial[e.student_id] = e.status
        setMarks(initial)
        setMeta(r.register)
      })
      .catch(() => setStudents([]))
  }, [period, date])

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, leave: 0 }
    for (const s of Object.values(marks)) c[s] += 1
    return c
  }, [marks])

  const save = async () => {
    if (!students) return
    setSaving(true)
    try {
      await apiClient.post("/api/attendance/registers", {
        class_id: period.class_id,
        ...(period.period_id ? { period_id: period.period_id } : {}),
        date,
        entries: students.map((s) => ({ student_id: s.id, status: marks[s.id] ?? "present" })),
      })
      toast.success(
        counts.absent === 0
          ? "Roll saved — everyone present"
          : `Roll saved — ${counts.absent} absent`
      )
      onBack()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the roll")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Button>
        <h3 className="text-sm font-semibold text-foreground">
          {period.class_label} · {period.subject}
          <span className="ml-2 font-normal text-muted-foreground">
            {period.period_name} · {date}
          </span>
        </h3>
        {meta && (
          <span className="text-xs text-muted-foreground">
            taken by {meta.marked_by_name ?? "—"}
            {meta.marked_at ? ` at ${fmtClock(meta.marked_at)}` : ""}
            {meta.updated_at ? ` · edited ${fmtClock(meta.updated_at)}` : ""}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>{counts.present} present</span>
          {counts.absent > 0 && <span className="text-destructive">{counts.absent} absent</span>}
          {counts.late > 0 && <span>{counts.late} late</span>}
          {counts.leave > 0 && <span>{counts.leave} leave</span>}
        </div>
      </div>

      {students === null ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <>
          <div className="divide-y divide-border rounded-xl border border-border bg-background">
            {students.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-8 shrink-0 text-xs text-muted-foreground tabular-nums">
                  {s.roll_number ?? "—"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {s.full_name}
                </span>
                <div className="flex gap-1">
                  {STATUS_ORDER.map((st) => (
                    <Tooltip key={st}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={STATUS_NAME[st]}
                          onClick={() => setMarks((m) => ({ ...m, [s.id]: st }))}
                          className={cn(
                            "min-w-8 rounded-md border px-1.5 py-1 text-[11px] font-semibold transition-colors",
                            marks[s.id] === st
                              ? STATUS_STYLE[st]
                              : "border-transparent text-muted-foreground/50 hover:bg-muted"
                          )}
                        >
                          {STATUS_LABEL[st]}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{STATUS_NAME[st]}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || students.length === 0}>
              {saving ? (
                <CircleNotchIcon className="size-4 animate-spin" />
              ) : meta ? (
                "Update roll"
              ) : (
                "Save roll"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Admin: the day across the school ───────────────────────────────────── */

function AdminDayView() {
  const [data, setData] = useState<Overview | null>(null)
  const [date, setDate] = useState("")

  const load = useCallback((d?: string) => {
    setData(null)
    apiClient
      .get<Overview>(`/api/attendance/overview${d ? `?date=${d}` : ""}`)
      .then((r) => {
        setDate(r.date)
        setData(r)
      })
      .catch(() => setData({ date: d ?? "", periods: [], sections: [], totals: { expected: 0, taken: 0, missing: 0 } }))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <DatePickerField value={date} onChange={load} className="w-52" disableFuture />
        {data && data.totals.expected > 0 && (
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs",
              data.totals.missing > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
            )}
          >
            {data.totals.missing > 0 && <WarningIcon className="size-3.5" />}
            {data.totals.taken} of {data.totals.expected} registers taken
            {data.totals.missing > 0 ? ` — ${data.totals.missing} missing` : ""}
          </span>
        )}
      </div>

      {data === null ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : data.sections.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background px-5 py-12 text-center">
          <Sticker name="point" size={88} />
          <p className="text-sm text-muted-foreground">
            Nothing scheduled this day — the roll follows the timetable.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse bg-background text-xs">
            <thead>
              <tr className="bg-sidebar">
                <th className="w-20 border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">
                  Section
                </th>
                {data.periods.map((p) => (
                  <th
                    key={p.id}
                    className="border-b border-l border-border px-2 py-2 text-center font-medium text-muted-foreground"
                  >
                    {p.period_number}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sections.map((sec) => {
                const byPeriod = new Map(sec.cells.map((c) => [c.period_id, c]))
                return (
                  <tr key={sec.class_id}>
                    <td className="border-b border-border px-3 py-2 font-medium text-foreground">
                      {sec.label}
                    </td>
                    {data.periods.map((p) => {
                      const cell = byPeriod.get(p.id)
                      return (
                        <td
                          key={p.id}
                          className="border-b border-l border-border px-1.5 py-1.5 text-center"
                          title={
                            cell
                              ? cell.taken
                                ? `${cell.subject} — taken by ${cell.marked_by_name ?? "—"}${cell.marked_at ? ` at ${fmtClock(cell.marked_at)}` : ""}${cell.absent ? ` · ${cell.absent} absent` : ""}`
                                : `${cell.subject} — ${cell.teacher_name ?? "no teacher"} · register missing`
                              : "Free period"
                          }
                        >
                          {!cell ? (
                            <span className="text-muted-foreground/30">·</span>
                          ) : cell.taken ? (
                            <span
                              className={cn(
                                "inline-flex min-w-6 items-center justify-center rounded px-1 py-0.5 font-semibold",
                                (cell.absent ?? 0) > 0
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-primary/10 text-primary"
                              )}
                            >
                              {(cell.absent ?? 0) > 0 ? cell.absent : "✓"}
                            </span>
                          ) : (
                            <span className="inline-flex min-w-6 items-center justify-center rounded bg-amber-100 px-1 py-0.5 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              —
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        ✓ taken, all present · red number = absentees · amber — = register
        missing · hover a cell for the subject and marker.
      </p>
    </div>
  )
}

/* ── Class teacher: the whole class's day ───────────────────────────────── */

function MyClassStrip({
  classes,
  onOpen,
}: {
  classes: { class_id: string; label: string }[]
  onOpen: (c: { class_id: string; label: string }) => void
}) {
  if (classes.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
      <span className="text-xs font-medium text-foreground">
        Your class{classes.length > 1 ? "es" : ""} (class teacher):
      </span>
      {classes.map((c) => (
        <button
          key={c.class_id}
          type="button"
          onClick={() => onOpen(c)}
          className="rounded-full border border-primary/30 bg-background px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          {c.label} — full attendance
        </button>
      ))}
    </div>
  )
}

type ClassDay = {
  date: string
  columns: { register_id: string; label: string; marked_by_name: string | null; marked_at: string | null }[]
  students: {
    student_id: string
    full_name: string
    roll_number: number | null
    statuses: (Status | null)[]
    verdict: "present" | "partial" | "absent" | null
  }[]
}

const GLYPH: Record<Status, string> = { present: "✓", absent: "A", late: "L", leave: "Lv" }

function ClassDayView({
  classId,
  label,
  initialDate,
  onBack,
}: {
  classId: string
  label: string
  initialDate: string
  onBack: () => void
}) {
  const [date, setDate] = useState(initialDate)
  const [data, setData] = useState<ClassDay | null>(null)

  const load = useCallback(
    (d: string) => {
      setData(null)
      apiClient
        .get<ClassDay>(`/api/attendance/class/${classId}?date=${d}`)
        .then(setData)
        .catch(() => setData({ date: d, columns: [], students: [] }))
    },
    [classId]
  )
  useEffect(() => {
    load(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const absentees = (data?.students ?? []).filter((s) => s.verdict === "absent" || s.verdict === "partial")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Button>
        <h3 className="text-sm font-semibold text-foreground">
          {label} · full attendance
        </h3>
        <DatePickerField
          value={date}
          onChange={(d) => {
            setDate(d)
            load(d)
          }}
          className="w-52"
          disableFuture
        />
        {data && absentees.length > 0 && (
          <span className="text-xs text-destructive">
            {absentees.length} student{absentees.length === 1 ? "" : "s"} with absences
          </span>
        )}
      </div>

      {data === null ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : data.columns.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background px-5 py-12 text-center">
          <Sticker name="point" size={88} />
          <p className="text-sm text-muted-foreground">
            No registers taken for {label} on this day yet.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse bg-background text-xs">
            <thead>
              <tr className="bg-sidebar">
                <th className="w-10 border-b border-border px-2 py-2 text-left font-medium text-muted-foreground">
                  #
                </th>
                <th className="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">
                  Student
                </th>
                {data.columns.map((c) => (
                  <th
                    key={c.register_id}
                    title={c.marked_by_name ? `Marked by ${c.marked_by_name}${c.marked_at ? ` at ${fmtClock(c.marked_at)}` : ""}` : undefined}
                    className="border-b border-l border-border px-2 py-2 text-center font-medium text-muted-foreground"
                  >
                    {c.label}
                  </th>
                ))}
                <th className="border-b border-l border-border px-2 py-2 text-center font-medium text-muted-foreground">
                  Day
                </th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.student_id}>
                  <td className="border-b border-border px-2 py-1.5 text-muted-foreground tabular-nums">
                    {s.roll_number ?? "—"}
                  </td>
                  <td className="border-b border-border px-3 py-1.5 text-foreground">
                    {s.full_name}
                  </td>
                  {s.statuses.map((st, i) => (
                    <td
                      key={i}
                      className={cn(
                        "border-b border-l border-border px-2 py-1.5 text-center font-semibold",
                        st === "absent"
                          ? "text-destructive"
                          : st === "late"
                            ? "text-amber-700 dark:text-amber-400"
                            : st === "leave"
                              ? "text-muted-foreground"
                              : st
                                ? "text-primary"
                                : "text-muted-foreground/30"
                      )}
                    >
                      {st ? GLYPH[st] : "·"}
                    </td>
                  ))}
                  <td className="border-b border-l border-border px-2 py-1.5 text-center">
                    {s.verdict === "absent" ? (
                      <Badge variant="destructive" className="rounded-full text-[10px]">
                        Absent
                      </Badge>
                    ) : s.verdict === "partial" ? (
                      <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        Partial
                      </span>
                    ) : s.verdict === "present" ? (
                      <CheckCircleIcon weight="fill" className="inline size-4 text-primary" />
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Leave requests (module A10 · phase 1) ──────────────────────────────── */

type Leave = {
  id: string
  start_date: string
  end_date: string
  reason: string | null
  status: "requested" | "approved" | "rejected"
  created_at: string
  decided_at?: string | null
  teacher?: { full_name: string } | null
  decider?: { full_name: string } | null
}

const LEAVE_BADGE: Record<Leave["status"], string> = {
  requested: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
}

function fmtRange(l: Leave) {
  return l.start_date === l.end_date ? l.start_date : `${l.start_date} → ${l.end_date}`
}

function LeaveCard() {
  const location = useLocation()
  const [leaves, setLeaves] = useState<Leave[] | null>(null)
  const [waveId, setWaveId] = useState<string | null>(null)
  const [waveKind, setWaveKind] = useState<"approved" | "rejected">("approved")
  const [applying, setApplying] = useState(false)
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    apiClient
      .get<{ leaves: Leave[] }>("/api/leaves/mine")
      .then((r) => setLeaves(r.leaves))
      .catch(() => setLeaves([]))
  }, [])
  useEffect(() => {
    load()
    // A decision arriving over the rail refreshes the card in place.
    const onRail = (e: Event) => {
      const n = (e as CustomEvent).detail
      if (n?.type === "leave_decided") load()
    }
    window.addEventListener("ph:notification", onRail)
    return () => window.removeEventListener("ph:notification", onRail)
  }, [load])

  // Arriving here FROM the decision notification: play the approval wave on
  // the freshly decided row (calmer pulse for a rejection).
  useEffect(() => {
    const state = location.state as { rail?: string; at?: number } | null
    if (state?.rail !== "leave_decided" || !leaves?.length) return
    const decided = [...leaves]
      .filter((l) => l.status !== "requested" && l.decided_at)
      .sort((a, b) => (b.decided_at! > a.decided_at! ? 1 : -1))[0]
    if (!decided) return
    setWaveKind(decided.status === "approved" ? "approved" : "rejected")
    setWaveId(decided.id)
    // consume the state so a refresh doesn't replay the animation
    window.history.replaceState({}, "")
    const t = setTimeout(() => setWaveId(null), 3200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, leaves === null])

  const submit = async () => {
    setBusy(true)
    try {
      await apiClient.post("/api/leaves", {
        start_date: start,
        end_date: end || start,
        reason,
      })
      toast.success("Leave requested — the office will decide")
      setApplying(false)
      setStart("")
      setEnd("")
      setReason("")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not request leave")
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async (id: string) => {
    try {
      await apiClient.delete(`/api/leaves/${id}`)
      toast.success("Request withdrawn")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not withdraw")
    }
  }

  const visible = (leaves ?? []).slice(0, 4)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background px-4 py-3">
      {/* The approval wave: three soft ripples spreading from the row, green
          for approved; a single quiet grey pulse for rejected. */}
      <style>{`
        @keyframes leaveWaveApproved {
          0%   { box-shadow: 0 0 0 0 color-mix(in oklch, var(--color-primary) 45%, transparent); background: color-mix(in oklch, var(--color-primary) 14%, transparent); }
          70%  { box-shadow: 0 0 0 18px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; background: color-mix(in oklch, var(--color-primary) 6%, transparent); }
        }
        @keyframes leaveWaveRejected {
          0%   { background: color-mix(in oklch, var(--color-muted-foreground) 18%, transparent); }
          100% { background: transparent; }
        }
        .leave-wave-approved { animation: leaveWaveApproved 1s ease-out 3; }
        .leave-wave-rejected { animation: leaveWaveRejected 2.4s ease-out 1; }
        @media (prefers-reduced-motion: reduce) {
          .leave-wave-approved, .leave-wave-rejected { animation: none; background: color-mix(in oklch, var(--color-primary) 10%, transparent); }
        }
      `}</style>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-foreground">Leave</span>
        {!applying && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => setApplying(true)}
          >
            Apply for leave
          </Button>
        )}
      </div>

      {applying && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">From</span>
            <DatePickerField
              value={start}
              onChange={(d) => {
                setStart(d)
                if (end && end < d) setEnd(d)
              }}
              className="w-36"
              short
              disablePast
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">To</span>
            <DatePickerField
              value={end || start}
              onChange={setEnd}
              className="w-36"
              short
              disablePast
              minDate={start || undefined}
            />
          </div>
          {start && (
            <span className="pb-2 text-xs font-medium whitespace-nowrap text-primary">
              {(() => {
                const days =
                  Math.round(
                    (new Date((end || start) + "T00:00:00").getTime() -
                      new Date(start + "T00:00:00").getTime()) /
                      86400000
                  ) + 1
                return days > 0 ? `${days} day${days === 1 ? "" : "s"}` : "check the dates"
              })()}
            </span>
          )}
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Reason</span>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. medical, family function…"
              maxLength={500}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setApplying(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={busy || !start}>
              {busy ? <CircleNotchIcon className="size-4 animate-spin" /> : "Request"}
            </Button>
          </div>
        </div>
      )}

      {visible.length > 0 && (
        <div className="flex flex-col divide-y divide-border">
          {visible.map((l) => (
            <div
              key={l.id}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                waveId === l.id &&
                  (waveKind === "approved" ? "leave-wave-approved" : "leave-wave-rejected")
              )}
            >
              <span className="font-medium text-foreground">{fmtRange(l)}</span>
              {l.reason && <span className="text-muted-foreground">· {l.reason}</span>}
              {l.status !== "requested" && l.decider?.full_name && (
                <span className="text-[11px] text-muted-foreground">
                  · {l.status} by {l.decider.full_name}
                  {l.decided_at
                    ? ` on ${new Date(l.decided_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                    : ""}
                </span>
              )}
              <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium", LEAVE_BADGE[l.status])}>
                {l.status}
              </span>
              {l.status === "requested" && (
                <button
                  type="button"
                  onClick={() => withdraw(l.id)}
                  className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-destructive"
                >
                  withdraw
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminLeaveList({ onPendingChange }: { onPendingChange: (n: number) => void }) {
  const [leaves, setLeaves] = useState<Leave[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    apiClient
      .get<{ leaves: Leave[]; pending: number }>("/api/leaves")
      .then((r) => {
        setLeaves(r.leaves)
        onPendingChange(r.pending ?? 0)
      })
      .catch(() => setLeaves([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const decide = async (id: string, action: "approve" | "reject") => {
    setBusy(id)
    try {
      await apiClient.post(`/api/leaves/${id}/decide`, { action })
      toast.success(action === "approve" ? "Approved — staff roll marked for those days" : "Rejected")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not decide")
    } finally {
      setBusy(null)
    }
  }

  if (leaves === null) return <Skeleton className="h-48 w-full rounded-xl" />
  if (leaves.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background px-5 py-12 text-center">
        <Sticker name="greet" size={88} />
        <p className="text-sm text-muted-foreground">No leave requests yet.</p>
      </div>
    )
  }

  const pending = leaves.filter((l) => l.status === "requested")
  const decided = leaves.filter((l) => l.status !== "requested")

  const Row = ({ l }: { l: Leave }) => (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">
          {l.teacher?.full_name ?? "—"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {fmtRange(l)}
          {l.reason ? ` · ${l.reason}` : ""}
          {l.status !== "requested" && l.decider?.full_name
            ? ` · ${l.status} by ${l.decider.full_name}`
            : ""}
        </span>
      </span>
      {l.status === "requested" ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy === l.id} onClick={() => decide(l.id, "reject")}>
            Reject
          </Button>
          <Button size="sm" disabled={busy === l.id} onClick={() => decide(l.id, "approve")}>
            Approve
          </Button>
        </div>
      ) : (
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", LEAVE_BADGE[l.status])}>
          {l.status}
        </span>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {pending.length > 0 && (
        <div className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-muted-foreground">
            Waiting for a decision
          </span>
          <div className="divide-y divide-border rounded-xl border border-border bg-background">
            {pending.map((l) => (
              <Row key={l.id} l={l} />
            ))}
          </div>
        </div>
      )}
      {decided.length > 0 && (
        <div className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-muted-foreground">History</span>
          <div className="divide-y divide-border rounded-xl border border-border bg-background">
            {decided.map((l) => (
              <Row key={l.id} l={l} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

