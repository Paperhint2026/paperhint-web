import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChartBarIcon,
  ExamIcon,
  FileTextIcon,
  TrophyIcon,
  UsersIcon,
} from "@phosphor-icons/react"
import dayjs from "dayjs"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { ClassPageHeader } from "@/components/layout/class-page-header"
import {
  PageToolbar,
  PageToolbarSkeleton,
} from "@/components/shared/page-toolbar"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Sticker } from "@/components/shared/sticker"
import { countSummary, tameCaps } from "@/lib/format"
import { RingGauge } from "../components/ring-gauge"
import { StudentMarksPreview } from "../components/student-marks-preview"
import {
  cellPct,
  getInitials,
  isGrading,
  scoreTone,
  TONE_BAR,
  TONE_TEXT,
  type ExamCol,
  type MarkCell,
  type StudentRow,
} from "../lib/marks"

interface MatrixResponse {
  exams: ExamCol[]
  students: StudentRow[]
  marks: Record<string, Record<string, MarkCell>>
}

type SortKey = "roll" | "name"

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
  const [previewId, setPreviewId] = useState<string | null>(null)
  const previewStudent = students.find((st) => st.id === previewId) ?? null

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
        <UsersIcon className="size-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Select a class from the sidebar
        </p>
      </div>
    )
  }

  const filtering = search.trim().length > 0

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex min-h-full flex-col gap-5 pb-12"
      )}
    >
      <ClassPageHeader
        icon={UsersIcon}
        title="Students"
        count={students.length || undefined}
        description="Everyone in this class, with their marks across every paper."
      />

      <LoadingSwap
        loading={isLoading}
        skeleton={<MarksPageSkeleton />}
        className="flex-1"
      >
        {students.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
            <Sticker name="friends" size={200} />
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
        ) : (
          <div className="flex flex-col gap-5">
            {/* ── Class snapshot — numbers on one hairline row ── */}
            {exams.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-3">
                {[
                  {
                    icon: ExamIcon,
                    value: String(exams.length),
                    label: `${exams.length === 1 ? "paper" : "papers"} · ${snapshot.gradedStudents} of ${students.length} students graded`,
                    tone: "ok" as const,
                  },
                  {
                    icon: ChartBarIcon,
                    value:
                      snapshot.classAvg != null
                        ? `${Math.round(snapshot.classAvg)}%`
                        : "—",
                    label: "class average",
                    tone:
                      snapshot.classAvg != null
                        ? scoreTone(snapshot.classAvg)
                        : ("ok" as const),
                  },
                  {
                    icon: TrophyIcon,
                    value: snapshot.top
                      ? `${Math.round(snapshot.top.pct)}%`
                      : "—",
                    label: snapshot.top
                      ? `top · ${snapshot.top.name}`
                      : "no graded papers yet",
                    tone: snapshot.top
                      ? scoreTone(snapshot.top.pct)
                      : ("ok" as const),
                  },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center gap-1.5">
                    <stat.icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        stat.tone !== "ok"
                          ? TONE_TEXT[stat.tone]
                          : "text-foreground"
                      )}
                    >
                      {stat.value}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3">
                <Sticker name="sleep" size={40} />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-secondary-foreground">
                    No papers graded yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Marks appear on each desk once a paper has been graded.
                  </p>
                </div>
              </div>
            )}

            <PageToolbar
              search={{
                value: search,
                onChange: setSearch,
                placeholder: "Search by name, roll or register number…",
              }}
              summary={countSummary(
                filteredSorted.length,
                students.length,
                "student",
                filtering
              )}
              trailing={
                <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                  {(
                    [
                      { key: "roll", label: "Roll" },
                      { key: "name", label: "Name" },
                    ] as { key: SortKey; label: string }[]
                  ).map((chip) => {
                    const on = sortKey === chip.key
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => toggleSort(chip.key)}
                        aria-pressed={on}
                        className={cn(
                          "inline-flex h-7 items-center gap-1 rounded-[5px] px-2.5 text-xs transition-colors",
                          on
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {chip.label}
                        {on &&
                          (sortAsc ? (
                            <ArrowUpIcon className="size-3" />
                          ) : (
                            <ArrowDownIcon className="size-3" />
                          ))}
                      </button>
                    )
                  })}
                </div>
              }
            />

            {/* ── Classroom — one desk per student ── */}
            {filteredSorted.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
                <Sticker
                  name={filtering ? "lost" : "friends"}
                  size={filtering ? 120 : 200}
                />
                <div className="flex max-w-[360px] flex-col items-center gap-1 text-center">
                  <p className="text-base font-medium text-secondary-foreground">
                    {filtering
                      ? "Nobody matches that"
                      : "No students in this class yet"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {filtering
                      ? "Try a different name or number."
                      : "Once students are enrolled in this section they'll appear here with their marks."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
                {filteredSorted.map((s) => (
                  <StudentCard
                    key={s.id}
                    student={s}
                    exams={exams}
                    cells={marks[s.id]}
                    averagePct={averages[s.id]}
                    onOpen={() => setPreviewId(s.id)}
                    onOpenExam={(examId) =>
                      navigate(`/class/${classSubjectId}/exams?exam=${examId}`)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </LoadingSwap>

      <StudentMarksPreview
        student={previewStudent}
        exams={exams}
        cells={previewStudent ? marks[previewStudent.id] : undefined}
        averagePct={previewStudent ? averages[previewStudent.id] : undefined}
        classSubjectId={classSubjectId}
        open={!!previewStudent}
        onOpenChange={(open) => !open && setPreviewId(null)}
      />
    </div>
  )
}

// ── Student report card ───────────────────────────────────────────────────

/** The marks page before the class arrives: the snapshot row, the toolbar,
 *  then desks in the same grid as StudentCard — roll tag, avatar, two identity
 *  lines and the average ring, a few paper rows, and the graded footer. */
function MarksPageSkeleton() {
  return (
    <div aria-hidden className="contents">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-3">
        {[40, 28, 36].map((w, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Skeleton className="size-3.5 rounded" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-3" style={{ width: `${w * 4}px` }} />
          </div>
        ))}
      </div>

      <PageToolbarSkeleton filters={false} />

      <div className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-xl border border-border bg-background"
          >
            <div className="flex items-center gap-3 p-4">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="size-10 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="size-10 rounded-full" />
            </div>
            <div className="flex flex-1 flex-col gap-2.5 border-t border-dashed border-border px-4 py-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div
                  key={j}
                  className="grid grid-cols-[minmax(0,1fr)_4.5rem_3.75rem] items-center gap-3"
                >
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-b-xl border-t border-border bg-sidebar/60 px-4 py-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StudentCard({
  student,
  exams,
  cells,
  averagePct,
  onOpen,
  onOpenExam,
}: {
  student: StudentRow
  exams: ExamCol[]
  cells: Record<string, MarkCell> | undefined
  averagePct: number | undefined
  onOpen: () => void
  onOpenExam: (examId: string) => void
}) {
  const gradedCount = exams.filter(
    (ex) => cells?.[ex.id]?.status === "graded"
  ).length
  const hasAnyCell = exams.some((ex) => cells?.[ex.id])

  // Best paper by percentage — the one line worth calling out in the footer.
  let best: { name: string; pct: number } | null = null
  for (const ex of exams) {
    const cell = cells?.[ex.id]
    if (cell?.status === "graded" && ex.total_marks > 0) {
      const pct = ((cell.final ?? 0) / ex.total_marks) * 100
      if (!best || pct > best.pct) best = { name: ex.exam_name, pct }
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      aria-label={`Preview marks for ${student.full_name}`}
      className="group flex cursor-pointer flex-col rounded-xl border border-border bg-background transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Identity row — roll, who, and the average as a ring */}
      <div className="flex items-center gap-3 p-4">
        <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-sidebar px-1.5 text-[11px] font-semibold text-secondary-foreground tabular-nums ring-1 ring-border/60">
          {String(student.roll_number).padStart(2, "0")}
        </span>
        <Avatar className="size-10">
          <AvatarFallback className="bg-muted text-xs text-foreground/70">
            {getInitials(student.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {student.full_name}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {student.register_number ?? "No register number"}
          </p>
        </div>
        <RingGauge pct={averagePct ?? null} />
      </div>

      {/* Papers — one line each with an inline meter */}
      <div className="flex flex-1 flex-col gap-2.5 border-t border-dashed border-border px-4 py-3">
        {exams.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No papers yet</p>
        ) : !hasAnyCell ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <FileTextIcon className="size-3.5 shrink-0" />
            No sheets uploaded yet
          </div>
        ) : (
          exams.map((ex) => (
            <ExamMarkRow
              key={ex.id}
              exam={ex}
              cell={cells?.[ex.id]}
              onOpen={() => onOpenExam(ex.id)}
            />
          ))
        )}
      </div>

      {/* Footer — how much is graded, and the best paper */}
      {exams.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-b-xl border-t border-border bg-sidebar/60 px-4 py-2 text-[11px] text-muted-foreground tabular-nums">
          <span>
            <span className="font-medium text-secondary-foreground">
              {gradedCount}
            </span>{" "}
            of {exams.length} {exams.length === 1 ? "paper" : "papers"} graded
          </span>
          {best && (
            <span className="flex min-w-0 items-center gap-1">
              <TrophyIcon className="size-3 shrink-0" />
              <span className="truncate">{tameCaps(best.name)}</span>
            </span>
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
  const grading = isGrading(cell)
  const pct = cellPct(exam, cell)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_3.75rem] items-center gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
            className="min-w-0 truncate text-left text-xs text-secondary-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            {tameCaps(exam.exam_name)}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {exam.exam_name} · {dayjs(exam.created_at).format("D MMM")} ·{" "}
          {exam.total_marks} marks
        </TooltipContent>
      </Tooltip>

      {/* Meter */}
      <div
        className={cn(
          "h-1.5 overflow-hidden rounded-full",
          !cell
            ? "border border-dashed border-border"
            : grading
              ? "bg-violet-100 dark:bg-violet-900/40"
              : "bg-muted"
        )}
      >
        {pct != null && (
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              TONE_BAR[scoreTone(pct)]
            )}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        )}
        {grading && (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-violet-400" />
        )}
      </div>

      {/* Score */}
      {!cell ? (
        <span className="text-right text-[11px] text-muted-foreground/60">
          —
        </span>
      ) : graded ? (
        <span
          className={cn(
            "text-right text-xs font-semibold tabular-nums",
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
            "justify-self-end rounded-full px-1.5 py-px text-[10px] font-medium",
            grading
              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
          )}
        >
          {grading ? "Grading" : tameCaps(cell.status)}
        </span>
      )}
    </div>
  )
}
