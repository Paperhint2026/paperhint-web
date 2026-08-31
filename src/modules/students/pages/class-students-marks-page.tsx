import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ClipboardListIcon,
  FileTextIcon,
  SearchIcon,
  Users2Icon,
} from "lucide-react"
import dayjs from "dayjs"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

interface ExamCol {
  id: string
  exam_name: string
  total_marks: number
  created_at: string
}

interface StudentRow {
  id: string
  full_name: string
  roll_number: number
  register_number?: string | null
}

interface MarkCell {
  final: number | null
  ai: number | null
  status: string
}

interface MatrixResponse {
  exams: ExamCol[]
  students: StudentRow[]
  marks: Record<string, Record<string, MarkCell>>
}

type SortKey = "roll" | "name"

// Deterministic per-student avatar color — solid fills with white initials,
// matching the solid circular icons on the class home page.
const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-pink-500",
]

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function getAvatarColor(name: string) {
  const sum = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

// Performance tone shared by score text, progress bars and the average chip.
function scoreTone(pct: number): "good" | "ok" | "low" {
  if (pct >= 80) return "good"
  if (pct >= 50) return "ok"
  return "low"
}

const TONE_TEXT: Record<ReturnType<typeof scoreTone>, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  ok: "text-foreground",
  low: "text-amber-600 dark:text-amber-400",
}

const TONE_BAR: Record<ReturnType<typeof scoreTone>, string> = {
  good: "bg-emerald-500",
  ok: "bg-blue-500",
  low: "bg-amber-500",
}

const TONE_CHIP: Record<ReturnType<typeof scoreTone>, string> = {
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  ok: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  low: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
}

export function ClassStudentsMarksPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { classSubjectId } = useParams<{ classSubjectId: string }>()

  const [isLoading, setIsLoading] = useState(false)
  const [exams, setExams] = useState<ExamCol[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [marks, setMarks] = useState<Record<string, Record<string, MarkCell>>>(
    {}
  )
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("roll")
  const [sortAsc, setSortAsc] = useState(true)

  const fetchMatrix = useCallback(async (csId: string) => {
    setIsLoading(true)
    try {
      const res = await apiClient.get<MatrixResponse>(
        `/api/grading/class-subject/${csId}/marks-matrix`
      )
      setExams(res.exams ?? [])
      setStudents(res.students ?? [])
      setMarks(res.marks ?? {})
    } catch {
      setExams([])
      setStudents([])
      setMarks({})
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (classSubjectId) fetchMatrix(classSubjectId)
  }, [classSubjectId, fetchMatrix])

  // Per-student average % across graded exams — drives the card chip and
  // the "Top student" stat.
  const averages = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of students) {
      let sum = 0
      let count = 0
      for (const ex of exams) {
        const cell = marks[s.id]?.[ex.id]
        if (cell?.status === "graded" && ex.total_marks > 0) {
          sum += ((cell.final ?? 0) / ex.total_marks) * 100
          count++
        }
      }
      if (count > 0) map[s.id] = sum / count
    }
    return map
  }, [students, exams, marks])

  const snapshot = useMemo(() => {
    const graded = Object.values(averages)
    const classAvg =
      graded.length > 0
        ? graded.reduce((a, b) => a + b, 0) / graded.length
        : null
    let top: { name: string; pct: number } | null = null
    for (const s of students) {
      const pct = averages[s.id]
      if (pct != null && (top == null || pct > top.pct)) {
        top = { name: s.full_name, pct }
      }
    }
    return { classAvg, top, gradedStudents: graded.length }
  }, [averages, students])

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? students.filter(
          (s) =>
            s.full_name.toLowerCase().includes(q) ||
            String(s.roll_number).includes(q) ||
            (s.register_number ?? "").toLowerCase().includes(q)
        )
      : students.slice()

    list.sort((a, b) => {
      let cmp = 0
      if (sortKey === "name") cmp = a.full_name.localeCompare(b.full_name)
      else cmp = a.roll_number - b.roll_number
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [students, search, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  if (!user) return null

  if (!classSubjectId) {
    return (
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-3 p-8">
        <Users2Icon className="size-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Select a class from the sidebar
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
        <Skeleton className="h-9 w-full max-w-xs" />
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      </div>
    )
  }

  if (students.length === 0) {
    return (
      <div className="flex h-full flex-col p-4 md:p-6">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg bg-sidebar p-5">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Users2Icon className="size-6 text-muted-foreground" />
          </div>
          <div className="flex max-w-[400px] flex-col items-center gap-1 text-center">
            <p className="text-base font-medium text-secondary-foreground">
              No students in this class yet
            </p>
            <p className="text-sm text-muted-foreground">
              Students added to this class will show up here with their exam
              marks.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 md:p-6">
      {/* ── Header — same shape as the other class tabs ── */}
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          Students
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">
            ({students.length})
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          The classroom roster — every student with their marks across exams.
        </p>
      </div>

      {/* ── Class snapshot — the "what's happening in this class" strip ── */}
      {exams.length > 0 ? (
        <div className="grid grid-cols-3 gap-4 rounded-xl border bg-card p-4">
          <Stat
            label="Exams"
            value={String(exams.length)}
            sub={`${snapshot.gradedStudents} of ${students.length} students graded`}
          />
          <Stat
            label="Class average"
            value={
              snapshot.classAvg != null
                ? `${Math.round(snapshot.classAvg)}%`
                : "—"
            }
            sub="across graded exams"
            tone={
              snapshot.classAvg != null ? scoreTone(snapshot.classAvg) : "ok"
            }
          />
          <Stat
            label="Top student"
            value={snapshot.top ? `${Math.round(snapshot.top.pct)}%` : "—"}
            sub={snapshot.top?.name ?? "no graded exams yet"}
            tone={snapshot.top ? scoreTone(snapshot.top.pct) : "ok"}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-dashed p-4">
          <ClipboardListIcon className="size-5 shrink-0 text-muted-foreground/50" />
          <div>
            <p className="text-sm text-secondary-foreground">
              No exams conducted yet
            </p>
            <p className="text-xs text-muted-foreground">
              Marks appear on each student once an exam is graded.
            </p>
          </div>
        </div>
      )}

      {/* ── Toolbar — search + sort ─────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, roll no, register no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-full pl-9"
          />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Sort</span>
          {(
            [
              { key: "roll", label: "Roll" },
              { key: "name", label: "Name" },
            ] as { key: SortKey; label: string }[]
          ).map((chip) => (
            <button
              key={chip.key}
              onClick={() => toggleSort(chip.key)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
                sortKey === chip.key
                  ? "border-foreground/20 bg-muted font-medium text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              )}
            >
              {chip.label}
              {sortKey === chip.key &&
                (sortAsc ? (
                  <ArrowUpIcon className="size-3" />
                ) : (
                  <ArrowDownIcon className="size-3" />
                ))}
            </button>
          ))}
        </div>
      </div>

      {/* ── Classroom — one card per student ────────────────── */}
      {filteredSorted.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No students match your search.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSorted.map((s) => (
            <StudentCard
              key={s.id}
              student={s}
              exams={exams}
              cells={marks[s.id]}
              averagePct={averages[s.id]}
              onOpenExam={(examId) =>
                navigate(`/class/${classSubjectId}/exams?exam=${examId}`)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Student card ──────────────────────────────────────────────────────────

function StudentCard({
  student,
  exams,
  cells,
  averagePct,
  onOpenExam,
}: {
  student: StudentRow
  exams: ExamCol[]
  cells: Record<string, MarkCell> | undefined
  averagePct: number | undefined
  onOpenExam: (examId: string) => void
}) {
  const hasAnyCell = exams.some((ex) => cells?.[ex.id])

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
      {/* Identity */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
            getAvatarColor(student.full_name)
          )}
        >
          {getInitials(student.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{student.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            Roll {student.roll_number}
            {student.register_number ? ` · ${student.register_number}` : ""}
          </p>
        </div>
        {averagePct != null && (
          <span
            title="Average across graded exams"
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
              TONE_CHIP[scoreTone(averagePct)]
            )}
          >
            Avg {Math.round(averagePct)}%
          </span>
        )}
      </div>

      {/* Marks */}
      {exams.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t pt-3">
          {!hasAnyCell ? (
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
              <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">
                No exam sheets uploaded yet
              </p>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-medium tracking-wider text-muted-foreground/70 uppercase">
                Exam marks
              </p>
              {exams.map((ex) => (
                <ExamMarkRow
                  key={ex.id}
                  exam={ex}
                  cell={cells?.[ex.id]}
                  onOpen={() => onOpenExam(ex.id)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ExamMarkRow({
  exam,
  cell,
  onOpen,
}: {
  exam: ExamCol
  cell: MarkCell | undefined
  onOpen: () => void
}) {
  const graded = cell?.status === "graded"
  const pct =
    graded && exam.total_marks > 0
      ? ((cell.final ?? 0) / exam.total_marks) * 100
      : null

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onOpen}
          title={`${exam.exam_name} · ${dayjs(exam.created_at).format("MMM D")} · ${exam.total_marks} marks`}
          className="min-w-0 truncate text-left text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          {exam.exam_name}
        </button>

        {!cell ? (
          <span className="shrink-0 text-[11px] text-muted-foreground/50">
            Not uploaded
          </span>
        ) : graded ? (
          <span
            className={cn(
              "shrink-0 text-xs font-semibold tabular-nums",
              TONE_TEXT[scoreTone(pct ?? 0)]
            )}
          >
            {cell.final ?? 0}
            <span className="font-normal text-muted-foreground">
              /{exam.total_marks}
            </span>
          </span>
        ) : (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
              cell.status === "uploaded" || cell.status === "processing"
                ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            )}
          >
            {cell.status === "uploaded" || cell.status === "processing"
              ? "Pending"
              : cell.status}
          </span>
        )}
      </div>

      {pct != null && (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full", TONE_BAR[scoreTone(pct)])}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ── Snapshot stat — mirrors the Metric block used on grading cards ────────

function Stat({
  label,
  value,
  sub,
  tone = "ok",
}: {
  label: string
  value: string
  sub?: string
  tone?: ReturnType<typeof scoreTone>
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-lg leading-tight font-medium tabular-nums",
          tone !== "ok" && TONE_TEXT[tone]
        )}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {sub}
        </div>
      )}
    </div>
  )
}
