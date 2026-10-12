import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { addDays, addMonths, format, startOfMonth, endOfMonth, subMonths } from "date-fns"
import {
  CalendarIcon,
  CertificateIcon,
  ClipboardTextIcon,
  GraduationCapIcon,
  PrinterIcon,
  TableIcon,
} from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sticker } from "@/components/shared/sticker"

/**
 * Printable records (A13): pick a report, a class/student and a period, and
 * open the print view. The server's /reports/scope narrows the pickers to
 * what the caller may see — admins/owners everything, teachers their own
 * classes.
 */

interface Scope {
  admin: boolean
  classes: { id: string; label: string }[]
  class_subjects: { id: string; class_id: string; subject_name: string }[]
  academic_year?: { label: string; start: string; end: string } | null
}

type ReportType = "attendance" | "student" | "class-marks"

const TYPES: { key: ReportType; title: string; blurb: string; icon: typeof TableIcon }[] = [
  {
    key: "attendance",
    title: "Attendance register",
    blurb: "Daily register for short periods, monthly summary for a term or year.",
    icon: ClipboardTextIcon,
  },
  {
    key: "student",
    title: "Student report card",
    blurb: "Every exam a student wrote in the period, across subjects, with totals.",
    icon: GraduationCapIcon,
  },
  {
    key: "class-marks",
    title: "Class marks sheet",
    blurb: "Students × exams — one subject, the whole class, or a single exam.",
    icon: TableIcon,
  },
]

const PRESETS = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "12m", label: "Last 12 months" },
  { key: "custom", label: "Custom range" },
] as const

function presetRange(key: string): { from: Date; to: Date } {
  const now = new Date()
  switch (key) {
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now) }
    case "last_month": {
      const lm = subMonths(now, 1)
      return { from: startOfMonth(lm), to: endOfMonth(lm) }
    }
    case "3m":
      return { from: startOfMonth(subMonths(now, 2)), to: now }
    case "6m":
      return { from: startOfMonth(subMonths(now, 5)), to: now }
    default:
      return { from: startOfMonth(subMonths(now, 11)), to: now }
  }
}

// Academic-year presets: the open year's span, its halves, and its quarters
// (Indian Apr–Mar by default; actual dates when the school set them).
const AY_KEYS = ["ay", "h1", "h2", "q1", "q2", "q3", "q4"] as const
type AyKey = (typeof AY_KEYS)[number]

function ayRange(ay: { start: string; end: string }, key: AyKey): { from: Date; to: Date } {
  const s = new Date(ay.start + "T00:00:00")
  const e = new Date(ay.end + "T00:00:00")
  const cut = (months: number) => addDays(addMonths(s, months), -1)
  switch (key) {
    case "ay": return { from: s, to: e }
    case "h1": return { from: s, to: cut(6) }
    case "h2": return { from: addMonths(s, 6), to: e }
    case "q1": return { from: s, to: cut(3) }
    case "q2": return { from: addMonths(s, 3), to: cut(6) }
    case "q3": return { from: addMonths(s, 6), to: cut(9) }
    default: return { from: addMonths(s, 9), to: e }
  }
}

const AY_LABEL: Record<AyKey, (r: { from: Date; to: Date }, label: string) => string> = {
  ay: (_r, label) => `Academic year ${label}`,
  h1: (r) => `First half (${format(r.from, "MMM")} – ${format(r.to, "MMM")})`,
  h2: (r) => `Second half (${format(r.from, "MMM")} – ${format(r.to, "MMM")})`,
  q1: (r) => `Quarter 1 (${format(r.from, "MMM")} – ${format(r.to, "MMM")})`,
  q2: (r) => `Quarter 2 (${format(r.from, "MMM")} – ${format(r.to, "MMM")})`,
  q3: (r) => `Quarter 3 (${format(r.from, "MMM")} – ${format(r.to, "MMM")})`,
  q4: (r) => `Quarter 4 (${format(r.from, "MMM")} – ${format(r.to, "MMM")})`,
}

function DateField({
  value,
  onChange,
  ariaLabel,
}: {
  value: Date
  onChange: (d: Date) => void
  ariaLabel: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={ariaLabel}
          className="h-9 w-full justify-start text-left font-normal"
        >
          <CalendarIcon className="size-4" />
          {format(value, "d MMM yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => d && onChange(d)}
          captionLayout="dropdown"
        />
      </PopoverContent>
    </Popover>
  )
}

export function ReportsPage() {
  const navigate = useNavigate()
  const [scope, setScope] = useState<Scope | null>(null)
  const [type, setType] = useState<ReportType>("attendance")
  const [classId, setClassId] = useState("")
  const [csId, setCsId] = useState("") // "" until chosen; "all" = whole class
  const [examId, setExamId] = useState("all")
  const [exams, setExams] = useState<
    { id: string; exam_name: string; subject_name: string; class_subject_id: string; created_at: string }[]
  >([])
  const [studentId, setStudentId] = useState("")
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([])
  const [preset, setPreset] = useState<string>("this_month")
  const [customFrom, setCustomFrom] = useState<Date>(startOfMonth(new Date()))
  const [customTo, setCustomTo] = useState<Date>(new Date())

  useEffect(() => {
    apiClient
      .get<Scope>("/api/reports/scope")
      .then(setScope)
      .catch(() => setScope({ admin: false, classes: [], class_subjects: [] }))
  }, [])

  // Student picker follows the chosen class.
  useEffect(() => {
    setStudentId("")
    if (!classId || type !== "student") return
    let alive = true
    apiClient
      .get<{ students: { id: string; full_name: string }[] }>(
        `/api/students/class/${classId}`
      )
      .then((r) => alive && setStudents(r.students ?? []))
      .catch(() => alive && setStudents([]))
    return () => {
      alive = false
    }
  }, [classId, type])

  // Exam picker follows the chosen class (marks sheet only).
  useEffect(() => {
    setCsId("")
    setExamId("all")
    if (!classId || type !== "class-marks") return
    let alive = true
    apiClient
      .get<{ exams: typeof exams }>(`/api/reports/exams?class_id=${classId}`)
      .then((r) => alive && setExams(r.exams ?? []))
      .catch(() => alive && setExams([]))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, type])

  const ay = scope?.academic_year ?? null
  const ayOptions = useMemo(() => {
    if (!ay) return []
    return AY_KEYS.map((key) => {
      const r = ayRange(ay, key)
      return { key, label: AY_LABEL[key](r, ay.label) }
    })
  }, [ay])

  const range = useMemo(() => {
    const r =
      preset === "custom"
        ? { from: customFrom, to: customTo }
        : ay && (AY_KEYS as readonly string[]).includes(preset)
          ? ayRange(ay, preset as AyKey)
          : presetRange(preset)
    return { from: format(r.from, "yyyy-MM-dd"), to: format(r.to, "yyyy-MM-dd") }
  }, [preset, customFrom, customTo, ay])

  // Subjects of the chosen class. "All subjects" (the class-wide sheet) is
  // admin-only — the server gates it the same way.
  const subjectOptions = useMemo(
    () => (scope?.class_subjects ?? []).filter((cs) => cs.class_id === classId),
    [scope, classId]
  )
  const examOptions = useMemo(
    () => (csId && csId !== "all" ? exams.filter((e) => e.class_subject_id === csId) : exams),
    [exams, csId]
  )

  const ready =
    type === "attendance"
      ? Boolean(classId)
      : type === "student"
        ? Boolean(studentId)
        : Boolean(classId) && (examId !== "all" || Boolean(csId))

  const openPrint = () => {
    const q = new URLSearchParams({ type, from: range.from, to: range.to })
    if (type === "attendance") q.set("class_id", classId)
    if (type === "student") q.set("student_id", studentId)
    if (type === "class-marks") {
      if (examId !== "all") {
        q.set("exam_id", examId)
      } else if (csId === "all") {
        q.set("class_id", classId)
      } else {
        q.set("class_subject_id", csId)
      }
    }
    navigate(`/reports/print?${q.toString()}`)
  }

  return (
    <div className={cn(PAGE_GUTTER, PAGE_TOP, "flex min-h-full flex-col gap-6 pb-12")}>
      <PageHeader
        icon={CertificateIcon}
        title="Reports"
        description="Print-ready records — attendance registers, report cards and marks sheets."
      />

      {scope === null ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : scope.classes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <Sticker name="sleep" size={120} />
          <div className="flex max-w-[360px] flex-col items-center gap-1 text-center">
            <p className="text-base font-medium text-secondary-foreground">
              Nothing to report on yet
            </p>
            <p className="text-sm text-muted-foreground">
              Reports cover the classes assigned to you. Once you have a class
              with attendance or exams, its records print from here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex max-w-3xl flex-col gap-5">
          {/* Report type */}
          <div className="grid gap-3 sm:grid-cols-3">
            {TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                aria-pressed={type === t.key}
                className={cn(
                  "flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors",
                  type === t.key
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:bg-muted/40"
                )}
              >
                <t.icon
                  className={cn(
                    "size-5",
                    type === t.key ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span className="text-sm font-medium">{t.title}</span>
                <span className="text-xs text-muted-foreground">{t.blurb}</span>
              </button>
            ))}
          </div>

          {/* Pickers */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Class / batch</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick a class…" />
                  </SelectTrigger>
                  <SelectContent>
                    {scope.classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === "student" && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm">Student</Label>
                  <Select value={studentId} onValueChange={setStudentId} disabled={!classId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={classId ? "Pick a student…" : "Pick a class first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {type === "class-marks" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm">Subject</Label>
                    <Select value={csId} onValueChange={setCsId} disabled={!classId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={classId ? "Pick a subject…" : "Pick a class first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {scope.admin && (
                          <SelectItem value="all">All subjects — whole class</SelectItem>
                        )}
                        {subjectOptions.map((cs) => (
                          <SelectItem key={cs.id} value={cs.id}>
                            {cs.subject_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm">Exam</Label>
                    <Select value={examId} onValueChange={setExamId} disabled={!classId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={classId ? "All exams in period" : "Pick a class first"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All exams in period</SelectItem>
                        {examOptions.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.exam_name} — {e.subject_name} ·{" "}
                            {format(new Date(e.created_at), "d MMM")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Period</Label>
                {/* A specific exam pins its own date, so the period is moot. */}
                <Select
                  value={preset}
                  onValueChange={setPreset}
                  disabled={type === "class-marks" && examId !== "all"}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.filter((p) => p.key !== "custom").map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.label}
                      </SelectItem>
                    ))}
                    {ayOptions.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {preset === "custom" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm">From</Label>
                  <DateField value={customFrom} onChange={setCustomFrom} ariaLabel="From date" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm">To</Label>
                  <DateField value={customTo} onChange={setCustomTo} ariaLabel="To date" />
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {range.from} → {range.to}
            </p>

            <Button className="self-start" onClick={openPrint} disabled={!ready}>
              <PrinterIcon className="size-4" />
              Open print view
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
