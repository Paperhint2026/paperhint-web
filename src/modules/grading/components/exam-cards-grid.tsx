import { useEffect, useMemo, useState } from "react"
import { AlertTriangleIcon, ChevronRightIcon, ClipboardCheckIcon, SearchIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

// ── Types ─────────────────────────────────────────────────────────────────
// Matches the response shape of GET /api/grading/class-subject/:id/exam-cards.
// Keep in sync with grading.controller.js -> exports.getExamCards.

type ExamCard = {
  id: string
  exam_name: string
  total_marks: number
  pass_marks: number | null
  created_at: string
  questions_count: number
  submissions: { total: number; graded: number; pending: number; failed: number }
  marks: {
    average: number | null
    top: { marks: number; student_id: string; student_name: string | null } | null
    // null when exams.pass_marks is unset — UI omits the metric slot entirely.
    failing_count: number | null
  }
  review: { submissions_needing_review: number; total_flagged_questions: number }
}

type ExamCardsResponse = {
  totals: {
    students: number
    exams: number
    in_progress: number
    needs_review: number
    done: number
  }
  exams: ExamCard[]
}

type Filter = "all" | "needs-review" | "in-progress" | "done"

type Props = {
  classSubjectId: string
  onSelectExam: (examId: string, options?: { filter?: "flagged" }) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
}

// Classify a card into a filter bucket. "Done" requires every enrolled
// student to have a graded submission AND no flagged questions — the same
// definition the backend uses in `totals.done`.
function classify(card: ExamCard, totalStudents: number): Filter {
  if (card.review.submissions_needing_review > 0) return "needs-review"
  if (
    totalStudents > 0 &&
    card.submissions.graded === totalStudents &&
    card.review.submissions_needing_review === 0
  ) {
    return "done"
  }
  return "in-progress"
}

// ── Component ─────────────────────────────────────────────────────────────

export function ExamCardsGrid({ classSubjectId, onSelectExam }: Props) {
  const [data, setData] = useState<ExamCardsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState<Filter | "all">("all")
  const [searchInput, setSearchInput] = useState("")
  // Debounced value drives the actual filter. 200ms is short enough to feel
  // instant on a modern keyboard but avoids re-filtering on every keystroke
  // when the list is longer (large classes may have 30+ exams).
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput.trim().toLowerCase()), 200)
    return () => clearTimeout(handle)
  }, [searchInput])

  useEffect(() => {
    if (!classSubjectId) return
    let cancelled = false
    setIsLoading(true)
    apiClient
      .get<ExamCardsResponse>(`/api/grading/class-subject/${classSubjectId}/exam-cards`)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        console.error("Failed to fetch exam cards:", err)
        toast.error("Couldn't load exams")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [classSubjectId])

  const totalStudents = data?.totals.students ?? 0

  const filteredExams = useMemo(() => {
    if (!data) return []
    const byBucket = filter === "all"
      ? data.exams
      : data.exams.filter((c) => classify(c, totalStudents) === filter)
    if (!debouncedSearch) return byBucket
    return byBucket.filter((c) => c.exam_name.toLowerCase().includes(debouncedSearch))
  }, [data, filter, totalStudents, debouncedSearch])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </div>
    )
  }

  if (!data || data.exams.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
        <ClipboardCheckIcon className="size-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No exams yet</p>
        <p className="text-xs text-muted-foreground">
          Create one from the <span className="font-medium">Exams</span> tab.
        </p>
      </div>
    )
  }

  const summary = [
    `${data.totals.exams} exam${data.totals.exams === 1 ? "" : "s"}`,
    data.totals.needs_review > 0 && `${data.totals.needs_review} need review`,
    data.totals.in_progress > 0 && `${data.totals.in_progress} in progress`,
    data.totals.done > 0 && `${data.totals.done} fully graded`,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="space-y-3">
      {/* Toolbar: summary line + search + filter chips */}
      <div className="flex flex-col gap-3 border-b pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">{summary}</span>
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search exams…"
              className="h-9 pl-8 text-sm"
              aria-label="Search exams by name"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: "all", label: "All" },
              { key: "needs-review", label: `Needs review${data.totals.needs_review ? ` (${data.totals.needs_review})` : ""}` },
              { key: "in-progress", label: "In progress" },
              { key: "done", label: "Done" },
            ] as { key: Filter; label: string }[]
          ).map((chip) => (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                filter === chip.key
                  ? "border-foreground/20 bg-muted font-medium text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card grid */}
      {filteredExams.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          No exams match this filter.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredExams.map((card) => (
            <ExamCardView
              key={card.id}
              card={card}
              totalStudents={totalStudents}
              onOpen={() => onSelectExam(card.id)}
              onOpenFlagged={() => onSelectExam(card.id, { filter: "flagged" })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────

function ExamCardView({
  card,
  totalStudents,
  onOpen,
  onOpenFlagged,
}: {
  card: ExamCard
  totalStudents: number
  onOpen: () => void
  onOpenFlagged: () => void
}) {
  const { submissions, marks, review } = card

  // Progress bar denominator is total enrolled students, not just students
  // who uploaded — a class of 26 with 20 graded and 0 pending should still
  // show 20/26, not 20/20.
  const progressPct =
    totalStudents > 0 ? Math.min(100, Math.round((submissions.graded / totalStudents) * 100)) : 0

  const isDone = totalStudents > 0 && submissions.graded === totalStudents && review.submissions_needing_review === 0
  const isEmpty = submissions.total === 0
  // "Remaining" folds together not-started, uploaded/processing, and failed —
  // a teacher opening the card sees per-student detail there.
  const remaining = Math.max(0, totalStudents - submissions.graded)

  const showFailing = marks.failing_count != null

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
      className="group flex cursor-pointer flex-col gap-2.5 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20"
    >
      {/* Head */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <p className="truncate text-sm font-medium">{card.exam_name}</p>
          <ChevronRightIcon
            className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <span className="whitespace-nowrap text-xs text-muted-foreground">/{card.total_marks}</span>
      </div>

      <p className="-mt-1.5 text-xs text-muted-foreground">
        {formatDate(card.created_at)} · {card.questions_count} question
        {card.questions_count === 1 ? "" : "s"}
        {card.pass_marks == null && !isEmpty ? " · no pass mark" : ""}
      </p>

      {/* Progress */}
      <div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all ${isDone ? "bg-emerald-500" : "bg-blue-500"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
          <span>
            {submissions.graded} of {totalStudents} graded
          </span>
          {isDone ? (
            <span className="font-medium text-emerald-600 dark:text-emerald-400">complete</span>
          ) : remaining > 0 ? (
            <span>{remaining} pending</span>
          ) : null}
        </div>
      </div>

      {/* Metrics (only when at least one submission is graded) */}
      {submissions.graded > 0 && marks.average != null && (
        <div
          className={`grid gap-1.5 border-t pt-2.5 ${
            showFailing ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          <Metric label="Average" value={String(marks.average)} />
          <Metric
            label="Top"
            value={marks.top ? String(marks.top.marks) : "—"}
            sub={marks.top?.student_name ?? undefined}
            size="sm"
          />
          {showFailing && (
            <Metric
              label="Failing"
              value={String(marks.failing_count)}
              tone={marks.failing_count! > 0 ? "danger" : "default"}
            />
          )}
        </div>
      )}

      {/* Empty state (no submissions yet) */}
      {isEmpty && (
        <div className="mt-1 flex flex-col items-center justify-center gap-1 border-t py-3 text-center">
          <UploadIcon className="size-4 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">No sheets uploaded yet</p>
          <p className="text-[11px] italic text-muted-foreground/70">
            Open the exam to upload per student
          </p>
        </div>
      )}

      {/* Review alert (only when flagged) — inner click deep-links to the
          flagged filter, stopping propagation so it doesn't double-trigger
          the card click. */}
      {review.submissions_needing_review > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenFlagged()
          }}
          className="flex items-center gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-left text-xs text-amber-900 transition-colors hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
        >
          <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {review.submissions_needing_review} sheet
            {review.submissions_needing_review === 1 ? "" : "s"} need review ·{" "}
            {review.total_flagged_questions} question
            {review.total_flagged_questions === 1 ? "" : "s"} flagged
          </span>
        </button>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  sub,
  size = "md",
  tone = "default",
}: {
  label: string
  value: string
  sub?: string
  size?: "sm" | "md"
  tone?: "default" | "danger"
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 font-medium leading-tight ${
          size === "sm" ? "text-sm" : "text-lg"
        } ${tone === "danger" ? "text-red-600 dark:text-red-400" : ""}`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</div>
      )}
    </div>
  )
}
