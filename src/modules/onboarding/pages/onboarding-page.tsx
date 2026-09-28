import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CircleNotchIcon,
  ClockIcon,
  ExamIcon,
  UsersIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * `/onboarding` — the four-step wizard the solo owner runs once after
 * signup:
 *
 *   1. Subjects (mandatory) — a curated K-12 list + custom.
 *   2. Classes (mandatory) — grade chips × section chips; each pair
 *      becomes a `classes` row paired with every subject as a
 *      `class_subject`, with a `teacher_assignments` row on the owner.
 *   3. Bell schedule (skip-able) — 8 sensible periods pre-filled.
 *   4. Students (skip-able) — paste a list, one per line.
 *
 * The final commit is one atomic POST /onboarding/complete — a half-
 * finished wizard is worse than none.
 */

const CURATED_SUBJECTS = [
  "Mathematics", "Science", "Physics", "Chemistry", "Biology",
  "English", "Hindi", "Tamil", "Sanskrit", "French",
  "Social Science", "History", "Geography", "Economics", "Civics",
  "Computer Science", "General Knowledge", "Physical Education", "Art", "Music",
]

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const SECTIONS = ["A", "B", "C", "D"]

const DEFAULT_PERIODS = [
  { name: "Period 1", start_time: "09:00", end_time: "09:40", is_break: false },
  { name: "Period 2", start_time: "09:40", end_time: "10:20", is_break: false },
  { name: "Period 3", start_time: "10:20", end_time: "11:00", is_break: false },
  { name: "Break", start_time: "11:00", end_time: "11:20", is_break: true },
  { name: "Period 4", start_time: "11:20", end_time: "12:00", is_break: false },
  { name: "Period 5", start_time: "12:00", end_time: "12:40", is_break: false },
  { name: "Lunch", start_time: "12:40", end_time: "13:20", is_break: true },
  { name: "Period 6", start_time: "13:20", end_time: "14:00", is_break: false },
  { name: "Period 7", start_time: "14:00", end_time: "14:40", is_break: false },
  { name: "Period 8", start_time: "14:40", end_time: "15:20", is_break: false },
]

type Status = {
  kind: "school" | "solo" | "coaching"
  workspace_name: string | null
  is_owner: boolean
  needs_onboarding: boolean
}

type StudentInput = { full_name: string; class: string }
type PeriodInput = { name: string; start_time: string; end_time: string; is_break?: boolean }

export function OnboardingPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status | null>(null)

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [subjects, setSubjects] = useState<string[]>([])
  const [customSubject, setCustomSubject] = useState("")
  const [classes, setClasses] = useState<{ grade: number; section: string }[]>([])
  const [periods, setPeriods] = useState<PeriodInput[]>(DEFAULT_PERIODS)
  const [includePeriods, setIncludePeriods] = useState(true)
  const [studentsRaw, setStudentsRaw] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    apiClient
      .get<Status>("/api/onboarding/status")
      .then((s) => {
        setStatus(s)
        if (!s.needs_onboarding) navigate("/", { replace: true })
      })
      .catch(() => setStatus({ kind: "solo", workspace_name: null, is_owner: false, needs_onboarding: false }))
  }, [navigate])

  const toggleSubject = (s: string) =>
    setSubjects((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
  const addCustom = () => {
    const t = customSubject.trim()
    if (!t) return
    if (!subjects.some((s) => s.toLowerCase() === t.toLowerCase())) setSubjects((c) => [...c, t])
    setCustomSubject("")
  }
  const toggleClass = (grade: number, section: string) => {
    const key = `${grade}-${section}`
    setClasses((cur) => {
      const seen = new Set(cur.map((c) => `${c.grade}-${c.section}`))
      if (seen.has(key)) return cur.filter((c) => `${c.grade}-${c.section}` !== key)
      return [...cur, { grade, section }].sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section))
    })
  }

  const parsedStudents = useMemo<StudentInput[]>(() => {
    if (!studentsRaw.trim() || classes.length === 0) return []
    const defaultClass = `${classes[0].grade}${classes[0].section}`
    // Each line: "Full Name" or "Full Name, 6A" or "Full Name — 6A"
    return studentsRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(.+?)[\s,—-]+((\d{1,2})([A-D]))$/i)
        if (m) return { full_name: m[1].trim(), class: (m[3] + m[4]).toUpperCase() }
        return { full_name: line, class: defaultClass }
      })
  }, [studentsRaw, classes])

  const submit = async () => {
    if (busy) return
    setBusy(true)
    try {
      const payload: {
        subjects: string[]
        classes: { grade: number; section: string }[]
        periods?: PeriodInput[]
        students?: StudentInput[]
      } = { subjects, classes }
      if (includePeriods) payload.periods = periods
      if (parsedStudents.length) payload.students = parsedStudents

      const res = await apiClient.post<{ created: Record<string, number> }>(
        "/api/onboarding/complete",
        payload
      )
      const { classes: c, subjects: s, students: st } = res.created
      toast.success(
        `Set up: ${c} class${c === 1 ? "" : "es"}, ${s} subject${s === 1 ? "" : "s"}${
          st ? `, ${st} student${st === 1 ? "" : "s"}` : ""
        }`
      )
      navigate("/", { replace: true })
    } catch (err) {
      showError(err, "Couldn't finish setup")
    } finally {
      setBusy(false)
    }
  }

  if (!status) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-4 px-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const canNext =
    (step === 0 && subjects.length > 0) ||
    (step === 1 && classes.length > 0) ||
    step === 2 ||
    step === 3

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-4 py-8">
      <div className="flex items-center gap-2">
        <ExamIcon className="size-6 text-primary" weight="fill" />
        <span className="text-lg font-semibold">
          Paper<span className="text-primary">hint</span>
        </span>
      </div>

      <Steps current={step} />

      <div className="rounded-xl border bg-card p-5 sm:p-6">
        {step === 0 && (
          <StepSubjects
            subjects={subjects}
            onToggle={toggleSubject}
            custom={customSubject}
            setCustom={setCustomSubject}
            onAddCustom={addCustom}
          />
        )}
        {step === 1 && <StepClasses classes={classes} onToggle={toggleClass} />}
        {step === 2 && (
          <StepPeriods
            include={includePeriods}
            setInclude={setIncludePeriods}
            periods={periods}
            setPeriods={setPeriods}
          />
        )}
        {step === 3 && (
          <StepStudents
            classes={classes}
            raw={studentsRaw}
            setRaw={setStudentsRaw}
            parsed={parsedStudents}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 0 || busy}
          onClick={() => setStep((s) => (Math.max(0, s - 1) as 0 | 1 | 2 | 3))}
        >
          <ArrowLeftIcon className="size-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {(step === 2 || step === 3) && (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                if (step === 2) setIncludePeriods(false)
                if (step === 3) setStudentsRaw("")
                if (step === 3) void submit()
                else setStep((s) => ((s + 1) as 0 | 1 | 2 | 3))
              }}
              disabled={busy}
            >
              Skip
            </Button>
          )}
          {step < 3 ? (
            <Button
              type="button"
              disabled={!canNext || busy}
              onClick={() => setStep((s) => ((s + 1) as 0 | 1 | 2 | 3))}
            >
              Continue
              <ArrowRightIcon className="size-4" />
            </Button>
          ) : (
            <Button type="button" onClick={() => void submit()} disabled={busy}>
              {busy ? (
                <>
                  <CircleNotchIcon className="size-4 animate-spin" />
                  Setting up…
                </>
              ) : (
                <>
                  <CheckIcon className="size-4" />
                  Finish
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── steps ────────────────────────────────────────────────────────────── */

function Steps({ current }: { current: 0 | 1 | 2 | 3 }) {
  const labels = ["Subjects", "Classes", "Bell", "Students"]
  return (
    <ol className="flex items-center gap-2 text-xs text-muted-foreground">
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-2">
          <span
            className={cn(
              "grid size-6 place-items-center rounded-full text-[11px] font-semibold",
              i < current
                ? "bg-primary text-primary-foreground"
                : i === current
                  ? "bg-primary/15 text-primary"
                  : "bg-muted"
            )}
          >
            {i < current ? <CheckIcon className="size-3.5" weight="bold" /> : i + 1}
          </span>
          <span className={cn(i === current && "font-medium text-foreground")}>{l}</span>
          {i < labels.length - 1 && <span className="h-px w-6 bg-border" />}
        </li>
      ))}
    </ol>
  )
}

function StepSubjects({
  subjects,
  onToggle,
  custom,
  setCustom,
  onAddCustom,
}: {
  subjects: string[]
  onToggle: (s: string) => void
  custom: string
  setCustom: (v: string) => void
  onAddCustom: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Which subjects do you teach?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick every one you handle. You can add more later.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {CURATED_SUBJECTS.map((s) => {
          const active = subjects.includes(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => onToggle(s)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              )}
            >
              {s}
            </button>
          )
        })}
        {subjects
          .filter((s) => !CURATED_SUBJECTS.includes(s))
          .map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onToggle(s)}
              className="rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            >
              {s}
            </button>
          ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add another subject"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onAddCustom()
            }
          }}
          className="max-w-64"
        />
        <Button type="button" variant="outline" onClick={onAddCustom} disabled={!custom.trim()}>
          Add
        </Button>
      </div>
    </div>
  )
}

function StepClasses({
  classes,
  onToggle,
}: {
  classes: { grade: number; section: string }[]
  onToggle: (grade: number, section: string) => void
}) {
  const active = (g: number, s: string) => classes.some((c) => c.grade === g && c.section === s)
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Which classes do you teach?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every combination becomes its own class, with all the subjects you
          picked. E.g. picking 6A + 6B and Science + Maths creates four
          class-subjects.
        </p>
      </div>
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Grade</th>
              {SECTIONS.map((s) => (
                <th key={s} className="px-2 py-2 text-center font-medium">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRADES.map((g) => (
              <tr key={g} className="border-t">
                <td className="px-3 py-1.5 text-sm font-medium">{g}</td>
                {SECTIONS.map((s) => {
                  const on = active(g, s)
                  return (
                    <td key={s} className="px-1 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => onToggle(g, s)}
                        aria-pressed={on}
                        aria-label={`Grade ${g} section ${s}`}
                        className={cn(
                          "size-8 rounded-md border text-xs font-medium transition-colors",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-transparent text-muted-foreground hover:border-border hover:bg-muted"
                        )}
                      >
                        {s}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {classes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Selected: {classes.map((c) => `${c.grade}${c.section}`).join(", ")}
        </p>
      )}
    </div>
  )
}

function StepPeriods({
  include,
  setInclude,
  periods,
  setPeriods,
}: {
  include: boolean
  setInclude: (b: boolean) => void
  periods: PeriodInput[]
  setPeriods: (p: PeriodInput[]) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ClockIcon className="size-5" />
          Your school's timings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A standard 8-period day is pre-filled. Adjust anything, or skip and
          add it later.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={include}
          onChange={(e) => setInclude(e.target.checked)}
          className="size-4"
        />
        Use these timings for my school
      </label>
      {include && (
        <div className="flex flex-col divide-y rounded-lg border">
          {periods.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_100px_auto] items-center gap-2 px-3 py-2 text-sm">
              <Input
                value={p.name}
                onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className="h-8"
              />
              <Input
                type="time"
                value={p.start_time}
                onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x)))}
                className="h-8"
              />
              <Input
                type="time"
                value={p.end_time}
                onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, end_time: e.target.value } : x)))}
                className="h-8"
              />
              <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={!!p.is_break}
                  onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, is_break: e.target.checked } : x)))}
                />
                break
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StepStudents({
  classes,
  raw,
  setRaw,
  parsed,
}: {
  classes: { grade: number; section: string }[]
  raw: string
  setRaw: (v: string) => void
  parsed: StudentInput[]
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UsersIcon className="size-5" />
          Add your students
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One per line. Add the class with a comma or a dash if the name isn't
          for your first class — e.g. <span className="font-mono">Aarav Sharma, 6B</span>.
          Fully skippable — you can bulk-import later.
        </p>
      </div>
      <textarea
        rows={8}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={
          classes.length
            ? `Aarav Sharma\nPriya Iyer, ${classes[0].grade}${classes[0].section}\n…`
            : "Aarav Sharma\nPriya Iyer\n…"
        }
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {parsed.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {parsed.length} student{parsed.length === 1 ? "" : "s"} across{" "}
          {new Set(parsed.map((s) => s.class)).size} class
          {new Set(parsed.map((s) => s.class)).size === 1 ? "" : "es"}.
        </p>
      )}
    </div>
  )
}
