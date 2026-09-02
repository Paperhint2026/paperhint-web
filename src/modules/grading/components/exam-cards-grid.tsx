import { useEffect, useMemo, useState } from "react"
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  ClipboardTextIcon,
  HourglassIcon,
  MagnifyingGlassIcon,
  TrendDownIcon,
  TrendUpIcon,
  TrophyIcon,
  UploadIcon,
  WarningIcon,
  type Icon,
} from "@phosphor-icons/react"
import { useNavigate } from "react-router-dom"
import dayjs from "dayjs"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Sticker } from "@/components/shared/sticker"
import { tameCaps } from "@/lib/format"

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
  submissions: {
    total: number
    graded: number
    pending: number
    failed: number
  }
  marks: {
    average: number | null
    top: {
      marks: number
      student_id: string
      student_name: string | null
    } | null
    // null when exams.pass_marks is unset — UI omits the metric slot entirely.
    failing_count: number | null
  }
  review: {
    submissions_needing_review: number
    total_flagged_questions: number
  }
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
  const navigate = useNavigate()
  // Loading is derived: the response is stamped with the class-subject it
  // was fetched for, so switching classes shows the skeleton without a
  // synchronous setState inside the effect.
  const [fetched, setFetched] = useState<{
    csId: string
    data: ExamCardsResponse | null
  } | null>(null)
  const isLoading = fetched?.csId !== classSubjectId
  const data = fetched?.csId === classSubjectId ? fetched.data : null
  const [filter, setFilter] = useState<Filter | "all">("all")
  const [searchInput, setSearchInput] = useState("")
  // Debounced value drives the actual filter. 200ms is short enough to feel
  // instant on a modern keyboard but avoids re-filtering on every keystroke
  // when the list is longer (large classes may have 30+ exams).
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const handle = setTimeout(
      () => setDebouncedSearch(searchInput.trim().toLowerCase()),
      200
    )
    return () => clearTimeout(handle)
  }, [searchInput])

  useEffect(() => {
    if (!classSubjectId) return
    let cancelled = false
    apiClient
      .get<ExamCardsResponse>(
        `/api/grading/class-subject/${classSubjectId}/exam-cards`
      )
      .then((res) => {
        if (!cancelled) setFetched({ csId: classSubjectId, data: res })
      })
      .catch((err) => {
        console.error("Failed to fetch exam cards:", err)
        toast.error("Couldn't load exams")
        if (!cancelled) setFetched({ csId: classSubjectId, data: null })
      })
    return () => {
      cancelled = true
    }
  }, [classSubjectId])

  const totalStudents = data?.totals.students ?? 0

  const filteredExams = useMemo(() => {
    if (!data) return []
    const byBucket =
      filter === "all"
        ? data.exams
        : data.exams.filter((c) => classify(c, totalStudents) === filter)
    if (!debouncedSearch) return byBucket
    return byBucket.filter((c) =>
      c.exam_name.toLowerCase().includes(debouncedSearch)
    )
  }, [data, filter, totalStudents, debouncedSearch])

  if (isLoading) {
    return (
      <LoadingSwap loading skeleton={<ExamCardsSkeleton />} className="flex-1">
        {null}
      </LoadingSwap>
    )
  }

  if (!data || data.exams.length === 0) {
    return (
      <LoadingSwap
        loading={false}
        skeleton={<ExamCardsSkeleton />}
        className="flex-1"
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
          <Sticker name="idea" size={96} />
          <div className="flex max-w-[380px] flex-col items-center gap-1 text-center">
            <p className="text-base font-medium text-secondary-foreground">
              Nothing to grade yet
            </p>
            <p className="text-sm text-muted-foreground">
              Grading starts once a paper exists. Build one in Exams, then come
              back here to upload the answer sheets.
            </p>
          </div>
          <Button onClick={() => navigate(`/class/${classSubjectId}/exams`)}>
            Go to Exams
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </LoadingSwap>
    )
  }

  const chips = [
    {
      key: "all",
      label: "All",
      count: data.totals.exams,
      icon: ClipboardTextIcon,
    },
    {
      key: "needs-review",
      label: "Needs review",
      count: data.totals.needs_review,
      icon: WarningIcon,
    },
    {
      key: "in-progress",
      label: "In progress",
      count: data.totals.in_progress,
      icon: HourglassIcon,
    },
    {
      key: "done",
      label: "Done",
      count: data.totals.done,
      icon: CheckCircleIcon,
    },
  ] as { key: Filter | "all"; label: string; count: number; icon: Icon }[]

  return (
    <LoadingSwap
      loading={false}
      skeleton={<ExamCardsSkeleton />}
      className="flex-1"
    >
      <div className="flex flex-col gap-4">
        {/* Toolbar: filter pills (with counts) + search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => {
              const isActive = filter === chip.key
              const warn = chip.key === "needs-review" && chip.count > 0
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setFilter(chip.key)}
                  aria-pressed={isActive}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                    isActive
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background text-secondary-foreground hover:bg-muted"
                  )}
                >
                  <chip.icon
                    className={cn(
                      "size-3.5",
                      warn && !isActive && "text-amber-500"
                    )}
                  />
                  {chip.label}
                  <span
                    className={cn(
                      "tabular-nums",
                      isActive ? "text-primary/70" : "text-muted-foreground"
                    )}
                  >
                    {chip.count}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="relative w-full sm:max-w-64">
            <MagnifyingGlassIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search papers…"
              className="h-9 pl-9"
              aria-label="Search exams by name"
            />
          </div>
        </div>

        {/* Card grid */}
        {filteredExams.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Sticker name="lost" size={96} />
            <p className="text-sm text-muted-foreground">
              No paper matches this filter.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
            {filteredExams.map((card) => (
              <ExamCardView
                key={card.id}
                card={card}
                totalStudents={totalStudents}
                onOpen={() => onSelectExam(card.id)}
                onOpenFlagged={() =>
                  onSelectExam(card.id, { filter: "flagged" })
                }
              />
            ))}
          </div>
        )}
      </div>
    </LoadingSwap>
  )
}

// ── Loading ───────────────────────────────────────────────────────────────

/** One exam card at rest: calendar tile, name and facts, status pill, the
 *  progress bar with its caption, and the two-metric footer. */
function ExamCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-1.5 rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The grid while exam cards load: filter pills and search in the toolbar
 *  slots, then a full row-set of cards in the same responsive grid. */
function ExamCardsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {["w-16", "w-28", "w-28", "w-20"].map((w, i) => (
            <Skeleton key={i} className={cn("h-8 rounded-full", w)} />
          ))}
        </div>
        <Skeleton className="h-9 w-full sm:max-w-64" />
      </div>
      <div className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ExamCardSkeleton key={i} />
        ))}
      </div>
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
  const when = dayjs(card.created_at)

  // Progress bar denominator is total enrolled students, not just students
  // who uploaded — a class of 26 with 20 graded and 0 pending should still
  // show 20/26, not 20/20.
  const progressPct =
    totalStudents > 0
      ? Math.min(100, Math.round((submissions.graded / totalStudents) * 100))
      : 0

  const isDone =
    totalStudents > 0 &&
    submissions.graded === totalStudents &&
    review.submissions_needing_review === 0
  const isEmpty = submissions.total === 0
  const needsReview = review.submissions_needing_review > 0
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
      className={cn(
        "group flex cursor-pointer flex-col gap-3 rounded-xl border bg-background p-4 transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        needsReview
          ? "border-amber-300/70 dark:border-amber-700/60"
          : "border-border"
      )}
    >
      {/* Head: calendar tile, name, status */}
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-sidebar leading-none">
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {when.format("D")}
          </span>
          <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
            {when.format("MMM")}
          </span>
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-sm font-medium text-foreground">
            {tameCaps(card.exam_name)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {card.questions_count}{" "}
            {card.questions_count === 1 ? "question" : "questions"} ·{" "}
            {card.total_marks} marks
            {card.pass_marks != null ? ` · pass ${card.pass_marks}` : ""}
          </p>
        </div>
        {isDone ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <CheckCircleIcon weight="fill" className="size-3" />
            Done
          </span>
        ) : isEmpty ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground">
            <UploadIcon className="size-3" />
            No sheets
          </span>
        ) : needsReview ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            <WarningIcon weight="fill" className="size-3" />
            Review
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
            <HourglassIcon className="size-3" />
            In progress
          </span>
        )}
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isDone
                ? "bg-primary"
                : needsReview
                  ? "bg-amber-500"
                  : "bg-primary/60"
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>
            <span className="font-medium text-foreground">
              {submissions.graded}
            </span>{" "}
            of {totalStudents} graded
          </span>
          {!isDone && remaining > 0 && <span>{remaining} to go</span>}
        </div>
      </div>

      {/* Footer — always the same two-line block, anchored to the bottom so
          cards in a row line up: metrics once anything is graded, a progress
          note while Hint is working, a nudge when nothing is uploaded. */}
      <div className="mt-auto border-t border-border pt-3">
        {submissions.graded > 0 && marks.average != null ? (
          <div
            className={cn(
              "grid gap-3",
              showFailing ? "grid-cols-3" : "grid-cols-2"
            )}
          >
            <Metric
              icon={<TrendUpIcon className="size-3" />}
              label="Average"
              value={String(marks.average)}
              suffix={`/ ${card.total_marks}`}
            />
            <Metric
              icon={<TrophyIcon className="size-3" />}
              label="Top score"
              value={marks.top ? String(marks.top.marks) : "—"}
              suffix={marks.top ? `/ ${card.total_marks}` : undefined}
              sub={marks.top?.student_name ?? undefined}
            />
            {showFailing && (
              <Metric
                icon={<TrendDownIcon className="size-3" />}
                label="Below pass"
                value={String(marks.failing_count)}
                tone={marks.failing_count! > 0 ? "danger" : "default"}
              />
            )}
          </div>
        ) : isEmpty ? (
          <FooterNote
            icon={<UploadIcon className="size-3.5" />}
            title="No sheets uploaded yet"
            body="Averages and top scores appear once Hint grades a sheet."
          />
        ) : (
          <FooterNote
            icon={
              <CircleNotchIcon className="size-3.5 animate-spin text-violet-500" />
            }
            title={`Hint is grading ${submissions.pending} ${
              submissions.pending === 1 ? "sheet" : "sheets"
            }`}
            body={
              submissions.failed > 0
                ? `${submissions.failed} ${
                    submissions.failed === 1 ? "sheet" : "sheets"
                  } failed and need a re-upload.`
                : "Scores show here as soon as the first one is done."
            }
          />
        )}
      </div>

      {/* Review alert (only when flagged) — inner click deep-links to the
          flagged filter, stopping propagation so it doesn't double-trigger
          the card click. */}
      {needsReview && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpenFlagged()
          }}
          className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 transition-colors hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
        >
          <span className="flex items-center gap-2">
            <WarningIcon weight="fill" className="size-3.5 shrink-0" />
            {review.submissions_needing_review}{" "}
            {review.submissions_needing_review === 1 ? "sheet" : "sheets"} need
            your eye · {review.total_flagged_questions}{" "}
            {review.total_flagged_questions === 1 ? "question" : "questions"}
          </span>
          <ArrowRightIcon className="size-3.5 shrink-0" />
        </button>
      )}
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
  suffix,
  sub,
  tone = "default",
}: {
  icon: React.ReactNode
  label: string
  value: string
  suffix?: string
  sub?: string
  tone?: "default" | "danger"
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="flex min-w-0 items-baseline gap-1 text-sm leading-tight tabular-nums">
        <span
          className={cn(
            "font-semibold text-foreground",
            tone === "danger" && "text-red-600 dark:text-red-400"
          )}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-xs text-muted-foreground">{suffix}</span>
        )}
        {sub && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                · {sub}
              </span>
            </TooltipTrigger>
            <TooltipContent>{sub}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

/** The footer's non-metric states: an icon, a firm line and a soft one. */
function FooterNote({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sidebar text-muted-foreground ring-1 ring-border/60">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-xs font-medium text-secondary-foreground">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
