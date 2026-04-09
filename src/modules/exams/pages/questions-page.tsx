import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  FileOutputIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import "katex/dist/katex.min.css"
import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Question {
  id: string
  exam_id: string
  question_text: string
  section: string
  marks: number
  question_number: string
  question_order: number
  type: string
  options: string[] | null
  answer_key: string | null
}

interface Exam {
  id: string
  exam_name: string
  total_marks: number
  blueprint: { section: string; type: string; num_questions: number; marks_per_question: number }[]
  chapters_selected: string[]
}

export function QuestionsPage() {
  const { classSubjectId, examId } = useParams<{ classSubjectId: string; examId: string }>()
  const navigate = useNavigate()
  const backUrl = `/class/${classSubjectId}/exams`

  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  // Edit state
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [editMarks, setEditMarks] = useState<number>(0)
  const [editAnswerKey, setEditAnswerKey] = useState("")
  const [editOptions, setEditOptions] = useState<string[]>([])
  const [isSavingQuestion, setIsSavingQuestion] = useState(false)

  // Delete state
  const [deleteQuestion, setDeleteQuestion] = useState<Question | null>(null)
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false)

  // Add question state
  const [addingToSection, setAddingToSection] = useState<string | null>(null)
  const [newQuestionText, setNewQuestionText] = useState("")
  const [newQuestionMarks, setNewQuestionMarks] = useState<number>(1)
  const [newQuestionType, setNewQuestionType] = useState("")
  const [newAnswerKey, setNewAnswerKey] = useState("")
  const [isAddingQuestion, setIsAddingQuestion] = useState(false)

  // Show/hide answer keys
  const [showAnswerKeys, setShowAnswerKeys] = useState(false)

  const fetchExam = useCallback(async () => {
    if (!examId) return
    setIsLoading(true)
    try {
      const res = await apiClient.get<{ exam: Exam; questions: Question[] }>(
        `/api/exams/${examId}`,
      )
      setExam(res.exam)
      setQuestions(res.questions ?? [])

      const sections = new Set((res.questions ?? []).map((q) => q.section))
      setExpandedSections(sections)
    } catch (err) {
      console.error("Failed to fetch exam:", err)
      toast.error("Failed to load question paper")
    } finally {
      setIsLoading(false)
    }
  }, [examId])

  useEffect(() => {
    fetchExam()
  }, [fetchExam])

  const sectionGroups = questions.reduce<Record<string, Question[]>>((acc, q) => {
    const sec = q.section || "Other"
    if (!acc[sec]) acc[sec] = []
    acc[sec].push(q)
    return acc
  }, {})

  const sortedSections = Object.keys(sectionGroups).sort()

  const toggleSection = (sec: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sec)) next.delete(sec)
      else next.add(sec)
      return next
    })
  }

  const startEdit = (q: Question) => {
    setEditingQuestion(q.id)
    setEditText(q.question_text)
    setEditMarks(q.marks)
    setEditAnswerKey(q.answer_key || "")
    setEditOptions(q.options || [])
  }

  const cancelEdit = () => {
    setEditingQuestion(null)
    setEditText("")
    setEditMarks(0)
    setEditAnswerKey("")
    setEditOptions([])
  }

  const saveEdit = async (q: Question) => {
    setIsSavingQuestion(true)
    try {
      await apiClient.put(`/api/exams/${examId}/questions/${q.id}`, {
        question_text: editText,
        marks: editMarks,
        answer_key: editAnswerKey || null,
        options: editOptions.length > 0 ? editOptions : null,
      })
      toast.success("Question updated")
      cancelEdit()
      fetchExam()
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update question")
    } finally {
      setIsSavingQuestion(false)
    }
  }

  const handleDeleteQuestion = async () => {
    if (!deleteQuestion) return
    setIsDeletingQuestion(true)
    try {
      await apiClient.delete(`/api/exams/${examId}/questions/${deleteQuestion.id}`)
      toast.success("Question deleted")
      setDeleteQuestion(null)
      fetchExam()
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete question")
    } finally {
      setIsDeletingQuestion(false)
    }
  }

  const handleAddQuestion = async (section: string) => {
    if (!newQuestionText.trim()) return toast.error("Question text is required")
    setIsAddingQuestion(true)
    try {
      const sectionQuestions = sectionGroups[section] || []
      const lastNum = sectionQuestions.length > 0
        ? Math.max(...sectionQuestions.map((q) => parseInt(q.question_number) || 0))
        : 0

      await apiClient.post(`/api/exams/${examId}/questions`, {
        question_text: newQuestionText.trim(),
        section,
        marks: newQuestionMarks,
        question_number: String(lastNum + 1),
        type: newQuestionType || null,
        answer_key: newAnswerKey || null,
      })
      toast.success("Question added")
      setAddingToSection(null)
      setNewQuestionText("")
      setNewQuestionMarks(1)
      setNewQuestionType("")
      setNewAnswerKey("")
      fetchExam()
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to add question")
    } finally {
      setIsAddingQuestion(false)
    }
  }

  const getBlueprintForSection = (sec: string) => {
    return exam?.blueprint?.find((b) => b.section === sec)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Exam not found</p>
        <Button variant="outline" onClick={() => navigate(backUrl)}>
          Back to Exams
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate(backUrl)}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold sm:text-lg">{exam.exam_name}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {questions.length} questions · {exam.total_marks} marks
              {exam.chapters_selected?.length > 0 && (
                <> · {exam.chapters_selected.join(", ")}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs sm:flex-none sm:text-sm"
            onClick={() => setShowAnswerKeys(!showAnswerKeys)}
          >
            {showAnswerKeys ? "Hide Answers" : "Show Answers"}
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs sm:flex-none sm:text-sm"
            onClick={() =>
              navigate(`/class/${classSubjectId}/exams/${examId}/pdf-builder`)
            }
          >
            <FileOutputIcon className="mr-1.5 size-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Question Paper */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto max-w-3xl space-y-6">
          {sortedSections.map((section) => {
            const sectionQuestions = sectionGroups[section]
            const bp = getBlueprintForSection(section)
            const isExpanded = expandedSections.has(section)
            const sectionMarks = sectionQuestions.reduce((sum, q) => sum + (q.marks || 0), 0)

            return (
              <div key={section} className="rounded-xl border">
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section)}
                  className="flex w-full items-center justify-between rounded-t-xl bg-muted/50 px-5 py-3.5 text-left transition-colors hover:bg-muted/70"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDownIcon className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRightIcon className="size-4 text-muted-foreground" />
                    )}
                    <h2 className="text-sm font-semibold">Section {section}</h2>
                    {bp && (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {bp.type}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {sectionQuestions.length} questions · {sectionMarks} marks
                  </span>
                </button>

                {/* Questions */}
                {isExpanded && (
                  <div className="divide-y">
                    {sectionQuestions
                      .sort((a, b) => a.question_order - b.question_order)
                      .map((q) => (
                        <div key={q.id} className="group relative px-5 py-4">
                          {editingQuestion === q.id ? (
                            /* Edit mode */
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">
                                  Question Text
                                </label>
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  rows={4}
                                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                              </div>

                              {editOptions.length > 0 && (
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-muted-foreground">
                                    Options
                                  </label>
                                  {editOptions.map((opt, i) => (
                                    <Input
                                      key={i}
                                      value={opt}
                                      onChange={(e) => {
                                        const updated = [...editOptions]
                                        updated[i] = e.target.value
                                        setEditOptions(updated)
                                      }}
                                      className="h-8 text-xs"
                                    />
                                  ))}
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-muted-foreground">
                                    Marks
                                  </label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={editMarks}
                                    onChange={(e) => setEditMarks(Number(e.target.value))}
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-muted-foreground">
                                    Answer Key
                                  </label>
                                  <textarea
                                    value={editAnswerKey}
                                    onChange={(e) => setEditAnswerKey(e.target.value)}
                                    rows={2}
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={cancelEdit}>
                                  <XIcon className="mr-1 size-3" /> Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => saveEdit(q)}
                                  disabled={isSavingQuestion}
                                >
                                  {isSavingQuestion ? (
                                    <Loader2Icon className="mr-1 size-3 animate-spin" />
                                  ) : (
                                    <CheckIcon className="mr-1 size-3" />
                                  )}
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            /* View mode */
                            <>
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-semibold text-foreground">
                                      Q{q.question_number}.
                                    </span>
                                    <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                                      {q.marks} {q.marks === 1 ? "mark" : "marks"}
                                    </span>
                                    {q.type && (
                                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                                        {q.type}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 text-sm leading-relaxed">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkMath, remarkGfm]}
                                      rehypePlugins={[rehypeRaw, rehypeKatex]}
                                    >
                                      {q.question_text}
                                    </ReactMarkdown>
                                  </div>

                                  {q.options && q.options.length > 0 && (
                                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                                      {q.options.map((opt, i) => (
                                        <span
                                          key={i}
                                          className="rounded-md bg-muted/50 px-3 py-1.5 text-xs"
                                        >
                                          {opt}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {showAnswerKeys && q.answer_key && (
                                    <div className="mt-3 rounded-lg border border-green-200 bg-green-50/50 px-4 py-2.5 dark:border-green-900 dark:bg-green-950/20">
                                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                                        Answer Key
                                      </p>
                                      <p className="text-xs leading-relaxed text-green-700 dark:text-green-300">
                                        {q.answer_key}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Action buttons */}
                                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button
                                    onClick={() => startEdit(q)}
                                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  >
                                    <EditIcon className="size-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteQuestion(q)}
                                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2Icon className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                    {/* Add question to section */}
                    {addingToSection === section ? (
                      <div className="space-y-3 border-t bg-muted/10 px-5 py-4">
                        <textarea
                          value={newQuestionText}
                          onChange={(e) => setNewQuestionText(e.target.value)}
                          placeholder="Enter question text..."
                          rows={3}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground">Type</label>
                            <Input
                              value={newQuestionType}
                              onChange={(e) => setNewQuestionType(e.target.value)}
                              placeholder={bp?.type || "MCQ"}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground">Marks</label>
                            <Input
                              type="number"
                              min={1}
                              value={newQuestionMarks}
                              onChange={(e) => setNewQuestionMarks(Number(e.target.value))}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground">Answer Key</label>
                            <Input
                              value={newAnswerKey}
                              onChange={(e) => setNewAnswerKey(e.target.value)}
                              placeholder="Answer..."
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setAddingToSection(null); setNewQuestionText("") }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAddQuestion(section)}
                            disabled={isAddingQuestion}
                          >
                            {isAddingQuestion && <Loader2Icon className="mr-1 size-3 animate-spin" />}
                            Add Question
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAddingToSection(section)
                          setNewQuestionMarks(bp?.marks_per_question || 1)
                          setNewQuestionType(bp?.type || "")
                        }}
                        className="flex w-full items-center justify-center gap-1.5 border-t px-5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                      >
                        <PlusIcon className="size-3.5" />
                        Add Question
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Delete question confirmation */}
      <AlertDialog open={!!deleteQuestion} onOpenChange={() => setDeleteQuestion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Q{deleteQuestion?.question_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuestion} disabled={isDeletingQuestion}>
              {isDeletingQuestion ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
