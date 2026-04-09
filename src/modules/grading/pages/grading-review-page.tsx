import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PencilIcon,
  SaveIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"

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
}

export function GradingReviewPage() {
  const { classSubjectId, submissionId } = useParams<{ classSubjectId: string; submissionId: string }>()
  const navigate = useNavigate()
  const backUrl = `/class/${classSubjectId}/grading`

  const [submission, setSubmission] = useState<SubmissionData | null>(null)
  const [marks, setMarks] = useState<QuestionMark[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMarks, setEditMarks] = useState("")
  const [editFeedback, setEditFeedback] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [showSheet, setShowSheet] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

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
    setEditMarks(String(qm.final_marks ?? qm.ai_marks ?? 0))
    setEditFeedback(qm.feedback ?? "")
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditMarks("")
    setEditFeedback("")
  }

  const handleSave = async (qm: QuestionMark) => {
    if (!submissionId) return
    const numMarks = parseFloat(editMarks)
    if (isNaN(numMarks) || numMarks < 0) {
      toast.error("Enter a valid mark")
      return
    }
    if (numMarks > qm.questions.marks) {
      toast.error(`Marks cannot exceed ${qm.questions.marks}`)
      return
    }

    setIsSaving(true)
    try {
      await apiClient.put(
        `/api/grading/submission/${submissionId}/question/${qm.question_id}`,
        {
          teacher_override_marks: numMarks,
          feedback: editFeedback,
        },
      )

      setMarks((prev) =>
        prev.map((m) =>
          m.question_id === qm.question_id
            ? { ...m, final_marks: numMarks, teacher_override_marks: numMarks, feedback: editFeedback }
            : m,
        ),
      )

      const updatedTotal = marks.reduce((sum, m) => {
        if (m.question_id === qm.question_id) return sum + numMarks
        return sum + (m.final_marks ?? m.ai_marks ?? 0)
      }, 0)
      setSubmission((prev) => (prev ? { ...prev, total_final_marks: updatedTotal } : prev))

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
  const isPdf = (submission?.pdf_storage_path ?? submission?.pdf_url ?? "").toLowerCase().endsWith(".pdf")

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!submission) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <FileTextIcon className="size-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Submission not found</p>
      </div>
    )
  }

  const examTotalMarks =
    submission.exams?.total_marks ?? marks.reduce((sum, m) => sum + (m.questions?.marks ?? 0), 0)
  const sections = [...new Set(marks.map((m) => m.questions?.section).filter(Boolean))] as string[]
  const unsectionedMarks = marks.filter((m) => !m.questions?.section)

  const renderQuestionRow = (qm: QuestionMark) => {
    const q = qm.questions
    const isEditing = editingId === qm.question_id
    const wasOverridden = qm.teacher_override_marks !== null

    return (
      <div
        key={qm.id}
        className={cn(
          "border-b last:border-b-0 transition-colors",
          isEditing && "bg-primary/5",
        )}
      >
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
          {/* Q number + type */}
          <div className="flex shrink-0 items-center gap-2 sm:w-16 sm:flex-col sm:items-start sm:gap-1">
            <span className="text-sm font-bold text-primary">Q{q?.question_number ?? "–"}</span>
            {q?.type && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                {q.type}
              </span>
            )}
          </div>

          {/* Question text + options + answer key */}
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed">{q?.question_text ?? "–"}</p>

            {q?.options && q.options.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
                {q.options.map((opt, i) => (
                  <span key={i} className="text-xs text-muted-foreground">
                    <span className="mr-0.5 font-medium">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </span>
                ))}
              </div>
            )}

            {q?.answer_key && (
              <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <span className="font-medium">Key:</span> {q.answer_key}
              </p>
            )}

            {/* Feedback */}
            {!isEditing && qm.feedback && (
              <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                {qm.feedback}
              </p>
            )}
          </div>

          {/* Marks columns */}
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {/* Max marks */}
            <div className="text-center">
              <p className="text-[10px] uppercase text-muted-foreground">Max</p>
              <p className="text-sm font-medium">{q?.marks ?? "–"}</p>
            </div>

            {/* AI marks */}
            <div className="text-center">
              <p className="text-[10px] uppercase text-muted-foreground">AI</p>
              <p className="text-sm font-medium">{qm.ai_marks ?? "–"}</p>
            </div>

            {/* Final marks */}
            <div className="text-center">
              <p className="text-[10px] uppercase text-muted-foreground">Final</p>
              <p
                className={cn(
                  "text-sm font-bold",
                  wasOverridden ? "text-blue-600 dark:text-blue-400" : "",
                )}
              >
                {qm.final_marks ?? "–"}
              </p>
            </div>

            {/* Edit button */}
            {!isEditing && (
              <button
                onClick={() => handleEdit(qm)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <PencilIcon className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Inline edit row */}
        {isEditing && (
          <div className="border-t bg-muted/20 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Override Marks</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={q?.marks}
                  value={editMarks}
                  onChange={(e) => setEditMarks(e.target.value)}
                  className="w-20 rounded-md border bg-background px-2 py-1.5 text-sm"
                  autoFocus
                />
                <span className="text-xs text-muted-foreground">/ {q?.marks}</span>
              </div>
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={editFeedback}
                  onChange={(e) => setEditFeedback(e.target.value)}
                  className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
                  placeholder="Feedback (optional)"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={isSaving} onClick={() => handleSave(qm)}>
                  {isSaving ? (
                    <Loader2Icon className="mr-1 size-3.5 animate-spin" />
                  ) : (
                    <SaveIcon className="mr-1 size-3.5" />
                  )}
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                  <XIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={() => navigate(backUrl)}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold sm:text-lg">
              {submission.exams?.exam_name ?? "Grading Review"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {marks.length} questions · {submission.total_final_marks ?? 0}/{examTotalMarks} marks
              {submission.total_final_marks !== null &&
                examTotalMarks > 0 &&
                ` · ${((submission.total_final_marks / examTotalMarks) * 100).toFixed(1)}%`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {sheetUrl && (
            <Button
              size="sm"
              variant={showSheet ? "default" : "outline"}
              className="text-xs sm:text-sm"
              onClick={() => setShowSheet(!showSheet)}
            >
              {showSheet ? (
                <PanelRightCloseIcon className="mr-1.5 size-3.5" />
              ) : (
                <PanelRightOpenIcon className="mr-1.5 size-3.5" />
              )}
              <span className="hidden sm:inline">Answer Sheet</span>
              <span className="sm:hidden">Sheet</span>
            </Button>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              submission.status === "graded"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
            )}
          >
            <CheckCircle2Icon className="size-3" />
            {submission.status === "graded" ? "Graded" : submission.status}
          </span>
        </div>
      </div>

      {/* Score summary */}
      <div className="border-b bg-muted/30 px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Score</span>
            <p className="text-base font-semibold">
              {submission.total_ai_marks ?? "–"}
              <span className="text-xs font-normal text-muted-foreground">/{examTotalMarks}</span>
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Final Score</span>
            <p className="text-xl font-bold text-primary">
              {submission.total_final_marks ?? "–"}
              <span className="text-xs font-normal text-muted-foreground">/{examTotalMarks}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main content: questions + answer sheet panel */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Questions panel */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {/* Table header (desktop) */}
          <div className="hidden border-b bg-muted/40 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:flex sm:items-center sm:gap-4">
            <span className="w-16">Q.No</span>
            <span className="flex-1">Question</span>
            <span className="w-10 text-center">Max</span>
            <span className="w-10 text-center">AI</span>
            <span className="w-10 text-center">Final</span>
            <span className="w-8" />
          </div>

          {/* Sections */}
          {sections.length > 0 &&
            sections.map((section) => {
              const sectionMarks = marks.filter((m) => m.questions?.section === section)
              const sectionTotal = sectionMarks.reduce(
                (s, m) => s + (m.final_marks ?? m.ai_marks ?? 0),
                0,
              )
              const sectionMax = sectionMarks.reduce((s, m) => s + (m.questions?.marks ?? 0), 0)
              const isCollapsed = collapsedSections.has(section)

              return (
                <div key={section}>
                  <button
                    onClick={() => toggleSection(section)}
                    className="flex w-full items-center justify-between border-b bg-muted/50 px-4 py-2.5 text-left transition-colors hover:bg-muted/70"
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRightIcon className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDownIcon className="size-4 text-muted-foreground" />
                      )}
                      <span className="text-xs font-semibold uppercase tracking-wide">
                        {section}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ({sectionMarks.length} questions)
                      </span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {sectionTotal}/{sectionMax}
                    </span>
                  </button>
                  {!isCollapsed && sectionMarks.map(renderQuestionRow)}
                </div>
              )
            })}

          {/* Unsectioned questions */}
          {unsectionedMarks.length > 0 && (
            <div>{unsectionedMarks.map(renderQuestionRow)}</div>
          )}
        </div>

        {/* Answer sheet side panel (desktop) */}
        {showSheet && sheetUrl && (
          <div className="hidden w-[420px] shrink-0 flex-col border-l md:flex lg:w-[500px]">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <span className="text-xs font-medium">Answer Sheet</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="size-7 p-0"
                  onClick={() => window.open(sheetUrl, "_blank")}
                >
                  <ExternalLinkIcon className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="size-7 p-0"
                  onClick={() => setShowSheet(false)}
                >
                  <XIcon className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-muted/20 p-2">
              {isPdf ? (
                <iframe
                  src={sheetUrl}
                  className="h-full w-full rounded-md border"
                  title="Answer Sheet"
                />
              ) : (
                <img
                  src={sheetUrl}
                  alt="Answer Sheet"
                  className="w-full rounded-md border"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Answer sheet mobile overlay */}
      {showSheet && sheetUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-medium">Answer Sheet</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="size-8 p-0"
                onClick={() => window.open(sheetUrl, "_blank")}
              >
                <ExternalLinkIcon className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="size-8 p-0"
                onClick={() => setShowSheet(false)}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {isPdf ? (
              <iframe
                src={sheetUrl}
                className="h-full w-full rounded-md border"
                title="Answer Sheet"
              />
            ) : (
              <img
                src={sheetUrl}
                alt="Answer Sheet"
                className="w-full rounded-md"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
