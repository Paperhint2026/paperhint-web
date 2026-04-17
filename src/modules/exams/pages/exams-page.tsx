import { useCallback, useEffect, useRef, useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  CameraIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  EyeIcon,
  FileOutputIcon,
  FileTextIcon,
  KeyRoundIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
  UserIcon,
  XIcon,
} from "lucide-react"
import dayjs from "dayjs"
import { toast } from "sonner"
import "katex/dist/katex.min.css"
import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BlueprintModal, type Blueprint, type BlueprintSection } from "../components/blueprint-modal"
import { ScanPagesModal } from "@/modules/grading/components/scan-pages-modal"

/* ─── Types ─────────────────────────────────────────────── */

interface Exam {
  id: string
  class_subject_id: string
  exam_name: string
  blueprint: BlueprintSection[]
  chapters_selected: string[]
  total_marks: number
  question_count: number
  source: "ai" | "uploaded" | null
  created_at: string
}

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

interface Student {
  id: string
  full_name: string
  roll_number: number
  register_number?: string
}

interface Submission {
  id: string
  exam_id: string
  student_id: string
  status: string
  total_ai_marks: number | null
  total_final_marks: number | null
  uploaded_at: string
}

/* ─── Constants ─────────────────────────────────────────── */

const DEFAULT_BLUEPRINT: BlueprintSection[] = [
  { section: "A", type: "MCQ", num_questions: 10, marks_per_question: 1 },
  { section: "B", type: "Short Answer (2 marks)", num_questions: 5, marks_per_question: 2 },
  { section: "C", type: "Short Answer (3 marks)", num_questions: 6, marks_per_question: 3 },
  { section: "D", type: "Long Answer (5 marks)", num_questions: 4, marks_per_question: 5 },
  { section: "E", type: "Case Study / Long Answer (5 marks)", num_questions: 3, marks_per_question: 5 },
]

/* ─── Image compression helper ──────────────────────────── */

function compressForUpload(file: File): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.size <= 5 * 1024 * 1024) {
      resolve(file)
      return
    }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const maxDim = 3200
      const scale = Math.max(img.width, img.height) > maxDim
        ? maxDim / Math.max(img.width, img.height) : 1
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => resolve(blob && blob.size < file.size
          ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })
          : file),
        "image/jpeg", 0.92,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

/* ─── Main component ─────────────────────────────────────── */

export function ExamsPage() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { classSubjectId } = useParams<{ classSubjectId: string }>()

  /* Exams */
  const [exams, setExams] = useState<Exam[]>([])
  const [isLoadingExams, setIsLoadingExams] = useState(false)
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null)

  /* Question paper */
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [showAnswers, setShowAnswers] = useState(false)

  /* Students + submissions */
  const [students, setStudents] = useState<Student[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [uploadingSet, setUploadingSet] = useState<Set<string>>(new Set())
  const [scanModal, setScanModal] = useState<{ studentId: string; studentName: string } | null>(null)
  const [deleteSubmissionConfirm, setDeleteSubmissionConfirm] = useState<{ submissionId: string; studentName: string } | null>(null)
  const [deletingSubmissionId, setDeletingSubmissionId] = useState<string | null>(null)

  /* Create / Edit exam drawer */
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editExam, setEditExam] = useState<Exam | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [examName, setExamName] = useState("")
  const [chapters, setChapters] = useState<string[]>([])
  const [chapterInput, setChapterInput] = useState("")
  const [blueprint, setBlueprint] = useState<BlueprintSection[]>(DEFAULT_BLUEPRINT)
  const [totalMarks, setTotalMarks] = useState(0)
  const [savedBlueprints, setSavedBlueprints] = useState<Blueprint[]>([])
  const [selectedBlueprintId, setSelectedBlueprintId] = useState("")
  const [blueprintModalOpen, setBlueprintModalOpen] = useState(false)
  const [blueprintEdited, setBlueprintEdited] = useState(false)
  const [showBlueprintSections, setShowBlueprintSections] = useState(false)
  const [chapterSuggestions, setChapterSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  /* Delete exam */
  const [deleteExamConfirm, setDeleteExamConfirm] = useState<Exam | null>(null)
  const [isDeletingExam, setIsDeletingExam] = useState(false)

  /* Search */
  const [searchQuery, setSearchQuery] = useState("")

  /* Polling */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null

  /* ── Computed ── */
  useEffect(() => {
    const calcMarks = blueprint.reduce((sum, s) => sum + s.num_questions * s.marks_per_question, 0)
    setTotalMarks(calcMarks)
  }, [blueprint])

  /* ── Fetch exams ── */
  const fetchExams = useCallback(async (csId: string) => {
    setIsLoadingExams(true)
    try {
      const res = await apiClient.get<{ exams: Exam[] }>(`/api/exams/class-subject/${csId}`)
      setExams(res.exams ?? [])
    } catch {
      setExams([])
    } finally {
      setIsLoadingExams(false)
    }
  }, [])

  const fetchBlueprints = useCallback(async () => {
    try {
      const res = await apiClient.get<{ blueprints: Blueprint[] }>("/api/blueprints")
      setSavedBlueprints(res.blueprints ?? [])
    } catch { /* ignore */ }
  }, [])

  const fetchChapterSuggestions = useCallback(async (csId: string) => {
    try {
      const res = await apiClient.get<{ materials: { tags: string[] }[] }>(`/api/knowledge/materials/${csId}`)
      const tags = Array.from(new Set((res.materials ?? []).flatMap((m) => m.tags ?? [])))
      setChapterSuggestions(tags)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (classSubjectId) {
      fetchExams(classSubjectId)
      fetchChapterSuggestions(classSubjectId)
    }
    fetchBlueprints()
  }, [classSubjectId, fetchExams, fetchChapterSuggestions, fetchBlueprints])

  /* ── Fetch question paper ── */
  const fetchQuestions = useCallback(async (examId: string) => {
    setIsLoadingQuestions(true)
    try {
      const res = await apiClient.get<{ questions: Question[] }>(`/api/exams/${examId}`)
      setQuestions(res.questions ?? [])
      const sections = new Set((res.questions ?? []).map((q) => q.section))
      setExpandedSections(sections)
    } catch {
      setQuestions([])
    } finally {
      setIsLoadingQuestions(false)
    }
  }, [])

  /* ── Fetch students + submissions ── */
  const fetchStudentsAndSubmissions = useCallback(async (csId: string, examId: string) => {
    setIsLoadingStudents(true)
    try {
      const [studentsRes, submissionsRes] = await Promise.all([
        apiClient.get<{ students: Student[] }>(`/api/students/class-subject/${csId}`),
        apiClient.get<{ submissions: Submission[] }>(`/api/grading/submissions/${examId}`),
      ])
      setStudents(studentsRes.students ?? [])
      setSubmissions(submissionsRes.submissions ?? [])
    } catch {
      /* ignore */
    } finally {
      setIsLoadingStudents(false)
    }
  }, [])

  /* ── Select exam ── */
  const selectExam = (examId: string) => {
    if (selectedExamId === examId) return
    setSelectedExamId(examId)
    setQuestions([])
    setStudents([])
    setSubmissions([])
    setShowAnswers(false)
    const exam = exams.find((e) => e.id === examId)
    if (exam && exam.question_count > 0) fetchQuestions(examId)
    if (classSubjectId) fetchStudentsAndSubmissions(classSubjectId, examId)
  }

  /* ── Polling for grading status ── */
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    const hasPending = submissions.some((s) => s.status === "uploaded" || s.status === "processing")
    if (hasPending && classSubjectId && selectedExamId) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await apiClient.get<{ submissions: Submission[] }>(`/api/grading/submissions/${selectedExamId}`)
          setSubmissions(res.submissions ?? [])
          if (!(res.submissions ?? []).some((s) => s.status === "uploaded" || s.status === "processing")) {
            clearInterval(pollRef.current!)
            pollRef.current = null
          }
        } catch { /* ignore */ }
      }, 5000)
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [submissions, classSubjectId, selectedExamId])

  /* ── Exam drawer helpers ── */
  const resetForm = () => {
    setExamName(""); setChapters([]); setChapterInput(""); setBlueprint(DEFAULT_BLUEPRINT)
    setSelectedBlueprintId(""); setBlueprintEdited(false); setShowBlueprintSections(false); setEditExam(null)
  }

  const openCreate = () => { resetForm(); setDrawerOpen(true) }

  const openEdit = (exam: Exam) => {
    setEditExam(exam); setExamName(exam.exam_name); setChapters(exam.chapters_selected ?? [])
    setBlueprint(exam.blueprint ?? DEFAULT_BLUEPRINT)
    setShowBlueprintSections(!!(exam.blueprint && exam.blueprint.length > 0))
    setBlueprintEdited(false); setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!examName.trim()) return toast.error("Exam name is required")
    if (chapters.length === 0) return toast.error("Select at least one chapter")
    if (!showBlueprintSections || blueprint.length === 0) return toast.error("Select or create a blueprint")
    setIsSaving(true)
    try {
      if (editExam) {
        await apiClient.put(`/api/exams/${editExam.id}`, { exam_name: examName.trim(), chapters_selected: chapters, blueprint, total_marks: totalMarks })
        toast.success("Exam updated")
      } else {
        await apiClient.post("/api/exams/create", { class_subject_id: classSubjectId, exam_name: examName.trim(), chapters_selected: chapters, blueprint, total_marks: totalMarks })
        toast.success("Exam created")
      }
      setDrawerOpen(false); resetForm()
      if (classSubjectId) fetchExams(classSubjectId)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to save exam")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteExam = async () => {
    if (!deleteExamConfirm) return
    setIsDeletingExam(true)
    try {
      await apiClient.delete(`/api/exams/${deleteExamConfirm.id}`)
      toast.success("Exam deleted")
      if (selectedExamId === deleteExamConfirm.id) setSelectedExamId(null)
      setDeleteExamConfirm(null)
      if (classSubjectId) fetchExams(classSubjectId)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete exam")
    } finally {
      setIsDeletingExam(false)
    }
  }

  const addChapter = (ch: string) => {
    const t = ch.trim()
    if (t && !chapters.includes(t)) setChapters([...chapters, t])
    setChapterInput(""); setShowSuggestions(false)
  }

  const updateBlueprint = (idx: number, field: keyof BlueprintSection, value: string | number) => {
    setBlueprint((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)))
    setBlueprintEdited(true)
  }

  const handleBlueprintSelect = (value: string) => {
    const found = savedBlueprints.find((bp) => bp.id === value)
    if (found) {
      setSelectedBlueprintId(found.id); setBlueprint(found.sections.map((s) => ({ ...s })))
      setShowBlueprintSections(true); setBlueprintEdited(false)
    }
  }

  const handleBlueprintCreated = (bp: Blueprint) => {
    setBlueprintModalOpen(false); setSavedBlueprints((prev) => [bp, ...prev])
    setSelectedBlueprintId(bp.id); setBlueprint(bp.sections.map((s) => ({ ...s })))
    setShowBlueprintSections(true); setBlueprintEdited(false)
  }

  const handleSaveEditedAsBlueprint = async () => {
    const sourceName = savedBlueprints.find((bp) => bp.id === selectedBlueprintId)?.name
    try {
      const res = await apiClient.post<{ blueprint: Blueprint }>("/api/blueprints", {
        name: sourceName ? `${sourceName} (edited)` : "Untitled Blueprint", sections: blueprint,
      })
      toast.success("Saved as new blueprint")
      setSavedBlueprints((prev) => [res.blueprint, ...prev]); setSelectedBlueprintId(res.blueprint.id); setBlueprintEdited(false)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to save blueprint")
    }
  }

  /* ── Upload answer sheet ── */
  const handleUploadClick = (studentId: string) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/pdf,image/jpeg,image/png,image/webp"
    input.onchange = async () => {
      const rawFile = input.files?.[0]
      if (!rawFile || !selectedExamId) return
      setUploadingSet((prev) => new Set(prev).add(studentId))
      try {
        const file = await compressForUpload(rawFile)
        const formData = new FormData()
        formData.append("file", file)
        formData.append("exam_id", selectedExamId)
        formData.append("student_id", studentId)
        const token = localStorage.getItem("access_token")
        const BASE_URL = import.meta.env.VITE_API_BASE_URL as string
        const res = await fetch(`${BASE_URL}/api/grading/upload-answer-sheet`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData,
        })
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Upload failed") }
        toast.success("Answer sheet uploaded! AI grading in progress...")
        if (classSubjectId) fetchStudentsAndSubmissions(classSubjectId, selectedExamId)
      } catch (err: unknown) {
        toast.error((err as Error).message || "Failed to upload")
      } finally {
        setUploadingSet((prev) => { const next = new Set(prev); next.delete(studentId); return next })
      }
    }
    input.click()
  }

  const handleScanUpload = async (pdfFile: File) => {
    if (!scanModal || !selectedExamId) return
    const { studentId } = scanModal
    setScanModal(null)
    setUploadingSet((prev) => new Set(prev).add(studentId))
    try {
      const formData = new FormData()
      formData.append("file", pdfFile)
      formData.append("exam_id", selectedExamId)
      formData.append("student_id", studentId)
      const token = localStorage.getItem("access_token")
      const BASE_URL = import.meta.env.VITE_API_BASE_URL as string
      const res = await fetch(`${BASE_URL}/api/grading/upload-answer-sheet`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData,
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Upload failed") }
      toast.success("Answer sheet uploaded! AI grading in progress...")
      if (classSubjectId) fetchStudentsAndSubmissions(classSubjectId, selectedExamId)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to upload")
    } finally {
      setUploadingSet((prev) => { const next = new Set(prev); next.delete(studentId); return next })
    }
  }

  const handleDeleteSubmission = async () => {
    if (!deleteSubmissionConfirm) return
    setDeletingSubmissionId(deleteSubmissionConfirm.submissionId)
    try {
      await apiClient.delete(`/api/grading/submission/${deleteSubmissionConfirm.submissionId}`)
      toast.success("Answer sheet removed")
      if (classSubjectId && selectedExamId) fetchStudentsAndSubmissions(classSubjectId, selectedExamId)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete")
    } finally {
      setDeletingSubmissionId(null); setDeleteSubmissionConfirm(null)
    }
  }

  /* ── Question paper helpers ── */
  const sectionGroups = questions.reduce<Record<string, Question[]>>((acc, q) => {
    const sec = q.section || "Other"
    if (!acc[sec]) acc[sec] = []
    acc[sec].push(q)
    return acc
  }, {})
  const sortedSections = Object.keys(sectionGroups).sort()

  const filteredSuggestions = chapterSuggestions.filter(
    (s) => s.toLowerCase().includes(chapterInput.toLowerCase()) && !chapters.includes(s),
  )

  const gradedCount = submissions.filter((s) => s.status === "graded").length

  const filteredExams = searchQuery.trim()
    ? exams.filter((e) =>
        e.exam_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.chapters_selected?.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : exams

  if (!user) return null

  if (!classSubjectId) {
    return (
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-4">
        <FileTextIcon className="size-16 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">Select a class from the sidebar</p>
      </div>
    )
  }

  return (
    <>
    {!selectedExamId ? (
      /* ── Card grid view ── */
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-3">
          <h1 className="shrink-0 text-sm font-semibold">Exams</h1>
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search exams…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button size="sm" onClick={openCreate} className="ml-auto gap-1.5 shrink-0">
            <PlusIcon className="size-3.5" />
            New Exam
          </Button>
        </div>

        {/* Cards */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {isLoadingExams ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-36 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <FileTextIcon className="size-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No exams match your search" : "No exams yet"}
              </p>
              {!searchQuery && (
                <Button size="sm" variant="outline" onClick={openCreate}>
                  <PlusIcon className="mr-1.5 size-3.5" />
                  Create your first exam
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredExams.map((exam) => {
                const hasQuestions = exam.question_count > 0
                return (
                  <Card
                    key={exam.id}
                    className="group cursor-pointer transition-all hover:shadow-md"
                    onClick={() => selectExam(exam.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 flex-1 text-sm font-medium leading-snug">
                          {exam.exam_name}
                        </p>
                        <Badge
                          variant={hasQuestions ? "default" : "secondary"}
                          className="shrink-0 text-[10px]"
                        >
                          {hasQuestions ? "Ready" : "Draft"}
                        </Badge>
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{exam.total_marks} marks</span>
                        <span>·</span>
                        <span>
                          {exam.question_count} question{exam.question_count !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        <CalendarIcon className="size-2.5 shrink-0" />
                        {dayjs(exam.created_at).format("MMM D, YYYY")}
                      </div>

                      {exam.chapters_selected && exam.chapters_selected.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {exam.chapters_selected.slice(0, 3).map((ch) => (
                            <span
                              key={ch}
                              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {ch}
                            </span>
                          ))}
                          {exam.chapters_selected.length > 3 && (
                            <span className="text-[10px] text-muted-foreground/50">
                              +{exam.chapters_selected.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {!hasQuestions && (
                        <div className="mt-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => { e.stopPropagation(); openEdit(exam) }}
                          >
                            <EditIcon className="mr-1 size-3" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteExamConfirm(exam) }}
                          >
                            <Trash2Icon className="mr-1 size-3" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    ) : (
      /* ── Detail view ── */
      <div className="flex h-full min-h-0 overflow-hidden">

        {/* ── Centre: question paper ── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r">
          {/* Header */}
          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedExamId(null)}
              className="h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground"
            >
              <ArrowLeftIcon className="size-3.5" />
              Back
            </Button>
            <Separator orientation="vertical" className="mx-0.5 h-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="truncate text-sm font-semibold">{selectedExam?.exam_name}</span>
              <span className="ml-2 text-[11px] text-muted-foreground">
                {selectedExam?.total_marks} marks · {selectedExam?.question_count} question{selectedExam?.question_count !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {selectedExam && selectedExam.question_count === 0 ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/class/${classSubjectId}/exams/${selectedExamId}/generate`)}
                  >
                    <SparklesIcon className="mr-1.5 size-3.5" />
                    AI Generate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/class/${classSubjectId}/exams/${selectedExamId}/upload`)}
                  >
                    <UploadIcon className="mr-1.5 size-3.5" />
                    Upload Paper
                  </Button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowAnswers((v) => !v)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      showAnswers
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <KeyRoundIcon className="size-3.5" />
                    {showAnswers ? "Hide Answers" : "Show Answers"}
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/class/${classSubjectId}/exams/${selectedExamId}/pdf-builder`)}
                  >
                    <FileOutputIcon className="mr-1.5 size-3.5" />
                    Export PDF
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Questions body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoadingQuestions ? (
              <div className="space-y-3 p-5">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
              </div>
            ) : selectedExam?.question_count === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <FileTextIcon className="size-10 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No questions yet</p>
                <p className="max-w-xs text-xs text-muted-foreground/60">
                  Generate with AI or upload an existing paper to get started.
                </p>
              </div>
            ) : questions.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="p-5 pb-8">
                {(() => {
                  let globalIdx = 0
                  return sortedSections.map((section) => {
                    const qs = [...sectionGroups[section]].sort((a, b) => a.question_order - b.question_order)
                    const isExpanded = expandedSections.has(section)
                    const sectionMarks = qs.reduce((s, q) => s + q.marks, 0)
                    const startIdx = globalIdx
                    globalIdx += qs.length

                    return (
                      <div key={section} className="mb-6 last:mb-0">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSections((prev) => {
                              const next = new Set(prev)
                              if (next.has(section)) next.delete(section); else next.add(section)
                              return next
                            })
                          }
                          className="mb-3 flex w-full items-center gap-2 text-left"
                        >
                          {isExpanded
                            ? <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            : <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          }
                          <div className="flex flex-1 items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-foreground">
                              Section {section}
                            </span>
                            <Separator className="flex-1" />
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {qs.length} question{qs.length !== 1 ? "s" : ""} · {sectionMarks} marks
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="space-y-2.5 pl-5">
                            {qs.map((q, i) => {
                              const qNum = startIdx + i + 1
                              const hasAnswerKey = !!q.answer_key
                              return (
                                <div key={q.id} className="overflow-hidden rounded-lg border bg-card">
                                  <div className="flex items-center gap-2 border-b bg-muted/30 px-3.5 py-2">
                                    <span className="text-xs font-bold text-muted-foreground">{qNum}.</span>
                                    {q.type && (
                                      <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
                                        {q.type}
                                      </span>
                                    )}
                                    <span className="ml-auto text-[11px] font-semibold text-muted-foreground">
                                      {q.marks} {q.marks === 1 ? "mark" : "marks"}
                                    </span>
                                  </div>
                                  <div className="px-4 py-3">
                                    <div className="prose prose-sm max-w-none text-sm leading-relaxed dark:prose-invert">
                                      <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkMath]}
                                        rehypePlugins={[rehypeKatex, rehypeRaw]}
                                      >
                                        {q.question_text}
                                      </ReactMarkdown>
                                    </div>

                                    {q.options && q.options.length > 0 && (
                                      <div className="mt-3 space-y-1.5">
                                        {q.options.map((opt, oi) => {
                                          const label = String.fromCharCode(65 + oi)
                                          const isCorrect = showAnswers && q.answer_key === label
                                          return (
                                            <div
                                              key={oi}
                                              className={cn(
                                                "flex items-start gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                                                isCorrect
                                                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                                                  : "bg-muted/40",
                                              )}
                                            >
                                              <span className={cn(
                                                "mt-px shrink-0 text-xs font-semibold",
                                                isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                                              )}>
                                                {label}.
                                              </span>
                                              <span className="flex-1">{opt}</span>
                                              {isCorrect && (
                                                <CheckCircle2Icon className="mt-px size-3.5 shrink-0 text-emerald-600" />
                                              )}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}

                                    {showAnswers && hasAnswerKey && (!q.options || q.options.length === 0) && (
                                      <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800/40 dark:bg-emerald-900/15">
                                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                                          Answer Key
                                        </p>
                                        <div className="prose prose-sm max-w-none text-sm text-emerald-900 dark:prose-invert dark:text-emerald-200">
                                          <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkMath]}
                                            rehypePlugins={[rehypeKatex, rehypeRaw]}
                                          >
                                            {q.answer_key!}
                                          </ReactMarkdown>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: students (wider) ── */}
        <div className="flex w-[300px] shrink-0 flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Students</span>
            {students.length > 0 && !isLoadingStudents && (
              <span className="text-[11px] text-muted-foreground">
                {gradedCount}/{students.length} graded
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoadingStudents ? (
              <div className="space-y-1 px-3 pt-2">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[52px] w-full rounded-md" />)}
              </div>
            ) : students.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <UserIcon className="size-7 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground">No students</p>
              </div>
            ) : (
              <div className="divide-y">
                {students
                  .sort((a, b) => a.roll_number - b.roll_number)
                  .map((student) => {
                    const sub = submissions.find((s) => s.student_id === student.id)
                    const isGraded = sub?.status === "graded"
                    const isProcessing = sub?.status === "uploaded" || sub?.status === "processing"
                    const isFailed = sub?.status === "failed"
                    const isUploading = uploadingSet.has(student.id)

                    return (
                      <div key={student.id} className="flex items-center gap-2.5 px-4 py-3">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                          {student.roll_number}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium leading-snug">{student.full_name}</p>
                          {isGraded ? (
                            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              {sub!.total_final_marks}/{selectedExam?.total_marks}
                            </p>
                          ) : isProcessing ? (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">
                              {sub!.status === "processing" ? "Grading…" : "Uploaded"}
                            </p>
                          ) : isFailed ? (
                            <p className="text-[11px] text-destructive">Failed</p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground/50">Not submitted</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          {isGraded ? (
                            <button
                              onClick={() => navigate(`/class/${classSubjectId}/grading/${sub!.id}/review`)}
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="View review"
                            >
                              <EyeIcon className="size-3.5" />
                            </button>
                          ) : isProcessing ? (
                            <Loader2Icon className="size-3.5 animate-spin text-amber-500" />
                          ) : isFailed ? (
                            <>
                              <button
                                onClick={() => handleUploadClick(student.id)}
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Re-upload"
                              >
                                <RefreshCwIcon className="size-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteSubmissionConfirm({ submissionId: sub!.id, studentName: student.full_name })}
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                                title="Remove"
                              >
                                <Trash2Icon className="size-3.5" />
                              </button>
                            </>
                          ) : isUploading ? (
                            <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <button
                                onClick={() => handleUploadClick(student.id)}
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Upload answer sheet"
                              >
                                <UploadIcon className="size-3.5" />
                              </button>
                              <button
                                onClick={() => setScanModal({ studentId: student.id, studentName: student.full_name })}
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Scan pages"
                              >
                                <CameraIcon className="size-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

      {/* ── Dialogs ── */}

      {/* Delete exam */}
      <AlertDialog open={!!deleteExamConfirm} onOpenChange={() => setDeleteExamConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteExamConfirm?.exam_name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExam} disabled={isDeletingExam}>
              {isDeletingExam ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete submission */}
      <AlertDialog open={!!deleteSubmissionConfirm} onOpenChange={(open) => !open && setDeleteSubmissionConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Answer Sheet</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the answer sheet for{" "}
              <span className="font-semibold text-foreground">{deleteSubmissionConfirm?.studentName}</span>?
              You can re-upload a new one after.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubmission}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSubmissionId ? <Loader2Icon className="mr-1.5 size-3.5 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Scan modal */}
      <ScanPagesModal
        open={!!scanModal}
        studentName={scanModal?.studentName ?? ""}
        onClose={() => setScanModal(null)}
        onSubmit={handleScanUpload}
      />

      {/* Create / Edit exam drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side={isMobile ? "bottom" : "right"} size={isMobile ? "full" : "lg"} showCloseButton={false} className="flex h-full w-full flex-col p-0">
          <SheetHeader className="flex-row items-center justify-between border-b bg-muted/50 px-4 py-3 sm:px-6 sm:py-4">
            <SheetTitle className="text-base font-medium text-secondary-foreground">
              {editExam ? "Edit Exam" : "Create Exam"}
            </SheetTitle>
            <SheetClose asChild>
              <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <XIcon className="size-5" />
              </button>
            </SheetClose>
          </SheetHeader>

          <div className="no-scrollbar flex-1 overflow-y-auto">
            <div className="flex flex-col gap-6 px-4 py-5 sm:px-6">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Exam Name</Label>
              <Input
                placeholder="e.g., Mid-Term Examination 2026"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
              />
            </div>

            {/* Chapters */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Chapters / Topics</Label>
              <div className="relative">
                <Input
                  placeholder="Type to search or add chapters…"
                  value={chapterInput}
                  onChange={(e) => { setChapterInput(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && chapterInput.trim()) { e.preventDefault(); addChapter(chapterInput) }
                  }}
                />
                {showSuggestions && chapterInput && filteredSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                    {filteredSuggestions.map((s) => (
                      <button
                        key={s}
                        className="w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-muted"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addChapter(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {chapters.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {chapters.map((ch) => (
                    <span key={ch} className="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {ch}
                      <button onClick={() => setChapters(chapters.filter((c) => c !== ch))} className="ml-0.5 hover:opacity-70">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Blueprint */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Blueprint</Label>
              {savedBlueprints.length === 0 ? (
                <Button type="button" variant="outline" className="w-full gap-1.5 text-xs" onClick={() => setBlueprintModalOpen(true)}>
                  <PlusIcon className="size-3.5" /> Create Blueprint
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Select value={selectedBlueprintId || undefined} onValueChange={handleBlueprintSelect}>
                    <SelectTrigger className="h-9 flex-1 text-xs">
                      <SelectValue placeholder="Select a blueprint" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedBlueprints.map((bp) => (
                        <SelectItem key={bp.id} value={bp.id}>{bp.name} ({bp.total_marks} marks)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs text-primary" onClick={() => setBlueprintModalOpen(true)}>
                    <PlusIcon className="mr-1 size-3" /> New
                  </Button>
                </div>
              )}

              {showBlueprintSections && (
                <>
                  <div className="flex justify-end">
                    <button onClick={() => { setBlueprint((prev) => [...prev, { section: String.fromCharCode(65 + prev.length), type: "", num_questions: 1, marks_per_question: 1 }]); setBlueprintEdited(true) }} className="text-xs font-medium text-primary hover:underline">
                      + Add Section
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {blueprint.map((sec, idx) => (
                      <div key={idx} className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3">
                        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                          {[
                            { label: "Section", field: "section" as keyof BlueprintSection, value: sec.section },
                            { label: "Type", field: "type" as keyof BlueprintSection, value: sec.type, placeholder: "e.g., MCQ" },
                            { label: "Questions", field: "num_questions" as keyof BlueprintSection, value: sec.num_questions, type: "number" },
                            { label: "Marks each", field: "marks_per_question" as keyof BlueprintSection, value: sec.marks_per_question, type: "number" },
                          ].map(({ label, field, value, placeholder, type }) => (
                            <div key={field}>
                              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">{label}</label>
                              <Input
                                type={type || "text"}
                                min={type === "number" ? 1 : undefined}
                                value={value as string | number}
                                placeholder={placeholder}
                                onChange={(e) => updateBlueprint(idx, field, type === "number" ? Number(e.target.value) : e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>
                          ))}
                        </div>
                        {blueprint.length > 1 && (
                          <button onClick={() => { setBlueprint((prev) => prev.filter((_, i) => i !== idx)); setBlueprintEdited(true) }} className="mt-5 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                            <Trash2Icon className="size-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-primary/5 px-4 py-2.5">
                    <span className="text-sm font-medium">Total Marks</span>
                    <span className="text-lg font-bold text-primary">{totalMarks}</span>
                  </div>
                  {blueprintEdited && selectedBlueprintId && (
                    <button onClick={handleSaveEditedAsBlueprint} className="text-xs font-medium text-primary hover:underline">
                      Save changes as new blueprint
                    </button>
                  )}
                </>
              )}
            </div>
            </div>
          </div>

          <SheetFooter className="flex-col border-t bg-muted/50 px-4 py-3 sm:px-6 sm:py-4">
            <Button size="lg" className="w-full" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
              {editExam ? "Update Exam" : "Create Exam"}
            </Button>
            <Button variant="outline" size="lg" className="w-full" onClick={() => { setDrawerOpen(false); resetForm() }}>Cancel</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <BlueprintModal
        open={blueprintModalOpen}
        onClose={() => setBlueprintModalOpen(false)}
        onSaved={handleBlueprintCreated}
      />
    </>
  )
}
