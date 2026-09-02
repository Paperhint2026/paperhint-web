import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { AnimatePresence, motion } from "motion/react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import "katex/dist/katex.min.css"
import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  CaretDownIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  FileTextIcon,
  KeyIcon,
  MinusIcon,
  PencilSimpleIcon,
  PlusIcon,
  SidebarSimpleIcon,
  XIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { tameCaps } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Sticker } from "@/components/shared/sticker"
import { PaperhintMark } from "@/components/shared/paperhint-mark"
import { PAGE_GUTTER } from "@/components/layout/page-container"
import {
  matchesOptionLetter,
  stripOptionPrefix,
} from "@/modules/exams/lib/options"
import { formatMarks, percentOf, scoreTone } from "../lib/score"

interface QuestionDetail {
  question_text: string
  question_number: number
  marks: number
  type: string | null
  section: string | null
  options: string[] | null
  answer_key: string | null
}

interface QuestionMark {
  id: string
  submission_id: string
  question_id: string
  ai_marks: number | null
  final_marks: number | null
  teacher_override_marks: number | null
  feedback: string | null
  questions: QuestionDetail
}

interface SubmissionData {
  id: string
  exam_id: string
  student_id: string
  pdf_url: string
  pdf_storage_path?: string | null
  answer_sheet_url?: string | null
  status: string
  total_ai_marks: number | null
  total_final_marks: number | null
  exams: { exam_name: string; total_marks: number } | null
  students?: {
    full_name: string
    roll_number: number | null
    register_number: string | null
  } | null
}

const MD_REMARK = [remarkGfm, remarkMath]
const MD_REHYPE = [rehypeKatex, rehypeRaw]

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/** Snap to the nearest half mark inside [0, max]. */
function clampMarks(n: number, max: number) {
  const snapped = Math.round(n * 2) / 2
  return Math.min(max, Math.max(0, snapped))
}

/** A graded question card at rest: number tile, type pill, score on the
 *  right, the question text, and an option grid for the odd ones. */
function ReviewQuestionSkeleton({ options }: { options: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-7 shrink-0 rounded-lg" />
        <Skeleton className="h-4 w-14 rounded-full" />
        <Skeleton className="ml-auto h-4 w-14" />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      {options ? (
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-2.5 border-l-2 border-border pl-3">
          <Skeleton className="mt-0.5 size-3.5 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}
    </div>
  )
}

/**
 * The review page while the submission loads: the top bar with the student,
 * then the score band and a section of question cards, in the same column
 * the real page uses.
 */
function ReviewSkeleton() {
  return (
    <div aria-hidden className="flex h-full flex-col overflow-hidden">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-5">
        <Skeleton className="size-7 shrink-0 rounded-full" />
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-44 max-w-full" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            PAGE_GUTTER,
            "mx-auto flex w-full max-w-5xl flex-col gap-6 py-6 pb-16"
          )}
        >
          {/* Score band */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 px-6 py-5">
              <div className="flex items-baseline gap-2">
                <Skeleton className="h-10 w-16" />
                <Skeleton className="h-5 w-10" />
                <Skeleton className="ml-1 h-5 w-12 rounded-full" />
              </div>
              <div className="h-8 w-px bg-border max-sm:hidden" />
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2.5 border-t border-border bg-sidebar/60 px-6 py-2.5">
              <Skeleton className="size-3.5 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
          </div>

          {/* One section of questions */}
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <Skeleton className="h-7 w-24 rounded-full" />
              <span className="h-px flex-1 bg-border" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <ReviewQuestionSkeleton options />
              <ReviewQuestionSkeleton options={false} />
              <ReviewQuestionSkeleton options />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function GradingReviewPage() {
  const { classSubjectId, submissionId } = useParams<{
    classSubjectId: string
    submissionId: string
  }>()
  const navigate = useNavigate()
  const backUrl = `/class/${classSubjectId}/grading`

  const [submission, setSubmission] = useState<SubmissionData | null>(null)
  const [marks, setMarks] = useState<QuestionMark[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMarks, setEditMarks] = useState(0)
  const [editFeedback, setEditFeedback] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [showSheet, setShowSheet] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  )

  const fetchSubmission = useCallback(async () => {
    if (!submissionId) return
    setIsLoading(true)
    try {
      const res = await apiClient.get<{
        submission: SubmissionData
        marks: QuestionMark[]
      }>(`/api/grading/submission/${submissionId}`)
      setSubmission(res.submission)
      setMarks(res.marks ?? [])
    } catch (err) {
      console.error(err)
      toast.error("Failed to load submission")
    } finally {
      setIsLoading(false)
    }
  }, [submissionId])

  useEffect(() => {
    fetchSubmission()
  }, [fetchSubmission])

  const handleEdit = (qm: QuestionMark) => {
    setEditingId(qm.question_id)
    setEditMarks(qm.final_marks ?? qm.ai_marks ?? 0)
    setEditFeedback(qm.feedback ?? "")
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditFeedback("")
  }

  const handleSave = async (qm: QuestionMark) => {
    if (!submissionId) return
    const numMarks = clampMarks(editMarks, qm.questions.marks)

    setIsSaving(true)
    try {
      await apiClient.put(
        `/api/grading/submission/${submissionId}/question/${qm.question_id}`,
        { teacher_override_marks: numMarks, feedback: editFeedback }
      )

      setMarks((prev) =>
        prev.map((m) =>
          m.question_id === qm.question_id
            ? {
                ...m,
                final_marks: numMarks,
                teacher_override_marks: numMarks,
                feedback: editFeedback,
              }
            : m
        )
      )

      const updatedTotal = marks.reduce((sum, m) => {
        if (m.question_id === qm.question_id) return sum + numMarks
        return sum + (m.final_marks ?? m.ai_marks ?? 0)
      }, 0)
      setSubmission((prev) =>
        prev ? { ...prev, total_final_marks: updatedTotal } : prev
      )

      setEditingId(null)
      toast.success("Marks updated")
    } catch (err) {
      console.error(err)
      toast.error("Failed to update marks")
    } finally {
      setIsSaving(false)
    }
  }

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const sheetUrl = submission?.answer_sheet_url ?? null
  const isPdf = (submission?.pdf_storage_path ?? submission?.pdf_url ?? "")
    .toLowerCase()
    .endsWith(".pdf")

  if (isLoading) {
    return (
      <LoadingSwap loading skeleton={<ReviewSkeleton />} className="h-full">
        {null}
      </LoadingSwap>
    )
  }

  if (!submission) {
    return (
      <LoadingSwap
        loading={false}
        skeleton={<ReviewSkeleton />}
        className="h-full"
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
          <Sticker name="lost" size={160} />
          <div className="flex max-w-[340px] flex-col items-center gap-1 text-center">
            <p className="text-base font-medium text-secondary-foreground">
              We couldn't find this answer sheet
            </p>
            <p className="text-sm text-muted-foreground">
              It may have been removed. Head back to grading to pick another.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(backUrl)}>
            <ArrowLeftIcon className="size-4" />
            Back to grading
          </Button>
        </div>
      </LoadingSwap>
    )
  }

  const examTotalMarks =
    submission.exams?.total_marks ??
    marks.reduce((sum, m) => sum + (m.questions?.marks ?? 0), 0)
  const finalTotal = submission.total_final_marks ?? 0
  const overriddenCount = marks.filter(
    (m) => m.teacher_override_marks !== null
  ).length
  const fullMarksCount = marks.filter(
    (m) => (m.final_marks ?? m.ai_marks ?? 0) >= (m.questions?.marks ?? 0)
  ).length
  const zeroCount = marks.filter(
    (m) => (m.final_marks ?? m.ai_marks ?? 0) === 0
  ).length

  const sections = [
    ...new Set(marks.map((m) => m.questions?.section).filter(Boolean)),
  ] as string[]
  const unsectionedMarks = marks.filter((m) => !m.questions?.section)

  const student = submission.students ?? null
  const title = student
    ? student.full_name
    : tameCaps(submission.exams?.exam_name ?? "Answer sheet")
  const examName = tameCaps(submission.exams?.exam_name ?? "Answer sheet")

  const renderQuestion = (qm: QuestionMark, i: number) => {
    const q = qm.questions
    const isEditing = editingId === qm.question_id
    const wasOverridden = qm.teacher_override_marks !== null
    const finalMarks = qm.final_marks ?? qm.ai_marks ?? 0
    const isFull = finalMarks >= (q?.marks ?? 0)
    const isZero = finalMarks === 0
    const hasOptions = !!q?.options && q.options.length > 0
    const keyIsLetter =
      hasOptions &&
      ["A", "B", "C", "D"].some((l) => matchesOptionLetter(q.answer_key, l))

    return (
      <article
        key={qm.id}
        style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
        className={cn(
          "group/q animate-in rounded-xl border border-border bg-background p-5 transition-shadow duration-300 fade-in-0 fill-mode-backwards slide-in-from-bottom-2 hover:shadow-sm",
          isEditing && "border-primary/40 shadow-sm"
        )}
      >
        {/* Header: number, type, marks, edit */}
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar text-xs font-semibold text-foreground tabular-nums ring-1 ring-border/60">
            {q?.question_number ?? "–"}
          </span>
          {q?.type && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {q.type}
            </span>
          )}
          {wasOverridden && !isEditing && (
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              Adjusted by you
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {!isEditing && (
              <>
                <span className="flex items-baseline gap-1 text-sm tabular-nums">
                  <span
                    className={cn(
                      "font-semibold",
                      isFull
                        ? "text-primary"
                        : isZero
                          ? "text-destructive"
                          : "text-foreground"
                    )}
                  >
                    {formatMarks(finalMarks)}
                  </span>
                  <span className="text-muted-foreground">
                    / {formatMarks(q?.marks)}
                  </span>
                </span>
                {wasOverridden && qm.ai_marks !== null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        Hint {formatMarks(qm.ai_marks)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      What Hint gave before you changed it
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleEdit(qm)}
                      className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover/q:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
                      aria-label={`Adjust marks for question ${q?.question_number}`}
                    >
                      <PencilSimpleIcon className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Adjust marks</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        {/* Question text */}
        <div className="prose prose-sm dark:prose-invert mt-3 max-w-none text-sm leading-relaxed text-foreground">
          <ReactMarkdown remarkPlugins={MD_REMARK} rehypePlugins={MD_REHYPE}>
            {q?.question_text ?? "–"}
          </ReactMarkdown>
        </div>

        {/* Options — the keyed one lights up */}
        {hasOptions && (
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {q.options!.map((opt, oi) => {
              const label = String.fromCharCode(65 + oi)
              const isCorrect = matchesOptionLetter(q.answer_key, label)
              return (
                <div
                  key={oi}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                    isCorrect
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : "border-border bg-background text-secondary-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      isCorrect
                        ? "bg-primary text-primary-foreground"
                        : "bg-sidebar text-muted-foreground ring-1 ring-border/60"
                    )}
                  >
                    {label}
                  </span>
                  <span className="min-w-0 flex-1 leading-relaxed">
                    {stripOptionPrefix(opt, label)}
                  </span>
                  {isCorrect && (
                    <CheckCircleIcon
                      weight="fill"
                      className="mt-0.5 size-4 shrink-0 text-primary"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Answer key as text — only when it isn't already shown as an option */}
        {q?.answer_key && !keyIsLetter && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <KeyIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-medium tracking-wider text-primary uppercase">
                Answer key
              </span>
              <p className="text-secondary-foreground">{q.answer_key}</p>
            </div>
          </div>
        )}

        {/* Hint's note */}
        {!isEditing && qm.feedback && (
          <div className="mt-3 flex items-start gap-2.5 border-l-2 border-border pl-3 text-sm text-secondary-foreground">
            <PaperhintMark className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <p className="leading-relaxed">{qm.feedback}</p>
          </div>
        )}

        {/* Adjust panel */}
        <AnimatePresence initial={false}>
          {isEditing && (
            <motion.div
              key="edit"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex flex-col gap-3 rounded-lg bg-sidebar p-3 ring-1 ring-border/60">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-medium text-secondary-foreground">
                    Marks
                  </span>
                  <div className="flex items-center rounded-md border border-border bg-background">
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                      disabled={editMarks <= 0}
                      onClick={() =>
                        setEditMarks((v) => clampMarks(v - 0.5, q.marks))
                      }
                      aria-label="Half a mark less"
                    >
                      <MinusIcon className="size-3.5" />
                    </button>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max={q?.marks}
                      value={editMarks}
                      autoFocus
                      onChange={(e) => {
                        const n = parseFloat(e.target.value)
                        setEditMarks(Number.isNaN(n) ? 0 : n)
                      }}
                      onBlur={() => setEditMarks((v) => clampMarks(v, q.marks))}
                      className="w-12 [appearance:textfield] border-x border-border bg-transparent text-center text-sm font-semibold tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                      disabled={editMarks >= q.marks}
                      onClick={() =>
                        setEditMarks((v) => clampMarks(v + 0.5, q.marks))
                      }
                      aria-label="Half a mark more"
                    >
                      <PlusIcon className="size-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    out of {formatMarks(q?.marks)}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={isSaving}
                      onClick={() => handleSave(qm)}
                    >
                      {isSaving && (
                        <CircleNotchIcon className="size-3.5 animate-spin" />
                      )}
                      Save marks
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={editFeedback}
                  onChange={(e) => setEditFeedback(e.target.value)}
                  placeholder="A note for the student (optional)"
                  rows={2}
                  className="min-h-0 resize-none bg-background text-sm"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </article>
    )
  }

  const sheetPanel = sheetUrl && (
    <>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileTextIcon className="size-4 text-muted-foreground" />
          Answer sheet
        </span>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Open in a new tab"
                className="text-muted-foreground"
                onClick={() => window.open(sheetUrl, "_blank")}
              >
                <ArrowSquareOutIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in a new tab</TooltipContent>
          </Tooltip>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Hide answer sheet"
            className="text-muted-foreground"
            onClick={() => setShowSheet(false)}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-sidebar/60 p-4">
        {isPdf ? (
          <iframe
            src={sheetUrl}
            className="h-full w-full rounded-lg border border-border bg-background"
            title="Answer sheet"
          />
        ) : (
          <img
            src={sheetUrl}
            alt="Answer sheet"
            className="w-full rounded-lg border border-border bg-background shadow-sm"
          />
        )}
      </div>
    </>
  )

  return (
    <LoadingSwap
      loading={false}
      skeleton={<ReviewSkeleton />}
      className="h-full"
    >
      <div className="flex h-full flex-col overflow-hidden">
        {/* Top bar — who and which paper on the left, sheet toggle and status
          on the right. Stays put while the questions scroll. */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate(backUrl)}
            aria-label="Back to grading"
            className="shrink-0 rounded-full text-muted-foreground"
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          {student && (
            <Avatar className="size-9">
              <AvatarFallback className="text-xs">
                {initialsOf(student.full_name)}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {student ? (
                <>
                  {student.roll_number !== null && (
                    <>
                      Roll {student.roll_number}
                      <span className="mx-1.5 text-border">·</span>
                    </>
                  )}
                  {examName}
                </>
              ) : (
                <>
                  {marks.length} {marks.length === 1 ? "question" : "questions"}
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-secondary-foreground"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  submission.status === "graded"
                    ? "bg-emerald-500"
                    : "bg-amber-500"
                )}
              />
              {submission.status === "graded"
                ? "Graded"
                : tameCaps(submission.status)}
            </span>
            {sheetUrl && (
              <Button
                size="sm"
                variant={showSheet ? "secondary" : "outline"}
                onClick={() => setShowSheet((v) => !v)}
                aria-pressed={showSheet}
              >
                <SidebarSimpleIcon className="size-4" mirrored />
                <span className="hidden sm:inline">Answer sheet</span>
                <span className="sm:hidden">Sheet</span>
              </Button>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Questions column */}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div
              className={cn(
                PAGE_GUTTER,
                "mx-auto flex w-full max-w-5xl flex-col gap-6 py-6 pb-16"
              )}
            >
              {/* Score band */}
              <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4 px-6 py-5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-semibold tracking-tight text-foreground tabular-nums">
                      {formatMarks(finalTotal)}
                    </span>
                    <span className="text-base text-muted-foreground tabular-nums">
                      / {formatMarks(examTotalMarks)}
                    </span>
                    <span
                      className={cn(
                        "ml-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                        scoreTone(finalTotal, examTotalMarks)
                      )}
                    >
                      {percentOf(finalTotal, examTotalMarks)}%
                    </span>
                  </div>

                  <div className="h-8 w-px bg-border max-sm:hidden" />

                  <dl className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-[11px] text-muted-foreground">
                        Hint's score
                      </dt>
                      <dd className="font-medium text-foreground tabular-nums">
                        {formatMarks(submission.total_ai_marks)}
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          / {formatMarks(examTotalMarks)}
                        </span>
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-[11px] text-muted-foreground">
                        Full marks
                      </dt>
                      <dd className="font-medium text-foreground tabular-nums">
                        {fullMarksCount}
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          of {marks.length}
                        </span>
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-[11px] text-muted-foreground">
                        No marks
                      </dt>
                      <dd className="font-medium text-foreground tabular-nums">
                        {zeroCount}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-[11px] text-muted-foreground">
                        Adjusted by you
                      </dt>
                      <dd className="font-medium text-foreground tabular-nums">
                        {overriddenCount}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="flex items-center gap-2.5 border-t border-border bg-sidebar/60 px-6 py-2.5 text-xs text-muted-foreground">
                  <PencilSimpleIcon className="size-3.5 shrink-0" />
                  <p>
                    Hover a question and use the pencil to change its marks or
                    leave a note. Totals update as you go.
                  </p>
                </div>
              </div>

              {/* Sections */}
              {sections.map((section) => {
                const sectionMarks = marks.filter(
                  (m) => m.questions?.section === section
                )
                const sectionTotal = sectionMarks.reduce(
                  (s, m) => s + (m.final_marks ?? m.ai_marks ?? 0),
                  0
                )
                const sectionMax = sectionMarks.reduce(
                  (s, m) => s + (m.questions?.marks ?? 0),
                  0
                )
                const isExpanded = !collapsedSections.has(section)

                return (
                  <section key={section} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => toggleSection(section)}
                      aria-expanded={isExpanded}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sidebar px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border/60">
                        <CaretDownIcon
                          className={cn(
                            "size-3 text-muted-foreground transition-transform duration-200",
                            !isExpanded && "-rotate-90"
                          )}
                        />
                        Section {section}
                      </span>
                      <span className="h-px flex-1 bg-border" />
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {sectionMarks.length}{" "}
                        {sectionMarks.length === 1 ? "question" : "questions"}
                        <span className="mx-1.5 text-border">·</span>
                        <span className="font-medium text-foreground">
                          {formatMarks(sectionTotal)}
                        </span>{" "}
                        / {formatMarks(sectionMax)}
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key="questions"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            duration: 0.22,
                            ease: [0.4, 0, 0.2, 1],
                          }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-3 pt-4">
                            {sectionMarks.map(renderQuestion)}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                )
              })}

              {unsectionedMarks.length > 0 && (
                <div className="flex flex-col gap-3">
                  {unsectionedMarks.map(renderQuestion)}
                </div>
              )}
            </div>
          </div>

          {/* Answer sheet — side panel on desktop */}
          <AnimatePresence initial={false}>
            {showSheet && sheetUrl && (
              <motion.aside
                key="sheet"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "var(--sheet-w)", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="hidden shrink-0 flex-col overflow-hidden border-l border-border [--sheet-w:420px] md:flex lg:[--sheet-w:500px]"
              >
                <div className="flex h-full w-(--sheet-w) flex-col">
                  {sheetPanel}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        {/* Answer sheet — full-screen on mobile */}
        {showSheet && sheetUrl && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
            {sheetPanel}
          </div>
        )}
      </div>
    </LoadingSwap>
  )
}
