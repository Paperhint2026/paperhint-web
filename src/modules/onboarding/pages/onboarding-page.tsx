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
  XIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * `/onboarding` — the four-step wizard the solo owner runs once after
 * signup:
 *
 *   1. Subjects (mandatory) — a curated K-12 list + custom.
 *   2. Classes (mandatory) — row builder: grade + section + one of the
 *      step-1 subjects per row. Rows sharing a grade+section collapse into
 *      one `classes` row with a `class_subject` per chosen subject, each
 *      with a `teacher_assignments` row on the owner.
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
type ClassRow = { grade: number; section: string; subject: string }
type BatchRow = { name: string; subject: string; grade: number }
type PeriodInput = { name: string; start_time: string; end_time: string; is_break?: boolean }

export function OnboardingPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status | null>(null)

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [subjects, setSubjects] = useState<string[]>([])
  const [customSubject, setCustomSubject] = useState("")
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [batches, setBatches] = useState<BatchRow[]>([])
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
  const addClassRow = (row: ClassRow): boolean => {
    const key = `${row.grade}|${row.section}|${row.subject.toLowerCase()}`
    let added = false
    setClasses((cur) => {
      if (cur.some((c) => `${c.grade}|${c.section}|${c.subject.toLowerCase()}` === key)) return cur
      added = true
      return [...cur, row].sort(
        (a, b) => a.grade - b.grade || a.section.localeCompare(b.section) || a.subject.localeCompare(b.subject)
      )
    })
    return added
  }
  const removeClassRow = (idx: number) =>
    setClasses((cur) => cur.filter((_, i) => i !== idx))

  const addBatchRow = (row: BatchRow): boolean => {
    const key = `${row.name.toLowerCase()}|${row.subject.toLowerCase()}`
    let added = false
    setBatches((cur) => {
      if (cur.some((b) => `${b.name.toLowerCase()}|${b.subject.toLowerCase()}` === key)) return cur
      added = true
      return [...cur, row]
    })
    return added
  }
  const removeBatchRow = (idx: number) =>
    setBatches((cur) => cur.filter((_, i) => i !== idx))

  const isCoaching = status?.kind === "coaching"

  const classLabels = useMemo(
    () =>
      isCoaching
        ? [...new Set(batches.map((b) => b.name))]
        : [...new Set(classes.map((c) => `${c.grade}${c.section}`))],
    [classes, batches, isCoaching]
  )

  const parsedStudents = useMemo<StudentInput[]>(() => {
    if (!studentsRaw.trim() || classLabels.length === 0) return []
    const defaultClass = classLabels[0]
    // Coaching lines end in ", <batch name>" — matched against the step-2
    // batches, case-insensitively. No match (or no comma) → first batch.
    if (isCoaching) {
      const labelByLower = new Map(classLabels.map((l) => [l.toLowerCase(), l]))
      return studentsRaw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const ci = line.lastIndexOf(",")
          if (ci > 0) {
            const hit = labelByLower.get(line.slice(ci + 1).trim().toLowerCase())
            if (hit) return { full_name: line.slice(0, ci).trim(), class: hit }
          }
          return { full_name: line, class: defaultClass }
        })
    }
    // Each line: "Full Name" or "Full Name, 6A" or "Full Name — 6A"
    return studentsRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(.+?)[\s,—-]+(\d{1,2})\s*([A-Za-z0-9])$/)
        if (m) return { full_name: m[1].trim(), class: (m[2] + m[3]).toUpperCase() }
        return { full_name: line, class: defaultClass }
      })
  }, [studentsRaw, classLabels, isCoaching])

  const submit = async () => {
    if (busy) return
    setBusy(true)
    try {
      const payload: {
        subjects: string[]
        classes?: ClassRow[]
        batches?: BatchRow[]
        periods?: PeriodInput[]
        students?: StudentInput[]
      } = isCoaching
        ? { subjects, batches }
        : { subjects, classes }
      if (includePeriods) payload.periods = periods
      if (parsedStudents.length) payload.students = parsedStudents

      const res = await apiClient.post<{ created: Record<string, number> }>(
        "/api/onboarding/complete",
        payload
      )
      const { classes: c, subjects: s, students: st } = res.created
      const groupWord = isCoaching
        ? `${c} batch${c === 1 ? "" : "es"}`
        : `${c} class${c === 1 ? "" : "es"}`
      toast.success(
        `Set up: ${groupWord}, ${s} subject${s === 1 ? "" : "s"}${
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
    (step === 1 && (isCoaching ? batches.length > 0 : classes.length > 0)) ||
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

      <Steps current={step} isCoaching={isCoaching} />

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
        {step === 1 && (
          isCoaching ? (
            <StepBatches
              batches={batches}
              subjects={subjects}
              onAdd={addBatchRow}
              onRemove={removeBatchRow}
            />
          ) : (
            <StepClasses
              classes={classes}
              subjects={subjects}
              onAdd={addClassRow}
              onRemove={removeClassRow}
            />
          )
        )}
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
            classLabels={classLabels}
            raw={studentsRaw}
            setRaw={setStudentsRaw}
            parsed={parsedStudents}
            isCoaching={isCoaching}
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

function Steps({ current, isCoaching }: { current: 0 | 1 | 2 | 3; isCoaching: boolean }) {
  const labels = ["Subjects", isCoaching ? "Batches" : "Classes", "Bell", "Students"]
  // Phones can't fit four labelled steps in 375px; only the current step
  // keeps its label there, the rest collapse to numbered dots.
  return (
    <ol className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:gap-2">
      {labels.map((l, i) => (
        <li key={l} className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
              i < current
                ? "bg-primary text-primary-foreground"
                : i === current
                  ? "bg-primary/15 text-primary"
                  : "bg-muted"
            )}
          >
            {i < current ? <CheckIcon className="size-3.5" weight="bold" /> : i + 1}
          </span>
          <span
            className={cn(
              "truncate",
              i === current ? "font-medium text-foreground" : "hidden sm:inline"
            )}
          >
            {l}
          </span>
          {i < labels.length - 1 && <span className="h-px w-3 shrink-0 bg-border sm:w-6" />}
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
  subjects,
  onAdd,
  onRemove,
}: {
  classes: ClassRow[]
  subjects: string[]
  onAdd: (row: ClassRow) => boolean
  onRemove: (idx: number) => void
}) {
  const single = subjects.length === 1
  const [grade, setGrade] = useState<string>("")
  const [section, setSection] = useState("")
  const [subject, setSubject] = useState<string>(single ? subjects[0] : "")

  // If the user went back and changed subjects, keep the draft coherent.
  useEffect(() => {
    if (single) setSubject(subjects[0])
    else if (subject && !subjects.includes(subject)) setSubject("")
  }, [subjects, single, subject])

  const canAdd = grade !== "" && section.trim() !== "" && subject !== ""

  const add = () => {
    if (!canAdd) return
    const row = {
      grade: Number(grade),
      section: section.trim().toUpperCase(),
      subject,
    }
    if (!onAdd(row)) {
      toast.info(`${row.grade}${row.section} — ${row.subject} is already added`)
      return
    }
    // Keep grade + subject sticky (fast entry of 6A, 6B, 6C…), clear section.
    setSection("")
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Which classes do you teach?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add one row per class and subject you actually teach — e.g. 6A
          Science and 7B Maths. Same class with two subjects? Add it twice,
          once per subject.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-secondary-foreground">Grade</span>
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Grade" />
            </SelectTrigger>
            <SelectContent>
              {GRADES.map((g) => (
                <SelectItem key={g} value={String(g)}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-secondary-foreground">Section</span>
          <Input
            value={section}
            onChange={(e) => setSection(e.target.value.slice(-1).toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                add()
              }
            }}
            placeholder="A"
            maxLength={1}
            className="w-16 text-center uppercase"
            aria-label="Section"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-secondary-foreground">Subject</span>
          {single ? (
            <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
              {subjects[0]}
            </div>
          ) : (
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    {sub}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button type="button" onClick={add} disabled={!canAdd}>
          Add class
        </Button>
      </div>

      {classes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing added yet — you need at least one class to continue.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {classes.map((c, i) => (
            <li key={`${c.grade}${c.section}-${c.subject}`} className="flex items-center gap-3 px-3 py-2">
              <span className="w-12 shrink-0 text-sm font-semibold">
                {c.grade}
                {c.section}
              </span>
              <span className="flex-1 truncate text-sm text-muted-foreground">{c.subject}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Remove ${c.grade}${c.section} ${c.subject}`}
                className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StepBatches({
  batches,
  subjects,
  onAdd,
  onRemove,
}: {
  batches: BatchRow[]
  subjects: string[]
  onAdd: (row: BatchRow) => boolean
  onRemove: (idx: number) => void
}) {
  const single = subjects.length === 1
  const [name, setName] = useState("")
  const [grade, setGrade] = useState<string>("")
  const [subject, setSubject] = useState<string>(single ? subjects[0] : "")

  useEffect(() => {
    if (single) setSubject(subjects[0])
    else if (subject && !subjects.includes(subject)) setSubject("")
  }, [subjects, single, subject])

  const canAdd = name.trim() !== "" && subject !== ""

  const add = () => {
    if (!canAdd) return
    const row: BatchRow = {
      name: name.trim(),
      subject,
      grade: grade === "" ? 0 : Number(grade),
    }
    if (!onAdd(row)) {
      toast.info(`${row.name} — ${row.subject} is already added`)
      return
    }
    setName("")
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Which batches do you teach?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add one row per batch and subject — e.g. "Weekend JEE 10th"
          Physics, "Morning Foundation" Maths. Same batch with two subjects?
          Add it twice, once per subject.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex w-full flex-col gap-1.5 sm:w-auto">
          <span className="text-[13px] font-medium text-secondary-foreground">Batch name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                add()
              }
            }}
            placeholder="e.g. Weekend JEE 10th"
            maxLength={80}
            className="w-full sm:w-64"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-secondary-foreground">
            Grade{" "}
            <span className="text-[11px] font-normal text-muted-foreground">(optional)</span>
          </span>
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Mixed" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Mixed</SelectItem>
              {GRADES.map((g) => (
                <SelectItem key={g} value={String(g)}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-secondary-foreground">Subject</span>
          {single ? (
            <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
              {subjects[0]}
            </div>
          ) : (
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    {sub}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button type="button" onClick={add} disabled={!canAdd}>
          Add batch
        </Button>
      </div>

      {batches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing added yet — you need at least one batch to continue.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {batches.map((b, i) => (
            <li key={`${b.name}-${b.subject}`} className="flex items-center gap-3 px-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                <span className="truncate text-sm font-medium">
                  {b.name}
                  {b.grade ? <span className="ml-2 text-xs font-normal text-muted-foreground">grade {b.grade}</span> : null}
                </span>
                <span className="truncate text-xs text-muted-foreground sm:w-32 sm:shrink-0 sm:text-sm">{b.subject}</span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Remove ${b.name} ${b.subject}`}
                className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
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
          Your daily timings
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
        Use these timings
      </label>
      {include && (
        <div className="flex flex-col divide-y rounded-lg border">
          {periods.map((p, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 px-3 py-2 text-sm sm:grid sm:grid-cols-[1fr_100px_100px_auto] sm:items-center"
            >
              <Input
                value={p.name}
                onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className="h-8"
              />
              {/* sm:contents dissolves this wrapper so the grid columns apply */}
              <div className="flex items-center gap-2 sm:contents">
                <Input
                  type="time"
                  value={p.start_time}
                  onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x)))}
                  className="h-8 min-w-0 flex-1"
                />
                <Input
                  type="time"
                  value={p.end_time}
                  onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, end_time: e.target.value } : x)))}
                  className="h-8 min-w-0 flex-1"
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StepStudents({
  classLabels,
  raw,
  setRaw,
  parsed,
  isCoaching,
}: {
  classLabels: string[]
  raw: string
  setRaw: (v: string) => void
  parsed: StudentInput[]
  isCoaching: boolean
}) {
  const exampleLabel = classLabels[1] ?? classLabels[0]
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UsersIcon className="size-5" />
          Add your students
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isCoaching ? (
            <>
              One per line. Add the batch with a comma if the name isn't for
              your first batch — e.g.{" "}
              <span className="font-mono">
                Aarav Sharma, {exampleLabel ?? "Morning Foundation"}
              </span>
              . Fully skippable — you can bulk-import later.
            </>
          ) : (
            <>
              One per line. Add the class with a comma or a dash if the name isn't
              for your first class — e.g. <span className="font-mono">Aarav Sharma, 6B</span>.
              Fully skippable — you can bulk-import later.
            </>
          )}
        </p>
      </div>
      <textarea
        rows={8}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={
          classLabels.length
            ? `Aarav Sharma\nPriya Iyer, ${exampleLabel}\n…`
            : "Aarav Sharma\nPriya Iyer\n…"
        }
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {parsed.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {parsed.length} student{parsed.length === 1 ? "" : "s"} across{" "}
          {new Set(parsed.map((s) => s.class)).size}{" "}
          {isCoaching ? "batch" : "class"}
          {new Set(parsed.map((s) => s.class)).size === 1 ? "" : "es"}.
        </p>
      )}
    </div>
  )
}
