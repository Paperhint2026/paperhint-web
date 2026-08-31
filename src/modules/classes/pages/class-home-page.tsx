import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  AlertTriangleIcon,
  BookOpenIcon,
  ChevronRightIcon,
  ListChecksIcon,
  NewspaperIcon,
  SchoolIcon,
  Users2Icon,
} from "lucide-react"
import dayjs from "dayjs"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import {
  useTeacherAssignments,
  classLabel,
} from "@/hooks/use-teacher-assignments"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

// Shapes reused from the grading exam-cards endpoint — see
// grading.controller.js -> exports.getExamCards.
interface ExamCardLite {
  id: string
  exam_name: string
  total_marks: number
  created_at: string
  questions_count: number
  submissions: {
    total: number
    graded: number
    pending: number
    failed: number
  }
  marks: { average: number | null }
  review: { submissions_needing_review: number }
}

interface ExamCardsResponse {
  totals: {
    students: number
    exams: number
    in_progress: number
    needs_review: number
    done: number
  }
  exams: ExamCardLite[]
}

interface MaterialLite {
  id: string
  title: string
  uploaded_at: string
}

export function ClassHomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { classSubjectId } = useParams<{ classSubjectId: string }>()
  const { assignments } = useTeacherAssignments()

  // Loading is derived: data is stamped with the class-subject it was
  // fetched for, so switching classes shows the skeleton without a
  // synchronous setState in the effect.
  const [data, setData] = useState<{
    csId: string
    cards: ExamCardsResponse | null
    materials: MaterialLite[]
  } | null>(null)
  const isLoading = data?.csId !== classSubjectId

  useEffect(() => {
    if (!classSubjectId) return
    let cancelled = false
    Promise.allSettled([
      apiClient.get<ExamCardsResponse>(
        `/api/grading/class-subject/${classSubjectId}/exam-cards`
      ),
      apiClient.get<{ materials: MaterialLite[] }>(
        `/api/knowledge/materials/${classSubjectId}`
      ),
    ]).then(([cardsRes, materialsRes]) => {
      if (cancelled) return
      setData({
        csId: classSubjectId,
        cards: cardsRes.status === "fulfilled" ? cardsRes.value : null,
        materials:
          materialsRes.status === "fulfilled"
            ? (materialsRes.value.materials ?? [])
            : [],
      })
    })
    return () => {
      cancelled = true
    }
  }, [classSubjectId])

  const cards = data?.cards ?? null
  const materials = data?.materials ?? []

  const assignment = assignments.find(
    (a) => a.class_subject_id === classSubjectId
  )

  // Class average % across exams that have at least one graded submission.
  const classAvgPct = useMemo(() => {
    if (!cards) return null
    const pcts = cards.exams
      .filter((e) => e.marks.average != null && e.total_marks > 0)
      .map((e) => (e.marks.average! / e.total_marks) * 100)
    if (pcts.length === 0) return null
    return pcts.reduce((a, b) => a + b, 0) / pcts.length
  }, [cards])

  const recentExams = useMemo(() => {
    if (!cards) return []
    return [...cards.exams]
      .sort(
        (a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
      )
      .slice(0, 3)
  }, [cards])

  if (!user) return null

  if (!classSubjectId) {
    return (
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-3 p-8">
        <SchoolIcon className="size-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Select a class from the sidebar
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
        <Skeleton className="h-16 w-72" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const totals = cards?.totals ?? {
    students: 0,
    exams: 0,
    in_progress: 0,
    needs_review: 0,
    done: 0,
  }
  const latestMaterial = materials[0] ?? null
  const latestExam = recentExams[0] ?? null

  const summaryLine = [
    `${totals.students} student${totals.students === 1 ? "" : "s"}`,
    `${totals.exams} exam${totals.exams === 1 ? "" : "s"}`,
    `${materials.length} source${materials.length === 1 ? "" : "s"}`,
  ].join(" · ")

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <SchoolIcon className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {assignment ? classLabel(assignment) : "Class"}
          </h1>
          <p className="text-sm text-muted-foreground">{summaryLine}</p>
        </div>
      </div>

      {/* ── Needs attention ──────────────────────────────────── */}
      {totals.needs_review > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/40">
          <AlertTriangleIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="min-w-0 flex-1 text-sm text-amber-900 dark:text-amber-200">
            {totals.needs_review} answer sheet
            {totals.needs_review === 1 ? "" : "s"} waiting for your review
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 bg-transparent text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/40"
            onClick={() => navigate(`/class/${classSubjectId}/grading`)}
          >
            Review now
          </Button>
        </div>
      )}

      {/* ── Areas ────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <AreaCard
          icon={<BookOpenIcon className="size-4.5" />}
          iconClass="bg-blue-500"
          title="Knowledge"
          description="Textbooks and notes the AI uses for this class"
          stat={`${materials.length} source${materials.length === 1 ? "" : "s"}`}
          detail={
            latestMaterial
              ? `Latest: ${latestMaterial.title}`
              : "Upload a textbook to get started"
          }
          onClick={() => navigate(`/class/${classSubjectId}/knowledge`)}
        />
        <AreaCard
          icon={<NewspaperIcon className="size-4.5" />}
          iconClass="bg-violet-500"
          title="Exams"
          description="Create question papers with AI or upload your own"
          stat={`${totals.exams} exam${totals.exams === 1 ? "" : "s"}`}
          detail={
            latestExam
              ? `Latest: ${latestExam.exam_name} · ${dayjs(latestExam.created_at).format("MMM D")}`
              : "Create your first exam"
          }
          onClick={() => navigate(`/class/${classSubjectId}/exams`)}
        />
        <AreaCard
          icon={<ListChecksIcon className="size-4.5" />}
          iconClass="bg-amber-500"
          title="Grading"
          description="Upload answer sheets and let AI grade them"
          stat={
            totals.exams === 0
              ? "Nothing to grade yet"
              : `${totals.in_progress} in progress · ${totals.done} done`
          }
          detail={
            totals.needs_review > 0
              ? `${totals.needs_review} sheet${totals.needs_review === 1 ? "" : "s"} need review`
              : totals.exams > 0
                ? "All caught up"
                : "Grading starts once an exam has questions"
          }
          detailTone={totals.needs_review > 0 ? "warning" : "default"}
          onClick={() => navigate(`/class/${classSubjectId}/grading`)}
        />
        <AreaCard
          icon={<Users2Icon className="size-4.5" />}
          iconClass="bg-emerald-500"
          title="Students"
          description="The classroom roster with everyone's marks"
          stat={`${totals.students} student${totals.students === 1 ? "" : "s"}`}
          detail={
            classAvgPct != null
              ? `Class average ${Math.round(classAvgPct)}%`
              : "No graded exams yet"
          }
          onClick={() => navigate(`/class/${classSubjectId}/students`)}
        />
      </div>

      {/* ── Recent exams ─────────────────────────────────────── */}
      {recentExams.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Recent exams</h2>
            <button
              onClick={() => navigate(`/class/${classSubjectId}/exams`)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
            </button>
          </div>
          <div className="divide-y rounded-xl border bg-card">
            {recentExams.map((ex) => {
              const progressPct =
                totals.students > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (ex.submissions.graded / totals.students) * 100
                      )
                    )
                  : 0
              const isDone =
                totals.students > 0 &&
                ex.submissions.graded === totals.students &&
                ex.review.submissions_needing_review === 0
              return (
                <button
                  key={ex.id}
                  onClick={() =>
                    navigate(`/class/${classSubjectId}/exams?exam=${ex.id}`)
                  }
                  className="group flex w-full items-center gap-4 px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {ex.exam_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dayjs(ex.created_at).format("MMM D")} ·{" "}
                      {ex.questions_count} question
                      {ex.questions_count === 1 ? "" : "s"} · {ex.total_marks}{" "}
                      marks
                    </p>
                  </div>

                  <div className="hidden w-40 shrink-0 sm:block">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full",
                          isDone ? "bg-emerald-500" : "bg-blue-500"
                        )}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {ex.submissions.graded} of {totals.students} graded
                    </p>
                  </div>

                  <div className="w-16 shrink-0 text-right">
                    {ex.marks.average != null ? (
                      <>
                        <p className="text-sm font-medium tabular-nums">
                          {ex.marks.average}
                        </p>
                        <p className="text-[11px] text-muted-foreground">avg</p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">
                        —
                      </span>
                    )}
                  </div>

                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Area card ─────────────────────────────────────────────────────────────

function AreaCard({
  icon,
  iconClass,
  title,
  description,
  stat,
  detail,
  detailTone = "default",
  onClick,
}: {
  icon: React.ReactNode
  // Solid background color for the circular icon, e.g. "bg-blue-500".
  iconClass: string
  title: string
  description: string
  stat: string
  detail: string
  detailTone?: "default" | "warning"
  onClick: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className="group flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-5 transition-colors hover:border-foreground/20"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-white",
            iconClass
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {description}
          </p>
        </div>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      </div>

      <div className="flex items-baseline justify-between gap-3 border-t pt-3">
        <span className="text-sm font-medium">{stat}</span>
        <span
          className={cn(
            "min-w-0 truncate text-right text-xs",
            detailTone === "warning"
              ? "font-medium text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
          )}
        >
          {detail}
        </span>
      </div>
    </div>
  )
}
