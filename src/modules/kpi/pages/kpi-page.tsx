import { useEffect, useMemo, useState } from "react"
import {
  ChartBarIcon,
  WarningCircleIcon,
  GraduationCapIcon,
  UsersIcon,
  BookOpenIcon,
  ClipboardTextIcon,
  CheckCircleIcon,
  ExportIcon,
} from "@phosphor-icons/react"
import { format, subDays } from "date-fns"

import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Reports & KPI (A14). Admin-only dashboard: one page, six panels. All reads;
 * aggregation happens server-side. Each panel exports to CSV in-browser —
 * no server round-trip, no new permission, just a Blob + anchor click.
 */

interface Overview {
  from: string
  to: string
  headline: {
    students: number
    teachers: number
    classes: number
    attendance_pct: number | null
    teacher_attendance_pct: number | null
    exams_in_range: number
    sheets_graded: number
    pending_leaves: number
    queued_grading: number
    failed_grading: number
  }
  attendance_trend: { week: string; pct: number | null }[]
}

interface TeacherAttendance {
  from: string
  to: string
  headline_pct: number | null
  by_teacher: {
    teacher_id: string
    full_name: string
    present: number
    absent: number
    total: number
    pct: number | null
    last_marked: string | null
  }[]
}

interface AttendancePanel {
  from: string
  to: string
  by_class: { class_id: string; class_label: string; present: number; total: number; pct: number | null }[]
  below_threshold: {
    student_id: string
    full_name: string
    roll_number: number | null
    class_label: string
    pct: number
    present: number
    total: number
  }[]
}

interface AcademicPanel {
  from: string
  to: string
  by_class_subject: {
    class_subject_id: string
    class_label: string
    subject_name: string
    sheets_graded: number
    avg_pct: number | null
    pass_pct: number | null
  }[]
}

interface SyllabusPanel {
  by_class_subject: {
    class_subject_id: string
    class_label: string
    subject_name: string
    topics_done: number
    topics_in_progress: number
    topics_total: number
    pct_done: number | null
    last_log_date: string | null
  }[]
}

interface TeachersPanel {
  from: string
  to: string
  by_teacher: {
    teacher_id: string
    full_name: string
    notes_written: number
    lesson_logs: number
    exams_created: number
  }[]
}

interface PendingPanel {
  ungraded_sheets: {
    submission_id: string
    status: string
    uploaded_at: string
    exam_name: string
    class_label: string
  }[]
  pending_leaves: {
    leave_id: string
    teacher_name: string
    start_date: string
    end_date: string
    reason: string | null
  }[]
  counts: { ungraded: number; pending_leaves: number }
}

/* ── CSV helpers (client-side, no server trip) ───────────────────────────── */

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return (
    headers.join(",") +
    "\n" +
    rows.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n")
  )
}

function downloadCSV(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${name}-${format(new Date(), "yyyy-MM-dd")}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── bits ────────────────────────────────────────────────────────────────── */

const PRESETS = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "180d", label: "Last 6 months", days: 180 },
  { key: "365d", label: "Last year", days: 365 },
] as const

function rangeFromPreset(k: string) {
  const p = PRESETS.find((x) => x.key === k) ?? PRESETS[1]
  const to = new Date()
  const from = subDays(to, p.days)
  return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ChartBarIcon
  label: string
  value: string
  tone?: "normal" | "warn" | "good"
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone === "warn" && "text-destructive",
          tone === "good" && "text-primary"
        )}
      >
        {value}
      </div>
    </div>
  )
}

/** Minimal inline-SVG sparkline — one path, no library. */
function Spark({ points }: { points: (number | null)[] }) {
  const w = 320, h = 44, pad = 2
  const vals = points.filter((p): p is number => p != null)
  if (vals.length < 2) {
    return (
      <div className="flex h-11 items-center justify-center text-xs text-muted-foreground">
        Not enough data yet
      </div>
    )
  }
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = max - min || 1
  const stepX = (w - pad * 2) / (points.length - 1)
  const path = points
    .map((p, i) => {
      if (p == null) return null
      const x = pad + i * stepX
      const y = pad + ((max - p) / span) * (h - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .filter(Boolean)
    .join(" L ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" preserveAspectRatio="none">
      <path
        d={`M ${path}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-primary"
      />
    </svg>
  )
}

function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const pctFmt = (n: number | null | undefined) => (n == null ? "—" : `${n}%`)

/* ── page ─────────────────────────────────────────────────────────────────── */

export function KpiPage() {
  const [preset, setPreset] = useState<string>("30d")
  const range = useMemo(() => rangeFromPreset(preset), [preset])
  const q = `?from=${range.from}&to=${range.to}`

  const [ov, setOv] = useState<Overview | null>(null)
  const [att, setAtt] = useState<AttendancePanel | null>(null)
  const [ac, setAc] = useState<AcademicPanel | null>(null)
  const [sy, setSy] = useState<SyllabusPanel | null>(null)
  const [te, setTe] = useState<TeachersPanel | null>(null)
  const [ta, setTa] = useState<TeacherAttendance | null>(null)
  const [pe, setPe] = useState<PendingPanel | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setOv(null); setAtt(null); setAc(null); setSy(null); setTe(null); setTa(null); setPe(null)
    setErr(null)
    Promise.all([
      apiClient.get<Overview>("/api/kpi/overview" + q),
      apiClient.get<AttendancePanel>("/api/kpi/attendance" + q),
      apiClient.get<AcademicPanel>("/api/kpi/academic" + q),
      apiClient.get<SyllabusPanel>("/api/kpi/syllabus"),
      apiClient.get<TeachersPanel>("/api/kpi/teachers" + q),
      apiClient.get<TeacherAttendance>("/api/kpi/teacher-attendance" + q),
      apiClient.get<PendingPanel>("/api/kpi/pending"),
    ])
      .then(([o, a, c, s, t, tatt, p]) => {
        setOv(o); setAtt(a); setAc(c); setSy(s); setTe(t); setTa(tatt); setPe(p)
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Could not load the dashboard"))
  }, [q])

  return (
    <div className={cn(PAGE_GUTTER, "flex min-h-full flex-col gap-5 pb-12")}>
      {/* The heading + period strip pin to the top of the scroll area, so the
          dashboard content below scrolls under it. Full-bleed background so
          cards don't show through on scroll; the inset keeps content aligned
          to PAGE_GUTTER. */}
      <div
        className={cn(
          "sticky top-0 z-20 -mx-6 border-b border-border bg-background px-6 md:-mx-8 md:px-8 lg:-mx-12 lg:px-12 xl:-mx-16 xl:px-16",
          PAGE_TOP
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="size-5 text-primary" />
            <div>
              <h1 className="text-base font-semibold text-foreground sm:text-lg">
                Reports & KPI
              </h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Attendance, academics, syllabus progress, teacher activity, pending work.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
              Period
            </span>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="hidden text-xs text-muted-foreground tabular-nums md:inline">
              {range.from} → {range.to}
            </span>
          </div>
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {/* Headline stats */}
      {ov === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Stat icon={UsersIcon} label="Students" value={String(ov.headline.students)} />
          <Stat icon={GraduationCapIcon} label="Teachers" value={String(ov.headline.teachers)} />
          <Stat
            icon={ClipboardTextIcon}
            label="Student attendance"
            value={pctFmt(ov.headline.attendance_pct)}
            tone={ov.headline.attendance_pct != null && ov.headline.attendance_pct < 85 ? "warn" : undefined}
          />
          <Stat
            icon={UsersIcon}
            label="Teacher attendance"
            value={pctFmt(ov.headline.teacher_attendance_pct)}
            tone={ov.headline.teacher_attendance_pct != null && ov.headline.teacher_attendance_pct < 90 ? "warn" : undefined}
          />
          <Stat icon={BookOpenIcon} label="Exams held" value={String(ov.headline.exams_in_range)} />
          <Stat
            icon={WarningCircleIcon}
            label="Pending work"
            value={String(
              ov.headline.pending_leaves + ov.headline.queued_grading + ov.headline.failed_grading
            )}
            tone={
              ov.headline.pending_leaves + ov.headline.queued_grading + ov.headline.failed_grading > 0
                ? "warn"
                : "good"
            }
          />
        </div>
      )}

      {/* Attendance trend sparkline */}
      {ov && (
        <Panel title="Attendance over time">
          <Spark points={ov.attendance_trend.map((w) => w.pct)} />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{ov.attendance_trend[0]?.week ?? ""}</span>
            <span>Weekly ·  {ov.attendance_trend.length} weeks</span>
            <span>{ov.attendance_trend.at(-1)?.week ?? ""}</span>
          </div>
        </Panel>
      )}

      {/* Attendance + Academic side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Attendance by class"
          action={
            att && att.by_class.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => downloadCSV("attendance-by-class", att.by_class)}>
                <ExportIcon className="size-3.5" /> CSV
              </Button>
            ) : null
          }
        >
          {att === null ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : att.by_class.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance taken yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Class</th>
                    <th className="pb-2 pr-2 text-right font-medium">Present / Total</th>
                    <th className="pb-2 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {att.by_class.map((c) => (
                    <tr key={c.class_id}>
                      <td className="py-1.5 pr-2 text-foreground">{c.class_label}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                        {c.present}/{c.total}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 text-right font-medium tabular-nums",
                          c.pct != null && c.pct < 75 && "text-destructive"
                        )}
                      >
                        {pctFmt(c.pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="Academic performance"
          action={
            ac && ac.by_class_subject.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => downloadCSV("academic", ac.by_class_subject)}>
                <ExportIcon className="size-3.5" /> CSV
              </Button>
            ) : null
          }
        >
          {ac === null ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : ac.by_class_subject.length === 0 ? (
            <p className="text-sm text-muted-foreground">No graded exams in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Class · Subject</th>
                    <th className="pb-2 pr-2 text-right font-medium">Sheets</th>
                    <th className="pb-2 pr-2 text-right font-medium">Avg</th>
                    <th className="pb-2 text-right font-medium">Pass</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ac.by_class_subject
                    .filter((c) => c.sheets_graded > 0)
                    .map((c) => (
                      <tr key={c.class_subject_id}>
                        <td className="py-1.5 pr-2 text-foreground">
                          {c.class_label} · <span className="text-muted-foreground">{c.subject_name}</span>
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                          {c.sheets_graded}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-foreground">
                          {pctFmt(c.avg_pct)}
                        </td>
                        <td
                          className={cn(
                            "py-1.5 text-right tabular-nums",
                            c.pass_pct != null && c.pass_pct < 60 && "text-destructive"
                          )}
                        >
                          {pctFmt(c.pass_pct)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* Syllabus + Teacher activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Syllabus progress"
          action={
            sy && sy.by_class_subject.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => downloadCSV("syllabus", sy.by_class_subject)}>
                <ExportIcon className="size-3.5" /> CSV
              </Button>
            ) : null
          }
        >
          {sy === null ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : sy.by_class_subject.filter((c) => c.topics_total > 0).length === 0 ? (
            <p className="text-sm text-muted-foreground">No syllabus set up yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-xs">
              {sy.by_class_subject
                .filter((c) => c.topics_total > 0)
                .map((c) => (
                  <li key={c.class_subject_id} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-foreground">
                      {c.class_label} · <span className="text-muted-foreground">{c.subject_name}</span>
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${c.pct_done ?? 0}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-muted-foreground tabular-nums">
                      {c.topics_done}/{c.topics_total}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Teacher activity"
          action={
            te && te.by_teacher.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => downloadCSV("teachers", te.by_teacher)}>
                <ExportIcon className="size-3.5" /> CSV
              </Button>
            ) : null
          }
        >
          {te === null ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : te.by_teacher.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teachers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Teacher</th>
                    <th className="pb-2 pr-2 text-right font-medium">Notes</th>
                    <th className="pb-2 pr-2 text-right font-medium">Logs</th>
                    <th className="pb-2 text-right font-medium">Exams</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {te.by_teacher.map((t) => (
                    <tr key={t.teacher_id}>
                      <td className="py-1.5 pr-2 text-foreground">{t.full_name}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{t.notes_written}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{t.lesson_logs}</td>
                      <td className="py-1.5 text-right tabular-nums">{t.exams_created}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* Teacher attendance (full width) */}
      <Panel
        title={`Teacher attendance${ta?.headline_pct != null ? ` — ${ta.headline_pct}%` : ""}`}
        action={
          ta && ta.by_teacher.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => downloadCSV("teacher-attendance", ta.by_teacher)}>
              <ExportIcon className="size-3.5" /> CSV
            </Button>
          ) : null
        }
      >
        {ta === null ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : ta.by_teacher.filter((t) => t.total > 0).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No teacher attendance recorded in this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Teacher</th>
                  <th className="pb-2 pr-2 text-right font-medium">Present</th>
                  <th className="pb-2 pr-2 text-right font-medium">Absent</th>
                  <th className="pb-2 pr-2 text-right font-medium">Days</th>
                  <th className="pb-2 pr-2 text-right font-medium">%</th>
                  <th className="pb-2 text-right font-medium">Last marked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ta.by_teacher
                  .filter((t) => t.total > 0)
                  .map((t) => (
                    <tr key={t.teacher_id}>
                      <td className="py-1.5 pr-2 text-foreground">{t.full_name}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">{t.present}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">{t.absent}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">{t.total}</td>
                      <td
                        className={cn(
                          "py-1.5 pr-2 text-right font-semibold tabular-nums",
                          t.pct != null && t.pct < 85 && "text-destructive"
                        )}
                      >
                        {pctFmt(t.pct)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                        {t.last_marked ? format(new Date(t.last_marked + "T00:00:00"), "d MMM") : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Below-threshold students (full width) */}
      {att && att.below_threshold.length > 0 && (
        <Panel
          title={`Students below 75% (${att.below_threshold.length})`}
          action={
            <Button variant="ghost" size="sm" onClick={() => downloadCSV("below-threshold", att.below_threshold)}>
              <ExportIcon className="size-3.5" /> CSV
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Student</th>
                  <th className="pb-2 pr-2 font-medium">Class</th>
                  <th className="pb-2 pr-2 text-right font-medium">Present / Total</th>
                  <th className="pb-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {att.below_threshold.map((s) => (
                  <tr key={s.student_id}>
                    <td className="py-1.5 pr-2 text-foreground">
                      {s.roll_number != null ? `${s.roll_number}. ` : ""}
                      {s.full_name}
                    </td>
                    <td className="py-1.5 pr-2 text-muted-foreground">{s.class_label}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                      {s.present}/{s.total}
                    </td>
                    <td className="py-1.5 text-right font-semibold tabular-nums text-destructive">
                      {s.pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Pending work */}
      {pe && (pe.counts.ungraded > 0 || pe.counts.pending_leaves > 0) && (
        <Panel title="Needs attention">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
                Ungraded sheets ({pe.counts.ungraded})
              </h3>
              {pe.ungraded_sheets.length === 0 ? (
                <p className="text-xs text-muted-foreground">All clear.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-xs">
                  {pe.ungraded_sheets.slice(0, 8).map((s) => (
                    <li key={s.submission_id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-foreground">
                        {s.exam_name} <span className="text-muted-foreground">· {s.class_label}</span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          s.status === "failed"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {s.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
                Pending leaves ({pe.counts.pending_leaves})
              </h3>
              {pe.pending_leaves.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing waiting.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-xs">
                  {pe.pending_leaves.slice(0, 8).map((l) => (
                    <li key={l.leave_id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-foreground">
                        {l.teacher_name}
                        <span className="ml-1 text-muted-foreground">
                          · {format(new Date(l.start_date + "T00:00:00"), "d MMM")}
                          {l.end_date !== l.start_date
                            ? ` – ${format(new Date(l.end_date + "T00:00:00"), "d MMM")}`
                            : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">{l.reason || ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>
      )}

      {pe && pe.counts.ungraded === 0 && pe.counts.pending_leaves === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-primary">
          <CheckCircleIcon weight="fill" className="size-4" />
          Nothing needs your attention right now.
        </div>
      )}
    </div>
  )
}
