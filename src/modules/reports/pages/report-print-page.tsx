import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { format } from "date-fns"
import { ArrowLeftIcon, CircleNotchIcon, PrinterIcon } from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"

/**
 * The print document (A13). Deliberately NOT themed: schools file this on
 * paper, so it renders white-paper styling regardless of the app theme, and
 * the browser's print dialog does the rest (print or save as PDF). The
 * toolbar hides itself in print via print:hidden.
 */

// ── server shapes ─────────────────────────────────────────────────────────────

interface Letterhead {
  school_name: string
  generated_at: string
}

interface AttendanceReport {
  letterhead: Letterhead
  class_label: string
  mode: "per_period" | "per_day"
  from: string
  to: string
  days: string[]
  students: { id: string; full_name: string; roll_number: number | null }[]
  matrix: Record<string, Record<string, { p: number; t: number }>>
  summary: Record<string, { present: number; absent: number; total: number; pct: number | null }>
  week_off_days: number[]
  holidays: Record<string, string>
}

interface StudentMarksReport {
  letterhead: Letterhead
  student: { id: string; full_name: string; roll_number: number | null; class_label: string }
  from: string
  to: string
  rows: {
    exam_id: string
    exam_name: string
    subject_name: string
    date: string
    delivery: string
    total_marks: number
    obtained: number
    pass_marks: number | null
    pct: number | null
  }[]
  aggregate: { obtained: number; total: number; pct: number | null }
}

interface ClassMarksReport {
  letterhead: Letterhead
  class_label: string
  subject_name: string
  from: string
  to: string
  exams: {
    id: string
    exam_name: string
    subject_name: string
    total_marks: number
    created_at: string
    delivery: string
  }[]
  students: { id: string; full_name: string; roll_number: number | null }[]
  marks: Record<string, Record<string, number>>
  averages: Record<string, number | null>
}

const fmtDay = (iso: string) => format(new Date(iso + "T00:00:00"), "d MMM yyyy")

// ── shared pieces ─────────────────────────────────────────────────────────────

function LetterheadBlock({
  letterhead,
  title,
  subtitle,
  period,
}: {
  letterhead: Letterhead
  title: string
  subtitle: string
  period: string
}) {
  return (
    <header className="mb-6 border-b-2 border-neutral-800 pb-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{letterhead.school_name}</h1>
      <p className="mt-1 text-lg font-semibold">{title}</p>
      <p className="text-sm text-neutral-600">{subtitle}</p>
      <p className="mt-1 text-xs text-neutral-500">
        Period: {period} · Generated {format(new Date(letterhead.generated_at), "d MMM yyyy, h:mm a")}
      </p>
    </header>
  )
}

const cellCls = "border border-neutral-300 px-2 py-1"
const headCls = `${cellCls} bg-neutral-100 font-semibold`

// ── attendance ───────────────────────────────────────────────────────────────

function AttendanceDoc({ data, showOffDays }: { data: AttendanceReport; showOffDays: boolean }) {
  // Columns: the marked working days alone, or — when the off-days toggle is
  // on — every calendar day in the range, holidays (H) and week-offs (W)
  // shown like the classic bound register.
  const cols = useMemo(() => {
    if (!showOffDays) return data.days
    const out: string[] = []
    for (
      let d = new Date(data.from + "T00:00:00");
      d <= new Date(data.to + "T00:00:00");
      d.setDate(d.getDate() + 1)
    ) {
      out.push(format(d, "yyyy-MM-dd"))
    }
    return out
  }, [showOffDays, data.from, data.to, data.days])

  const workDays = useMemo(() => new Set(data.days), [data.days])
  const weekOff = useMemo(() => new Set(data.week_off_days ?? [0]), [data.week_off_days])

  // 'work' wins: an extra class held on a Sunday or holiday still prints its
  // marks rather than hiding behind W/H.
  const kindOf = (d: string): "work" | "H" | "W" | "none" => {
    if (workDays.has(d)) return "work"
    if (data.holidays?.[d]) return "H"
    if (weekOff.has(new Date(d + "T00:00:00").getDay())) return "W"
    return "none"
  }

  // ≤31 columns prints on one page. Longer ranges print like a bound
  // register: one month per landscape page, then a summary page rolling the
  // months up — a full year keeps every day visible, never >31 columns wide.
  const singlePage = cols.length <= 31

  const months = useMemo(() => {
    const byMonth = new Map<string, string[]>()
    for (const d of cols) {
      const m = d.slice(0, 7)
      byMonth.set(m, [...(byMonth.get(m) ?? []), d])
    }
    return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [cols])

  const daySymbol = (cell?: { p: number; t: number }) => {
    if (!cell || cell.t === 0) return "·"
    if (cell.p === cell.t) return "P"
    if (cell.p === 0) return "A"
    return `${cell.p}/${cell.t}`
  }

  // Periods present / periods marked for one student over a set of days.
  const sumOver = (row: Record<string, { p: number; t: number }>, days: string[]) => {
    let p = 0, t = 0
    for (const d of days) {
      const c = row[d]
      if (c) { p += c.p; t += c.t }
    }
    return { p, t }
  }

  const totalLabel = data.mode === "per_period" ? "Periods" : "Days"

  // A register grid over one page's worth of days: a month-group header row,
  // short day numbers under it. Density tightens as the grid widens — narrow
  // cells turn the day numbers vertical so a 31-day month clears the margin.
  const DayGrid = ({ days }: { days: string[] }) => {
    const compact = days.length > 15
    const dCell = compact
      ? "border border-neutral-300 px-0.5 py-1 text-[10px]"
      : `${cellCls}`
    const dHead = compact
      ? "border border-neutral-300 px-0.5 py-0.5 text-[10px] bg-neutral-100 font-semibold"
      : headCls
    const groups = (() => {
      const byMonth = new Map<string, string[]>()
      for (const d of days) {
        const m = d.slice(0, 7)
        byMonth.set(m, [...(byMonth.get(m) ?? []), d])
      }
      return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))
    })()
    return (
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th rowSpan={2} className={`${headCls} text-left align-bottom`}>Student</th>
            {groups.map(([m, ds]) => (
              <th key={m} colSpan={ds.length} className={`${headCls} text-center`}>
                {format(new Date(m + "-01T00:00:00"), "MMM yyyy")}
              </th>
            ))}
            <th rowSpan={2} className={`${headCls} text-center align-bottom`}>Present</th>
            <th rowSpan={2} className={`${headCls} text-center align-bottom`}>Absent</th>
            <th rowSpan={2} className={`${headCls} text-center align-bottom`}>{totalLabel}</th>
            <th rowSpan={2} className={`${headCls} text-center align-bottom`}>%</th>
          </tr>
          <tr>
            {days.map((d) => {
              const k = kindOf(d)
              const off = k === "H" || k === "W"
              return (
                <th
                  key={d}
                  title={data.holidays?.[d] ?? (k === "W" ? "Week off" : fmtDay(d))}
                  className={`${dHead} text-center tabular-nums ${off ? "bg-neutral-200 text-neutral-500" : ""}`}
                >
                  {format(new Date(d + "T00:00:00"), "d")}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {data.students.map((s, si) => {
            const row = data.matrix[s.id] ?? {}
            const { p, t } = sumOver(row, days)
            return (
              <tr key={s.id}>
                <td className={`${cellCls} whitespace-nowrap`}>
                  {s.roll_number != null ? `${s.roll_number}. ` : ""}
                  {s.full_name}
                </td>
                {days.map((d) => {
                  const k = kindOf(d)
                  if (k === "H" || k === "W") {
                    // An off column is one tall cell: the holiday's name or
                    // the weekday runs vertically down it, like the
                    // pre-printed register books.
                    if (si !== 0) return null
                    return (
                      <td
                        key={d}
                        rowSpan={data.students.length}
                        className={`${dCell} bg-neutral-50 text-center align-middle`}
                      >
                        <span
                          className="inline-block whitespace-nowrap text-[9px] font-medium uppercase tracking-wider text-neutral-400"
                          style={{ writingMode: "vertical-rl" }}
                        >
                          {k === "H"
                            ? data.holidays?.[d]
                            : format(new Date(d + "T00:00:00"), "EEEE")}
                        </span>
                      </td>
                    )
                  }
                  return (
                    <td key={d} className={`${dCell} text-center tabular-nums`}>
                      {k === "work" ? daySymbol(row[d]) : "·"}
                    </td>
                  )
                })}
                <td className={`${cellCls} text-center tabular-nums`}>{p}</td>
                <td className={`${cellCls} text-center tabular-nums`}>{t - p}</td>
                <td className={`${cellCls} text-center tabular-nums`}>{t}</td>
                <td className={`${cellCls} text-center font-semibold tabular-nums`}>
                  {t ? `${Math.round((p / t) * 100)}%` : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  const legend = (
    <p className="mt-3 text-[11px] text-neutral-500">
      P present · A absent · late counts as present
      {showOffDays && " · holidays & week-offs named down their column"}
      {data.mode === "per_period" && " · fractions are periods present of periods marked that day"}
      . {data.days.length} working day{data.days.length === 1 ? "" : "s"} in this period.
    </p>
  )

  return (
    <>
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
      <LetterheadBlock
        letterhead={data.letterhead}
        title="Attendance Register"
        subtitle={data.class_label}
        period={`${fmtDay(data.from)} – ${fmtDay(data.to)}`}
      />
      {singlePage ? (
        <>
          <DayGrid days={cols} />
          {legend}
        </>
      ) : (
        <>
          {months.map(([m, ds]) => (
            <section key={m} className="mb-6" style={{ breakAfter: "page" }}>
              <DayGrid days={ds} />
            </section>
          ))}

          {/* Final page: months rolled up + the whole-range totals. */}
          <h2 className="mb-2 text-sm font-semibold">Summary</h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={`${headCls} text-left`}>Student</th>
                {months.map(([m]) => (
                  <th key={m} className={`${headCls} text-center`}>
                    {format(new Date(m + "-01T00:00:00"), "MMM yyyy")}
                  </th>
                ))}
                <th className={`${headCls} text-center`}>Present</th>
                <th className={`${headCls} text-center`}>Absent</th>
                <th className={`${headCls} text-center`}>{totalLabel}</th>
                <th className={`${headCls} text-center`}>%</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s) => {
                const row = data.matrix[s.id] ?? {}
                const sum = data.summary[s.id]
                return (
                  <tr key={s.id}>
                    <td className={`${cellCls} whitespace-nowrap`}>
                      {s.roll_number != null ? `${s.roll_number}. ` : ""}
                      {s.full_name}
                    </td>
                    {months.map(([m, ds]) => {
                      const { p, t } = sumOver(row, ds)
                      return (
                        <td key={m} className={`${cellCls} text-center tabular-nums`}>
                          {t ? `${p}/${t}` : "·"}
                        </td>
                      )
                    })}
                    <td className={`${cellCls} text-center tabular-nums`}>{sum?.present ?? 0}</td>
                    <td className={`${cellCls} text-center tabular-nums`}>{sum?.absent ?? 0}</td>
                    <td className={`${cellCls} text-center tabular-nums`}>{sum?.total ?? 0}</td>
                    <td className={`${cellCls} text-center font-semibold tabular-nums`}>
                      {sum?.pct != null ? `${sum.pct}%` : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {legend}
        </>
      )}
    </>
  )
}

// ── student report card ───────────────────────────────────────────────────────

function StudentDoc({ data }: { data: StudentMarksReport }) {
  return (
    <>
      <LetterheadBlock
        letterhead={data.letterhead}
        title="Student Report Card"
        subtitle={`${data.student.full_name}${data.student.roll_number != null ? ` · Roll ${data.student.roll_number}` : ""} · ${data.student.class_label}`}
        period={`${fmtDay(data.from)} – ${fmtDay(data.to)}`}
      />
      {data.rows.length === 0 ? (
        <p className="text-sm text-neutral-600">No graded exams in this period.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${headCls} text-left`}>Date</th>
              <th className={`${headCls} text-left`}>Exam</th>
              <th className={`${headCls} text-left`}>Subject</th>
              <th className={`${headCls} text-center`}>Marks</th>
              <th className={`${headCls} text-center`}>%</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const failed = r.pass_marks != null && r.obtained < r.pass_marks
              return (
                <tr key={r.exam_id}>
                  <td className={`${cellCls} whitespace-nowrap`}>
                    {format(new Date(r.date), "d MMM yyyy")}
                  </td>
                  <td className={cellCls}>
                    {r.exam_name}
                    {r.delivery === "online" ? " (online)" : ""}
                  </td>
                  <td className={cellCls}>{r.subject_name}</td>
                  <td
                    className={`${cellCls} text-center tabular-nums ${failed ? "font-semibold text-red-700" : ""}`}
                  >
                    {r.obtained} / {r.total_marks}
                  </td>
                  <td className={`${cellCls} text-center tabular-nums`}>
                    {r.pct != null ? `${r.pct}%` : "—"}
                  </td>
                </tr>
              )
            })}
            <tr>
              <td colSpan={3} className={`${headCls} text-right`}>
                Overall
              </td>
              <td className={`${headCls} text-center tabular-nums`}>
                {data.aggregate.obtained} / {data.aggregate.total}
              </td>
              <td className={`${headCls} text-center tabular-nums`}>
                {data.aggregate.pct != null ? `${data.aggregate.pct}%` : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      )}
      <div className="mt-16 flex justify-between text-sm">
        <span className="border-t border-neutral-400 px-8 pt-1">Class teacher</span>
        <span className="border-t border-neutral-400 px-8 pt-1">Principal / Head</span>
        <span className="border-t border-neutral-400 px-8 pt-1">Parent</span>
      </div>
    </>
  )
}

// ── class marks sheet ─────────────────────────────────────────────────────────

function ClassMarksDoc({ data }: { data: ClassMarksReport }) {
  // The whole-class sheet spans subjects; its exam columns get a subject
  // band above them (server sorts by subject, then date).
  const subjectGroups = useMemo(() => {
    const groups: { name: string; count: number }[] = []
    for (const e of data.exams) {
      const last = groups[groups.length - 1]
      if (last && last.name === e.subject_name) last.count += 1
      else groups.push({ name: e.subject_name, count: 1 })
    }
    return groups
  }, [data.exams])
  const multiSubject = subjectGroups.length > 1

  return (
    <>
      {data.exams.length > 6 && <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>}
      <LetterheadBlock
        letterhead={data.letterhead}
        title="Class Marks Sheet"
        subtitle={`${data.class_label} · ${data.subject_name}`}
        period={`${fmtDay(data.from)} – ${fmtDay(data.to)}`}
      />
      {data.exams.length === 0 ? (
        <p className="text-sm text-neutral-600">No exams in this period.</p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead>
            {multiSubject && (
              <tr>
                <th className={headCls} />
                {subjectGroups.map((g, i) => (
                  <th key={i} colSpan={g.count} className={`${headCls} text-center`}>
                    {g.name}
                  </th>
                ))}
                <th className={headCls} colSpan={2} />
              </tr>
            )}
            <tr>
              <th className={`${headCls} text-left`}>Student</th>
              {data.exams.map((e) => (
                <th key={e.id} className={`${headCls} text-center`}>
                  {e.exam_name}
                  <span className="block font-normal text-neutral-500">
                    {format(new Date(e.created_at), "d MMM")} · /{e.total_marks}
                  </span>
                </th>
              ))}
              <th className={`${headCls} text-center`}>Total</th>
              <th className={`${headCls} text-center`}>%</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => {
              const row = data.marks[s.id] ?? {}
              const got = data.exams.reduce((n, e) => n + Number(row[e.id] ?? 0), 0)
              const sat = data.exams.filter((e) => row[e.id] != null)
              const max = sat.reduce((n, e) => n + Number(e.total_marks), 0)
              return (
                <tr key={s.id}>
                  <td className={`${cellCls} whitespace-nowrap`}>
                    {s.roll_number != null ? `${s.roll_number}. ` : ""}
                    {s.full_name}
                  </td>
                  {data.exams.map((e) => (
                    <td key={e.id} className={`${cellCls} text-center tabular-nums`}>
                      {row[e.id] != null ? row[e.id] : "—"}
                    </td>
                  ))}
                  <td className={`${cellCls} text-center font-medium tabular-nums`}>
                    {sat.length ? `${Math.round(got * 100) / 100} / ${max}` : "—"}
                  </td>
                  <td className={`${cellCls} text-center tabular-nums`}>
                    {max > 0 ? `${Math.round((got / max) * 1000) / 10}%` : "—"}
                  </td>
                </tr>
              )
            })}
            <tr>
              <td className={`${headCls} text-right`}>Class average</td>
              {data.exams.map((e) => (
                <td key={e.id} className={`${headCls} text-center tabular-nums`}>
                  {data.averages[e.id] ?? "—"}
                </td>
              ))}
              <td className={headCls} colSpan={2} />
            </tr>
          </tbody>
        </table>
      )}
    </>
  )
}

// ── page shell ────────────────────────────────────────────────────────────────

export function ReportPrintPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const type = params.get("type")
  const [data, setData] = useState<
    | { kind: "attendance"; body: AttendanceReport }
    | { kind: "student"; body: StudentMarksReport }
    | { kind: "class-marks"; body: ClassMarksReport }
    | null
  >(null)
  const [error, setError] = useState("")
  // Off-days toggle (attendance only): also draw holidays and week-offs in
  // the grid, like the pre-printed register books. Pure client-side — the
  // report payload already carries the school's holidays and week-off days.
  const [showOffDays, setShowOffDays] = useState(false)

  useEffect(() => {
    const from = params.get("from")
    const to = params.get("to")
    const run = async () => {
      try {
        if (type === "attendance") {
          const body = await apiClient.get<AttendanceReport>(
            `/api/reports/attendance?class_id=${params.get("class_id")}&from=${from}&to=${to}`
          )
          setData({ kind: "attendance", body })
        } else if (type === "student") {
          const body = await apiClient.get<StudentMarksReport>(
            `/api/reports/student-marks?student_id=${params.get("student_id")}&from=${from}&to=${to}`
          )
          setData({ kind: "student", body })
        } else {
          // One subject, the whole class, or a single exam — pass through
          // whichever scope the picker chose.
          const q = new URLSearchParams({ from: from ?? "", to: to ?? "" })
          for (const k of ["class_subject_id", "class_id", "exam_id"] as const) {
            const v = params.get(k)
            if (v) q.set(k, v)
          }
          const body = await apiClient.get<ClassMarksReport>(`/api/reports/class-marks?${q.toString()}`)
          setData({ kind: "class-marks", body })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load the report")
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    // Paper styling on purpose — this page prints, the app theme does not.
    <div className="min-h-dvh bg-neutral-200 text-neutral-900 print:bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 print:hidden">
        <Button variant="outline" size="sm" onClick={() => navigate("/reports")}>
          <ArrowLeftIcon className="size-4" />
          Back to reports
        </Button>
        <div className="flex items-center gap-4">
          {data?.kind === "attendance" && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-neutral-700">
              <input
                type="checkbox"
                checked={showOffDays}
                onChange={(e) => setShowOffDays(e.target.checked)}
                className="size-3.5 accent-emerald-700"
              />
              Show holidays &amp; week-offs
            </label>
          )}
          <Button size="sm" onClick={() => window.print()} disabled={!data}>
            <PrinterIcon className="size-4" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="mx-auto mb-8 max-w-5xl bg-white px-8 py-10 shadow-sm print:mb-0 print:max-w-none print:px-0 print:py-0 print:shadow-none">
        {error ? (
          <p className="py-10 text-center text-sm text-red-700">{error}</p>
        ) : !data ? (
          <div className="flex justify-center py-16">
            <CircleNotchIcon className="size-5 animate-spin text-neutral-400" />
          </div>
        ) : data.kind === "attendance" ? (
          <AttendanceDoc data={data.body} showOffDays={showOffDays} />
        ) : data.kind === "student" ? (
          <StudentDoc data={data.body} />
        ) : (
          <ClassMarksDoc data={data.body} />
        )}
      </div>
    </div>
  )
}
