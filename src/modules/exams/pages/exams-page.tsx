import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  CameraIcon,
  ExamIcon,
  CheckCircleIcon,
  CaretRightIcon,
  PencilSimpleIcon,
  EyeIcon,
  ExportIcon,
  FileTextIcon,
  KeyIcon,
  CircleNotchIcon,
  PlusIcon,
  ArrowsClockwiseIcon,
  SparkleIcon,
  TrashIcon,
  UploadIcon,
  UserIcon,
  CheckIcon,
  CopyIcon,
} from "@phosphor-icons/react"
import dayjs from "dayjs"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"
import "katex/dist/katex.min.css"
import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"

import { sanitizeSchema } from "@/lib/markdown-sanitize"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { ClassPageHeader } from "@/components/layout/class-page-header"
import {
  PageToolbar,
  PageToolbarSkeleton,
} from "@/components/shared/page-toolbar"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Sticker } from "@/components/shared/sticker"
import { countSummary, tameCaps } from "@/lib/format"
import {
  Sheet,
  SheetContent,
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
import {
  BlueprintModal,
  type Blueprint,
  type BlueprintSection,
} from "../components/blueprint-modal"
import { ChapterTopicPicker } from "../components/chapter-topic-picker"
import {
  useTeacherAssignments,
  classLabel,
  type Assignment,
} from "@/hooks/use-teacher-assignments"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
/**
 * MCQ answers arrive from the AI in a few shapes:
 *   "(A) 22338"   parenthesised
 *   "A. 22338"    dotted
 *   "A"           bare letter
 * The option-letter rendered next to each choice is always the single letter,
 * so pull the first A-D out of the answer key and compare on that. Case-
 * insensitive because some models return lowercase.
 */
import { ScanPagesModal } from "@/modules/grading/components/scan-pages-modal"
import {
  matchesOptionLetter,
  stripOptionPrefix,
} from "@/modules/exams/lib/options"

/* ─── Types ─────────────────────────────────────────────── */

interface Exam {
  id: string
  class_subject_id: string
  exam_name: string
  blueprint: BlueprintSection[]
  chapters_selected: string[]
  total_marks: number
  pass_marks: number | null
  question_count: number
  submission_count?: number
  graded_count?: number
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
  {
    section: "B",
    type: "Short Answer (2 marks)",
    num_questions: 5,
    marks_per_question: 2,
  },
  {
    section: "C",
    type: "Short Answer (3 marks)",
    num_questions: 6,
    marks_per_question: 3,
  },
  {
    section: "D",
    type: "Long Answer (5 marks)",
    num_questions: 4,
    marks_per_question: 5,
  },
  {
    section: "E",
    type: "Case Study / Long Answer (5 marks)",
    num_questions: 3,
    marks_per_question: 5,
  },
]

/* ─── Option text cleanup ───────────────────────────────── */

/**
 * MCQ options often arrive with their letter already embedded ("A. 22338",
 * "(a) 22338"). The UI renders its own letter, so strip a leading matching
 * one to avoid "A. A. 22338". A separator (dot/paren/colon) is required so
 * an option that genuinely starts with the letter ("A rational number…")
 * is left alone.
 */
/* ─── Chapter chip label ────────────────────────────────── */

/**
 * Chapters extracted from a syllabus often arrive as full outline lines:
 *   "1. Real Numbers: Fundamental Theorem of Arithmetic."

 * For the card chips only the chapter name matters — strip the leading
 * numbering, anything after a colon or a spaced dash, and a trailing dot.
 * Falls back to the raw string if trimming would leave nothing.
 */
function chapterChipLabel(ch: string): string {
  const trimmed = ch
    .replace(/^\s*(?:chapter\s+)?\d+\s*[.):]\s*/i, "")
    .replace(/\s*:.*$/, "")
    .replace(/\s+[—–-]\s.*$/, "")
    .replace(/\.\s*$/, "")
    .trim()
  return trimmed || ch
}

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
      const scale =
        Math.max(img.width, img.height) > maxDim
          ? maxDim / Math.max(img.width, img.height)
          : 1
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) =>
          resolve(
            blob && blob.size < file.size
              ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                  type: "image/jpeg",
                })
              : file
          ),
        "image/jpeg",
        0.92
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })
}

/* ─── Main component ─────────────────────────────────────── */

// ── Loading silhouettes ────────────────────────────────────────────────────
// Each mirrors the real markup it stands in for, so the page doesn't reflow
// when the data lands.

/** One row of the exam list: calendar tile, name + chapters, the @3xl cells,
 *  status pill, action slot. */
function ExamRowSkeleton() {
  return (
    <div className="relative flex items-center gap-4 rounded-lg px-3 py-3 after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-border last:after:hidden">
      <Skeleton className="size-10 shrink-0 rounded-lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-1/3 max-w-64" />
        <Skeleton className="h-3 w-1/2 max-w-80" />
      </div>
      <div className="hidden shrink-0 items-center gap-5 @3xl:flex">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
      <div className="flex w-16 shrink-0 justify-end">
        <Skeleton className="size-4 rounded-full" />
      </div>
    </div>
  )
}

function ExamListSkeleton() {
  return (
    <div aria-hidden className="-mx-3 flex flex-col">
      {Array.from({ length: 6 }).map((_, i) => (
        <ExamRowSkeleton key={i} />
      ))}
    </div>
  )
}

/** A question card as rendered in the paper view: numbered tile, type pill,
 *  marks on the right, two lines of text and a 2×2 option grid. */
function QuestionCardSkeleton({ options = true }: { options?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-7 shrink-0 rounded-lg" />
        <Skeleton className="h-4 w-14 rounded-full" />
        <Skeleton className="ml-auto h-3 w-14" />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      {options && (
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-lg" />
          ))}
        </div>
      )}
    </div>
  )
}

/** The paper body: a section pill with its hairline and count, then cards. */
function QuestionPaperSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-3xl p-5 pb-12 md:p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-28 rounded-full" />
        <span className="h-px flex-1 bg-border" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="flex flex-col gap-3 pt-4">
        <QuestionCardSkeleton />
        <QuestionCardSkeleton options={false} />
        <QuestionCardSkeleton />
      </div>
    </div>
  )
}

/** The answer-sheets rail: roll number, avatar, name over status. */
function StudentRailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex h-12 items-center gap-2.5 rounded-lg px-2">
          <Skeleton className="h-3 w-4 shrink-0" />
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Clone-sheet rows: name and facts beside a small Clone button. */
function CloneListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-7 w-16 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ExamsPage() {
  const { user } = useAuth()
  const { assignments } = useTeacherAssignments()
  const navigate = useNavigate()
  const { classSubjectId } = useParams<{ classSubjectId: string }>()

  /* Exams */
  const [exams, setExams] = useState<Exam[]>([])
  const [isLoadingExams, setIsLoadingExams] = useState(false)
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null)

  /* Question paper */
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedExamLocked, setSelectedExamLocked] = useState(false)
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  )
  const [showAnswers, setShowAnswers] = useState(false)

  /* Students + submissions */
  const [students, setStudents] = useState<Student[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [uploadingSet, setUploadingSet] = useState<Set<string>>(new Set())
  const [scanModal, setScanModal] = useState<{
    studentId: string
    studentName: string
  } | null>(null)
  const [deleteSubmissionConfirm, setDeleteSubmissionConfirm] = useState<{
    submissionId: string
    studentName: string
  } | null>(null)
  const [deletingSubmissionId, setDeletingSubmissionId] = useState<
    string | null
  >(null)

  /* Create / Edit exam drawer */
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editExam, setEditExam] = useState<Exam | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [examName, setExamName] = useState("")
  const [chapters, setChapters] = useState<string[]>([])
  const [blueprint, setBlueprint] =
    useState<BlueprintSection[]>(DEFAULT_BLUEPRINT)
  const [totalMarks, setTotalMarks] = useState(0)
  const [passMarks, setPassMarks] = useState<number | null>(null)
  const [savedBlueprints, setSavedBlueprints] = useState<Blueprint[]>([])
  const [selectedBlueprintId, setSelectedBlueprintId] = useState("")
  const [blueprintModalOpen, setBlueprintModalOpen] = useState(false)
  const [blueprintEdited, setBlueprintEdited] = useState(false)
  const [showBlueprintSections, setShowBlueprintSections] = useState(false)

  /* Delete exam */
  const [deleteExamConfirm, setDeleteExamConfirm] = useState<Exam | null>(null)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [isDeletingExam, setIsDeletingExam] = useState(false)

  /* Search */
  const [searchQuery, setSearchQuery] = useState("")

  /* Polling */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null

  /* ── Computed ── */
  useEffect(() => {
    const calcMarks = blueprint.reduce(
      (sum, s) => sum + s.num_questions * s.marks_per_question,
      0
    )
    setTotalMarks(calcMarks)
  }, [blueprint])

  /* ── Fetch exams ── */
  const fetchExams = useCallback(async (csId: string) => {
    setIsLoadingExams(true)
    try {
      const res = await apiClient.get<{ exams: Exam[] }>(
        `/api/exams/class-subject/${csId}`
      )
      setExams(res.exams ?? [])
    } catch {
      setExams([])
    } finally {
      setIsLoadingExams(false)
    }
  }, [])

  const fetchBlueprints = useCallback(async () => {
    try {
      const res = await apiClient.get<{ blueprints: Blueprint[] }>(
        "/api/blueprints"
      )
      setSavedBlueprints(res.blueprints ?? [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (classSubjectId) {
      fetchExams(classSubjectId)
    }
    fetchBlueprints()
  }, [classSubjectId, fetchExams, fetchBlueprints])

  /* ── Fetch question paper ── */
  const fetchQuestions = useCallback(async (examId: string) => {
    setIsLoadingQuestions(true)
    try {
      const res = await apiClient.get<{
        questions: Question[]
        exam: { locked_for_editing?: boolean }
      }>(`/api/exams/${examId}`)
      setQuestions(res.questions ?? [])
      setSelectedExamLocked(!!res.exam?.locked_for_editing)
      const sections = new Set((res.questions ?? []).map((q) => q.section))
      setExpandedSections(sections)
    } catch {
      setQuestions([])
    } finally {
      setIsLoadingQuestions(false)
    }
  }, [])

  /* ── Fetch students + submissions ── */
  const fetchStudentsAndSubmissions = useCallback(
    async (csId: string, examId: string) => {
      setIsLoadingStudents(true)
      try {
        const [studentsRes, submissionsRes] = await Promise.all([
          apiClient.get<{ students: Student[] }>(
            `/api/students/class-subject/${csId}`
          ),
          apiClient.get<{ submissions: Submission[] }>(
            `/api/grading/submissions/${examId}`
          ),
        ])
        setStudents(studentsRes.students ?? [])
        setSubmissions(submissionsRes.submissions ?? [])
      } catch {
        /* ignore */
      } finally {
        setIsLoadingStudents(false)
      }
    },
    []
  )

  /* ── Select exam ── */
  const selectExam = useCallback(
    (examId: string) => {
      if (selectedExamId === examId) return
      setSelectedExamId(examId)
      setQuestions([])
      setStudents([])
      setSubmissions([])
      setShowAnswers(false)
      const exam = exams.find((e) => e.id === examId)
      if (exam && exam.question_count > 0) fetchQuestions(examId)
      if (classSubjectId) fetchStudentsAndSubmissions(classSubjectId, examId)
    },
    [
      selectedExamId,
      exams,
      classSubjectId,
      fetchQuestions,
      fetchStudentsAndSubmissions,
    ]
  )

  /* ── Deep link: /class/:csId/exams?exam=<id> opens that exam directly.
     Used by the class home "Recent exams" list and the Students tab. ── */
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const target = searchParams.get("exam")
    if (!target || exams.length === 0) return
    if (exams.some((e) => e.id === target)) selectExam(target)
    setSearchParams({}, { replace: true })
  }, [exams, searchParams, setSearchParams, selectExam])

  /* ── Polling for grading status ── */
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    const hasPending = submissions.some(
      (s) => s.status === "uploaded" || s.status === "processing"
    )
    if (hasPending && classSubjectId && selectedExamId) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await apiClient.get<{ submissions: Submission[] }>(
            `/api/grading/submissions/${selectedExamId}`
          )
          setSubmissions(res.submissions ?? [])
          if (
            !(res.submissions ?? []).some(
              (s) => s.status === "uploaded" || s.status === "processing"
            )
          ) {
            clearInterval(pollRef.current!)
            pollRef.current = null
          }
        } catch {
          /* ignore */
        }
      }, 5000)
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [submissions, classSubjectId, selectedExamId])

  /* ── Exam drawer helpers ── */
  const resetForm = () => {
    setExamName("")
    setChapters([])
    setBlueprint(DEFAULT_BLUEPRINT)
    setSelectedBlueprintId("")
    setBlueprintEdited(false)
    setShowBlueprintSections(false)
    setEditExam(null)
    setPassMarks(null)
  }

  const openCreate = () => {
    resetForm()
    setDrawerOpen(true)
  }

  const openEdit = (exam: Exam) => {
    setEditExam(exam)
    setExamName(exam.exam_name)
    setChapters(exam.chapters_selected ?? [])
    setBlueprint(exam.blueprint ?? DEFAULT_BLUEPRINT)
    setShowBlueprintSections(!!(exam.blueprint && exam.blueprint.length > 0))
    setBlueprintEdited(false)
    setDrawerOpen(true)
    setPassMarks(exam.pass_marks ?? null)
  }

  const handleSave = async () => {
    if (!examName.trim()) return toast.error("Exam name is required")
    if (chapters.length === 0) return toast.error("Select at least one chapter")
    if (!showBlueprintSections || blueprint.length === 0)
      return toast.error("Select or create a blueprint")
    if (passMarks != null && (passMarks <= 0 || passMarks > totalMarks)) {
      return toast.error(`Pass mark must be between 1 and ${totalMarks}`)
    }
    setIsSaving(true)
    try {
      if (editExam) {
        await apiClient.put(`/api/exams/${editExam.id}`, {
          exam_name: examName.trim(),
          chapters_selected: chapters,
          blueprint,
          total_marks: totalMarks,
          pass_marks: passMarks,
        })
        toast.success("Exam updated")
      } else {
        await apiClient.post("/api/exams/create", {
          class_subject_id: classSubjectId,
          exam_name: examName.trim(),
          chapters_selected: chapters,
          blueprint,
          total_marks: totalMarks,
          pass_marks: passMarks,
        })
        toast.success("Exam created")
      }
      setDrawerOpen(false)
      resetForm()
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

  const updateBlueprint = (
    idx: number,
    field: keyof BlueprintSection,
    value: string | number
  ) => {
    setBlueprint((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    )
    setBlueprintEdited(true)
  }

  const handleBlueprintSelect = (value: string) => {
    const found = savedBlueprints.find((bp) => bp.id === value)
    if (found) {
      setSelectedBlueprintId(found.id)
      setBlueprint(found.sections.map((s) => ({ ...s })))
      setShowBlueprintSections(true)
      setBlueprintEdited(false)
    }
  }

  const handleBlueprintCreated = (bp: Blueprint) => {
    setBlueprintModalOpen(false)
    setSavedBlueprints((prev) => [bp, ...prev])
    setSelectedBlueprintId(bp.id)
    setBlueprint(bp.sections.map((s) => ({ ...s })))
    setShowBlueprintSections(true)
    setBlueprintEdited(false)
  }

  const handleSaveEditedAsBlueprint = async () => {
    const sourceName = savedBlueprints.find(
      (bp) => bp.id === selectedBlueprintId
    )?.name
    try {
      const res = await apiClient.post<{ blueprint: Blueprint }>(
        "/api/blueprints",
        {
          name: sourceName ? `${sourceName} (edited)` : "Untitled Blueprint",
          sections: blueprint,
        }
      )
      toast.success("Saved as new blueprint")
      setSavedBlueprints((prev) => [res.blueprint, ...prev])
      setSelectedBlueprintId(res.blueprint.id)
      setBlueprintEdited(false)
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
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Upload failed")
        }
        toast.success("Answer sheet uploaded! AI grading in progress...")
        if (classSubjectId)
          fetchStudentsAndSubmissions(classSubjectId, selectedExamId)
      } catch (err: unknown) {
        toast.error((err as Error).message || "Failed to upload")
      } finally {
        setUploadingSet((prev) => {
          const next = new Set(prev)
          next.delete(studentId)
          return next
        })
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
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Upload failed")
      }
      toast.success("Answer sheet uploaded! AI grading in progress...")
      if (classSubjectId)
        fetchStudentsAndSubmissions(classSubjectId, selectedExamId)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to upload")
    } finally {
      setUploadingSet((prev) => {
        const next = new Set(prev)
        next.delete(studentId)
        return next
      })
    }
  }

  const handleDeleteSubmission = async () => {
    if (!deleteSubmissionConfirm) return
    setDeletingSubmissionId(deleteSubmissionConfirm.submissionId)
    try {
      await apiClient.delete(
        `/api/grading/submission/${deleteSubmissionConfirm.submissionId}`
      )
      toast.success("Answer sheet removed")
      if (classSubjectId && selectedExamId)
        fetchStudentsAndSubmissions(classSubjectId, selectedExamId)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete")
    } finally {
      setDeletingSubmissionId(null)
      setDeleteSubmissionConfirm(null)
    }
  }

  /* ── Question paper helpers ── */
  const sectionGroups = questions.reduce<Record<string, Question[]>>(
    (acc, q) => {
      const sec = q.section || "Other"
      if (!acc[sec]) acc[sec] = []
      acc[sec].push(q)
      return acc
    },
    {}
  )
  const sortedSections = Object.keys(sectionGroups).sort()

  const gradedCount = submissions.filter((s) => s.status === "graded").length

  const filteredExams = searchQuery.trim()
    ? exams.filter(
        (e) =>
          e.exam_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.chapters_selected?.some((c) =>
            c.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : exams

  if (!user) return null

  if (!classSubjectId) {
    return (
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-4">
        <FileTextIcon className="size-16 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">
          Select a class from the sidebar
        </p>
      </div>
    )
  }

  return (
    <>
      {!selectedExamId ? (
        /* ── Card grid view ── */
        <div
          className={cn(
            PAGE_GUTTER,
            PAGE_TOP,
            "@container flex min-h-full flex-col gap-5 pb-12"
          )}
        >
          <ClassPageHeader
            icon={ExamIcon}
            title="Exams"
            count={exams.length || undefined}
            description="Question papers for this class. Build one with Hint or upload your own."
            actions={
              <>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setCloneOpen(true)}
                >
                  <CopyIcon className="size-3.5" />
                  <span className="hidden sm:inline">Clone from a section</span>
                </Button>
                <Button size="lg" onClick={openCreate}>
                  <PlusIcon className="size-3.5" />
                  New exam
                </Button>
              </>
            }
          />

          {isLoadingExams && exams.length === 0 && (
            <PageToolbarSkeleton filters={false} />
          )}
          {exams.length > 0 && (
            <PageToolbar
              className="animate-in duration-300 fade-in-0"
              search={{
                value: searchQuery,
                onChange: setSearchQuery,
                placeholder: "Search papers…",
              }}
              summary={countSummary(
                filteredExams.length,
                exams.length,
                "paper",
                searchQuery.trim().length > 0
              )}
            />
          )}

          {/* Exam list */}
          <LoadingSwap
            loading={isLoadingExams}
            skeleton={<ExamListSkeleton />}
            className="flex-1"
          >
            {filteredExams.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
                <Sticker
                  name={searchQuery ? "lost" : "idea"}
                  size={searchQuery ? 120 : 96}
                />
                <div className="flex max-w-[380px] flex-col items-center gap-1 text-center">
                  <p className="text-base font-medium text-secondary-foreground">
                    {searchQuery ? "No paper matches that" : "No papers yet"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery
                      ? "Try a different name."
                      : "Build a question paper from this class's sources, or clone one you already made for another section."}
                  </p>
                </div>
                {!searchQuery && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button onClick={openCreate}>
                      <PlusIcon className="size-3.5" />
                      New exam
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCloneOpen(true)}
                    >
                      <CopyIcon className="size-3.5" />
                      Clone from a section
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="-mx-3 flex flex-col">
                {filteredExams.map((exam) => {
                  const hasQuestions = exam.question_count > 0
                  const chapters = exam.chapters_selected ?? []
                  const when = dayjs(exam.created_at)
                  const passPct =
                    exam.pass_marks != null && exam.total_marks > 0
                      ? Math.round((exam.pass_marks / exam.total_marks) * 100)
                      : null
                  return (
                    <div
                      key={exam.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectExam(exam.id)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && selectExam(exam.id)
                      }
                      className="group relative flex cursor-pointer items-center gap-4 rounded-lg px-3 py-3 transition-colors outline-none after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-border last:after:hidden hover:bg-muted/50 focus-visible:bg-muted/50"
                    >
                      {/* Calendar tile */}
                      <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-sidebar leading-none">
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {when.format("D")}
                        </span>
                        <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
                          {when.format("MMM")}
                        </span>
                      </span>

                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {tameCaps(exam.exam_name)}
                        </span>
                        {chapters.length > 0 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate text-xs text-muted-foreground">
                                {chapters
                                  .slice(0, 3)
                                  .map(chapterChipLabel)
                                  .join(" · ") +
                                  (chapters.length > 3
                                    ? ` · +${chapters.length - 3} more`
                                    : "")}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="whitespace-pre-line">
                              {chapters.join("\n")}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="truncate text-xs text-muted-foreground">
                            No chapters chosen
                          </span>
                        )}
                      </div>

                      {/* Aligned cells */}
                      <div className="hidden shrink-0 items-center gap-5 text-xs text-muted-foreground @3xl:flex">
                        <span className="w-24 truncate tabular-nums">
                          <span className="font-medium text-foreground">
                            {exam.question_count}
                          </span>{" "}
                          {exam.question_count === 1 ? "question" : "questions"}
                        </span>
                        <span className="w-20 truncate tabular-nums">
                          <span className="font-medium text-foreground">
                            {exam.total_marks}
                          </span>{" "}
                          marks
                        </span>
                        <span className="w-24 truncate tabular-nums">
                          {exam.pass_marks != null ? (
                            <>
                              pass{" "}
                              <span className="font-medium text-foreground">
                                {exam.pass_marks}
                              </span>
                              {passPct != null && ` (${passPct}%)`}
                            </>
                          ) : (
                            "no pass mark"
                          )}
                        </span>
                      </div>

                      <span
                        className={cn(
                          "flex w-16 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          hasQuestions
                            ? "bg-primary/10 text-primary"
                            : "border border-dashed border-border text-muted-foreground"
                        )}
                      >
                        {hasQuestions ? "Ready" : "Draft"}
                      </span>

                      <div className="flex w-16 shrink-0 items-center justify-end gap-0.5">
                        {!hasQuestions && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="Edit exam"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openEdit(exam)
                                  }}
                                  className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
                                >
                                  <PencilSimpleIcon className="size-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Edit exam</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="Delete exam"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeleteExamConfirm(exam)
                                  }}
                                  className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100"
                                >
                                  <TrashIcon className="size-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Delete exam</TooltipContent>
                            </Tooltip>
                          </>
                        )}
                        <CaretRightIcon className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </LoadingSwap>
        </div>
      ) : (
        /* ── Detail view ── */
        <div className="flex h-full min-h-0 overflow-hidden">
          {/* ── Centre: question paper ── */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border">
            {/* Header — fixed h-16 so its bottom border lines up with the
                students-rail header across the vertical split. */}
            <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSelectedExamId(null)}
                  className="shrink-0 rounded-full text-muted-foreground"
                  aria-label="Back to exams"
                >
                  <ArrowLeftIcon className="size-4" />
                </Button>
                <div className="flex min-w-0 flex-col">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {selectedExam ? tameCaps(selectedExam.exam_name) : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedExam &&
                      dayjs(selectedExam.created_at).format("D MMM YYYY")}
                    <span className="mx-1.5 text-border">·</span>
                    {selectedExam?.question_count}{" "}
                    {selectedExam?.question_count === 1
                      ? "question"
                      : "questions"}
                    <span className="mx-1.5 text-border">·</span>
                    {selectedExam?.total_marks} marks
                    {selectedExam?.pass_marks != null && (
                      <>
                        <span className="mx-1.5 text-border">·</span>
                        pass {selectedExam.pass_marks}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <DuplicateExamPopover
                  sourceExam={selectedExam}
                  currentClassSubjectId={classSubjectId ?? null}
                  assignments={assignments ?? []}
                  onDuplicated={() =>
                    classSubjectId && fetchExams(classSubjectId)
                  }
                />
                {selectedExam && selectedExam.question_count === 0 ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate(
                          `/class/${classSubjectId}/exams/${selectedExamId}/upload`
                        )
                      }
                    >
                      <UploadIcon className="size-3.5" />
                      Upload paper
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        navigate(
                          `/class/${classSubjectId}/exams/${selectedExamId}/generate`
                        )
                      }
                    >
                      <SparkleIcon weight="fill" className="size-3.5" />
                      Generate with Hint
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAnswers((v) => !v)}
                      aria-pressed={showAnswers}
                      className={cn(
                        "transition-colors",
                        showAnswers &&
                          "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                      )}
                    >
                      <KeyIcon
                        weight={showAnswers ? "fill" : "regular"}
                        className="size-3.5"
                      />
                      {showAnswers ? "Answers shown" : "Show answers"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        navigate(
                          `/class/${classSubjectId}/exams/${selectedExamId}/pdf-builder`
                        )
                      }
                    >
                      <ExportIcon className="size-3.5" />
                      Export PDF
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Questions body */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <LoadingSwap
                loading={isLoadingQuestions}
                skeleton={<QuestionPaperSkeleton />}
                className="h-full"
              >
                {selectedExam?.question_count === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                    <Sticker name="idea" size={96} />
                    <div className="flex max-w-sm flex-col gap-1">
                      <p className="text-base font-medium text-secondary-foreground">
                        This paper is empty
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Let Hint draft the questions from this class's sources,
                        or upload a paper you already have.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() =>
                          navigate(
                            `/class/${classSubjectId}/exams/${selectedExamId}/generate`
                          )
                        }
                      >
                        <SparkleIcon weight="fill" className="size-3.5" />
                        Generate with Hint
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          navigate(
                            `/class/${classSubjectId}/exams/${selectedExamId}/upload`
                          )
                        }
                      >
                        <UploadIcon className="size-3.5" />
                        Upload paper
                      </Button>
                    </div>
                  </div>
                ) : questions.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <CircleNotchIcon className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-3xl p-5 pb-12 md:p-6">
                    {(() => {
                      let globalIdx = 0
                      return sortedSections.map((section, sIdx) => {
                        const qs = [...sectionGroups[section]].sort(
                          (a, b) => a.question_order - b.question_order
                        )
                        const isExpanded = expandedSections.has(section)
                        const sectionMarks = qs.reduce((s, q) => s + q.marks, 0)
                        const startIdx = globalIdx
                        globalIdx += qs.length

                        return (
                          <section
                            key={section}
                            className={cn(
                              "flex flex-col",
                              sIdx > 0 && "mt-6 border-t border-border pt-6"
                            )}
                          >
                            {/* Section heading — a pill, like every other group
                              heading in the app, with the caret inside it */}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSections((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(section)) next.delete(section)
                                  else next.add(section)
                                  return next
                                })
                              }
                              aria-expanded={isExpanded}
                              className="group/section flex w-full items-center gap-3 text-left"
                            >
                              <span className="inline-flex items-center gap-2 rounded-full bg-sidebar py-1 pr-3 pl-2 text-xs font-medium text-secondary-foreground ring-1 ring-border/60 transition-colors group-hover/section:bg-muted">
                                <CaretRightIcon
                                  weight="bold"
                                  className={cn(
                                    "size-3 text-muted-foreground transition-transform duration-200",
                                    isExpanded && "rotate-90"
                                  )}
                                />
                                Section {section}
                              </span>
                              <span className="h-px flex-1 bg-border" />
                              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                                {qs.length}{" "}
                                {qs.length === 1 ? "question" : "questions"}
                                <span className="mx-1.5 text-border">·</span>
                                {sectionMarks} marks
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
                                    {qs.map((q, i) => {
                                      const qNum = startIdx + i + 1
                                      const hasAnswerKey = !!q.answer_key
                                      return (
                                        <article
                                          key={q.id}
                                          style={{
                                            animationDelay: `${Math.min(i, 6) * 40}ms`,
                                          }}
                                          className="group/q animate-in rounded-xl border border-border bg-background p-4 transition-shadow duration-300 fade-in-0 fill-mode-backwards slide-in-from-bottom-2 hover:shadow-sm"
                                        >
                                          {/* Question header */}
                                          <div className="flex items-center gap-2.5">
                                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar text-xs font-semibold text-foreground tabular-nums ring-1 ring-border/60">
                                              {qNum}
                                            </span>
                                            {q.type && (
                                              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                                {q.type}
                                              </span>
                                            )}
                                            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                                              <span className="font-medium text-foreground">
                                                {q.marks}
                                              </span>{" "}
                                              {q.marks === 1 ? "mark" : "marks"}
                                            </span>
                                            {/* Per-question edit — routes to the full questions
                                              editor rather than duplicating an inline editor here.
                                              Hidden once the backend reports the exam is locked
                                              (see exams.controller.js -> isExamLockedForEditing). */}
                                            {!selectedExamLocked && (
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      navigate(
                                                        `/class/${classSubjectId}/exams/${selectedExamId}/questions?edit=${q.id}`
                                                      )
                                                    }
                                                    className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover/q:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
                                                    aria-label={`Edit question ${qNum}`}
                                                  >
                                                    <PencilSimpleIcon className="size-3.5" />
                                                  </button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  Edit question
                                                </TooltipContent>
                                              </Tooltip>
                                            )}
                                          </div>

                                          {/* Question text */}
                                          <div className="prose prose-sm dark:prose-invert mt-3 max-w-none text-sm leading-relaxed text-foreground">
                                            <ReactMarkdown
                                              remarkPlugins={[
                                                remarkGfm,
                                                remarkMath,
                                              ]}
                                              rehypePlugins={[
                                                rehypeRaw,
                                                [rehypeSanitize, sanitizeSchema],
                                                rehypeKatex,
                                              ]}
                                            >
                                              {q.question_text}
                                            </ReactMarkdown>
                                          </div>

                                          {/* Options */}
                                          {q.options &&
                                            q.options.length > 0 && (
                                              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                                                {q.options.map((opt, oi) => {
                                                  const label =
                                                    String.fromCharCode(65 + oi)
                                                  const isCorrect =
                                                    showAnswers &&
                                                    matchesOptionLetter(
                                                      q.answer_key,
                                                      label
                                                    )
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
                                                        {stripOptionPrefix(
                                                          opt,
                                                          label
                                                        )}
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

                                          {/* Answer key */}
                                          <AnimatePresence initial={false}>
                                            {showAnswers && hasAnswerKey && (
                                              <motion.div
                                                key="answer"
                                                initial={{
                                                  height: 0,
                                                  opacity: 0,
                                                }}
                                                animate={{
                                                  height: "auto",
                                                  opacity: 1,
                                                }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                              >
                                                <div className="mt-3 rounded-lg border-l-2 border-primary bg-primary/5 px-3 py-2">
                                                  <p className="mb-1 flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-primary uppercase">
                                                    <KeyIcon
                                                      weight="fill"
                                                      className="size-3"
                                                    />
                                                    Answer
                                                  </p>
                                                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground">
                                                    <ReactMarkdown
                                                      remarkPlugins={[
                                                        remarkGfm,
                                                        remarkMath,
                                                      ]}
                                                      rehypePlugins={[
                                                        rehypeRaw,
                                                        [rehypeSanitize, sanitizeSchema],
                                                        rehypeKatex,
                                                      ]}
                                                    >
                                                      {q.answer_key!}
                                                    </ReactMarkdown>
                                                  </div>
                                                </div>
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </article>
                                      )
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </section>
                        )
                      })
                    })()}
                  </div>
                )}
              </LoadingSwap>
            </div>
          </div>

          {/* ── Right panel: students ── */}
          <div className="flex w-[320px] shrink-0 flex-col bg-sidebar/40">
            {/* Same fixed h-16 as the question-pane header so the two bottom
                borders read as one continuous divider. */}
            <div className="flex h-16 shrink-0 flex-col justify-center gap-1.5 border-b border-border px-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-secondary-foreground">
                  <UserIcon className="size-3.5 text-muted-foreground" />
                  Answer sheets
                </span>
                {students.length > 0 && !isLoadingStudents && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    <span className="font-medium text-foreground">
                      {gradedCount}
                    </span>{" "}
                    of {students.length} graded
                  </span>
                )}
              </div>
              {students.length > 0 && !isLoadingStudents && (
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500",
                      gradedCount === students.length
                        ? "bg-primary"
                        : "bg-primary/60"
                    )}
                    style={{
                      width: `${Math.min(100, Math.round((gradedCount / students.length) * 100))}%`,
                    }}
                  />
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <LoadingSwap
                loading={isLoadingStudents}
                skeleton={<StudentRailSkeleton />}
              >
                {students.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                    <Sticker name="peek" size={56} />
                    <p className="text-xs text-muted-foreground">
                      No students in this class yet.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col p-2">
                    {students
                      .sort((a, b) => a.roll_number - b.roll_number)
                      .map((student, i) => {
                        const sub = submissions.find(
                          (s) => s.student_id === student.id
                        )
                        const isGraded = sub?.status === "graded"
                        const isProcessing =
                          sub?.status === "uploaded" ||
                          sub?.status === "processing"
                        const isFailed = sub?.status === "failed"
                        const isUploading = uploadingSet.has(student.id)
                        const initials = student.full_name
                          .split(" ")
                          .filter(Boolean)
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)

                        return (
                          <div
                            key={student.id}
                            style={{
                              animationDelay: `${Math.min(i, 10) * 25}ms`,
                            }}
                            className="group/row flex h-12 animate-in items-center gap-2.5 rounded-lg px-2 transition-colors duration-300 fade-in-0 fill-mode-backwards slide-in-from-right-2 hover:bg-background"
                          >
                            <span className="w-4 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">
                              {student.roll_number}
                            </span>
                            <Avatar className="size-7">
                              <AvatarFallback className="text-[10px]">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <p className="truncate text-xs leading-snug font-medium text-foreground">
                                {student.full_name}
                              </p>
                              {isGraded ? (
                                <p className="text-[11px] leading-snug font-medium text-primary tabular-nums">
                                  {sub!.total_final_marks}
                                  <span className="font-normal text-muted-foreground">
                                    /{selectedExam?.total_marks}
                                  </span>
                                </p>
                              ) : isProcessing ? (
                                <p className="flex items-center gap-1 text-[11px] leading-snug text-violet-600 dark:text-violet-400">
                                  <CircleNotchIcon className="size-3 animate-spin" />
                                  {sub!.status === "processing"
                                    ? "Grading…"
                                    : "Uploaded"}
                                </p>
                              ) : isFailed ? (
                                <p className="text-[11px] leading-snug text-destructive">
                                  Failed
                                </p>
                              ) : isUploading ? (
                                <p className="flex items-center gap-1 text-[11px] leading-snug text-muted-foreground">
                                  <CircleNotchIcon className="size-3 animate-spin" />
                                  Uploading…
                                </p>
                              ) : (
                                <p className="text-[11px] leading-snug text-muted-foreground/70">
                                  No sheet yet
                                </p>
                              )}
                            </div>

                            {/* Actions — revealed on hover, always there for keyboard */}
                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                              {isGraded ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        navigate(
                                          `/class/${classSubjectId}/grading/${sub!.id}/review`
                                        )
                                      }
                                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                      aria-label="Open review"
                                    >
                                      <EyeIcon className="size-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Open review</TooltipContent>
                                </Tooltip>
                              ) : isProcessing ||
                                isUploading ? null : isFailed ? (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUploadClick(student.id)
                                        }
                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        aria-label="Re-upload"
                                      >
                                        <ArrowsClockwiseIcon className="size-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Re-upload</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setDeleteSubmissionConfirm({
                                            submissionId: sub!.id,
                                            studentName: student.full_name,
                                          })
                                        }
                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                                        aria-label="Remove"
                                      >
                                        <TrashIcon className="size-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Remove</TooltipContent>
                                  </Tooltip>
                                </>
                              ) : (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUploadClick(student.id)
                                        }
                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        aria-label="Upload answer sheet"
                                      >
                                        <UploadIcon className="size-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Upload answer sheet
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setScanModal({
                                            studentId: student.id,
                                            studentName: student.full_name,
                                          })
                                        }
                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        aria-label="Scan pages"
                                      >
                                        <CameraIcon className="size-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Scan pages</TooltipContent>
                                  </Tooltip>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </LoadingSwap>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}

      {/* Delete exam */}
      <AlertDialog
        open={!!deleteExamConfirm}
        onOpenChange={() => setDeleteExamConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteExamConfirm?.exam_name}"?
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExam}
              disabled={isDeletingExam}
            >
              {isDeletingExam ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete submission */}
      <AlertDialog
        open={!!deleteSubmissionConfirm}
        onOpenChange={(open) => !open && setDeleteSubmissionConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Answer Sheet</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the answer sheet for{" "}
              <span className="font-semibold text-foreground">
                {deleteSubmissionConfirm?.studentName}
              </span>
              ? You can re-upload a new one after.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubmission}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              {deletingSubmissionId ? (
                <CircleNotchIcon className="mr-1.5 size-3.5 animate-spin" />
              ) : null}
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
      <Dialog
        open={drawerOpen}
        onOpenChange={(o) => {
          setDrawerOpen(o)
          if (!o) resetForm()
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>
              {editExam ? "Edit paper" : "New question paper"}
            </DialogTitle>
            <DialogDescription>
              Name it, say what it covers, and set the blueprint. Hint drafts
              the questions from this class's sources to match.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6 overflow-y-auto px-6 pb-6">
            {/* 1 · Name */}
            <section className="flex flex-col gap-2">
              <p className="text-xs font-medium text-secondary-foreground">
                <span className="mr-1.5 text-muted-foreground">1</span>
                Name
              </p>
              <Input
                autoFocus
                placeholder="e.g. Mid-term examination 2026"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                className="h-10"
              />
            </section>

            {/* 2 · Chapters — sourced from the curriculum extracted per
                material (see knowledge.controller.js -> getCurriculum). */}
            <section className="flex flex-col gap-2">
              <p className="text-xs font-medium text-secondary-foreground">
                <span className="mr-1.5 text-muted-foreground">2</span>
                What it covers
              </p>
              <ChapterTopicPicker
                classSubjectId={classSubjectId ?? ""}
                value={chapters}
                onChange={setChapters}
              />
            </section>

            {/* 3 · Blueprint */}
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-medium text-secondary-foreground">
                  <span className="mr-1.5 text-muted-foreground">3</span>
                  Blueprint
                </p>
                <button
                  type="button"
                  onClick={() => setBlueprintModalOpen(true)}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <PlusIcon className="size-3" />
                  New blueprint
                </button>
              </div>

              {savedBlueprints.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setBlueprintModalOpen(true)}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-4 text-left transition-colors hover:border-foreground/25 hover:bg-muted/40"
                >
                  <Sticker name="idea" size={40} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      Create your first blueprint
                    </span>
                    <span className="text-xs text-muted-foreground">
                      A blueprint is the shape of the paper: sections, how many
                      questions in each, and marks per question. Save one and
                      reuse it every term.
                    </span>
                  </span>
                </button>
              ) : (
                <Select
                  value={selectedBlueprintId || undefined}
                  onValueChange={handleBlueprintSelect}
                >
                  <SelectTrigger className="h-10 w-full text-sm">
                    <SelectValue placeholder="Choose a blueprint" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedBlueprints.map((bp) => (
                      <SelectItem key={bp.id} value={bp.id}>
                        {bp.name}
                        <span className="ml-1.5 text-muted-foreground">
                          · {bp.total_marks} marks
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {showBlueprintSections && (
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-sidebar/60 p-3">
                  {/* Section rows */}
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-[3rem_1fr_5rem_5rem_1.75rem] items-end gap-2 px-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                      <span>Sec</span>
                      <span>Type</span>
                      <span>Questions</span>
                      <span>Marks each</span>
                      <span />
                    </div>
                    {blueprint.map((sec, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[3rem_1fr_5rem_5rem_1.75rem] items-center gap-2 rounded-lg border border-border bg-background p-1.5"
                      >
                        <Input
                          value={sec.section}
                          onChange={(e) =>
                            updateBlueprint(idx, "section", e.target.value)
                          }
                          aria-label="Section"
                          className="h-8 text-center text-xs font-semibold"
                        />
                        <Input
                          value={sec.type}
                          placeholder="e.g. MCQ, Short answer"
                          onChange={(e) =>
                            updateBlueprint(idx, "type", e.target.value)
                          }
                          aria-label="Question type"
                          className="h-8 text-xs"
                        />
                        <Input
                          type="number"
                          min={1}
                          value={sec.num_questions}
                          onChange={(e) =>
                            updateBlueprint(
                              idx,
                              "num_questions",
                              Number(e.target.value)
                            )
                          }
                          aria-label="Number of questions"
                          className="h-8 text-xs tabular-nums"
                        />
                        <Input
                          type="number"
                          min={1}
                          value={sec.marks_per_question}
                          onChange={(e) =>
                            updateBlueprint(
                              idx,
                              "marks_per_question",
                              Number(e.target.value)
                            )
                          }
                          aria-label="Marks per question"
                          className="h-8 text-xs tabular-nums"
                        />
                        <button
                          type="button"
                          disabled={blueprint.length <= 1}
                          onClick={() => {
                            setBlueprint((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                            setBlueprintEdited(true)
                          }}
                          aria-label="Remove section"
                          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setBlueprint((prev) => [
                          ...prev,
                          {
                            section: String.fromCharCode(65 + prev.length),
                            type: "",
                            num_questions: 1,
                            marks_per_question: 1,
                          },
                        ])
                        setBlueprintEdited(true)
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
                    >
                      <PlusIcon className="size-3.5" />
                      Add a section
                    </button>
                  </div>

                  {/* Totals + pass mark */}
                  <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
                      <span className="text-xs text-muted-foreground">
                        Total
                      </span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {blueprint.reduce((n, s) => n + s.num_questions, 0)}{" "}
                        <span className="font-normal text-muted-foreground">
                          questions ·
                        </span>{" "}
                        {totalMarks}{" "}
                        <span className="font-normal text-muted-foreground">
                          marks
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2">
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Pass mark
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={totalMarks || undefined}
                        step="0.5"
                        value={passMarks ?? ""}
                        onChange={(e) => {
                          const v = e.target.value
                          setPassMarks(v === "" ? null : Number(v))
                        }}
                        placeholder="optional"
                        aria-label="Pass mark"
                        className="h-7 w-20 text-xs tabular-nums"
                      />
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {passMarks != null && totalMarks > 0
                          ? `${Math.round((passMarks / totalMarks) * 100)}%`
                          : "none"}
                      </span>
                    </div>
                  </div>

                  {blueprintEdited && selectedBlueprintId && (
                    <button
                      type="button"
                      onClick={handleSaveEditedAsBlueprint}
                      className="self-start text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Save these changes as a new blueprint
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>

          <DialogFooter className="flex-row items-center border-t border-border bg-sidebar px-6 py-3 sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {!examName.trim()
                ? "Give the paper a name"
                : !showBlueprintSections
                  ? "Pick a blueprint"
                  : `${blueprint.reduce((n, s) => n + s.num_questions, 0)} questions · ${totalMarks} marks${passMarks != null ? ` · pass ${passMarks}` : ""}`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setDrawerOpen(false)
                  resetForm()
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && (
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                )}
                {editExam ? "Save changes" : "Create paper"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BlueprintModal
        open={blueprintModalOpen}
        onClose={() => setBlueprintModalOpen(false)}
        onSaved={handleBlueprintCreated}
      />

      <CloneFromSectionSheet
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        targetClassSubjectId={classSubjectId ?? null}
        onCloned={(newExamId) => {
          setCloneOpen(false)
          // Refresh the exam list in the background.
          if (classSubjectId) fetchExams(classSubjectId)
          // Auto-open the cloned exam so the teacher lands on its detail.
          // selectExam() relies on the exams array to look up question_count,
          // but the fetch above hasn't landed yet — so mirror its side effects
          // inline and kick fetchQuestions/students directly.
          setSelectedExamId(newExamId)
          setQuestions([])
          setStudents([])
          setSubmissions([])
          setShowAnswers(false)
          fetchQuestions(newExamId)
          if (classSubjectId)
            fetchStudentsAndSubmissions(classSubjectId, newExamId)
        }}
      />
    </>
  )
}

/* ─── Duplicate-to-sections popover ──────────────────────── */

function DuplicateExamPopover({
  sourceExam,
  currentClassSubjectId,
  assignments,
  onDuplicated,
}: {
  sourceExam: Exam | null
  currentClassSubjectId: string | null
  assignments: Assignment[]
  onDuplicated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  // Reset the picked set every time the popover reopens on a new exam.
  useEffect(() => {
    if (open) setPicked(new Set())
  }, [open, sourceExam?.id])

  if (!sourceExam) return null

  // Only offer OTHER class-subjects the teacher owns — same section as
  // source is a duplicate that would silently share a name and nothing else.
  const targets = assignments.filter(
    (a) => a.class_subject_id !== currentClassSubjectId
  )

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleApply = async () => {
    if (picked.size === 0) return
    setBusy(true)
    try {
      type DupResult = {
        message: string
        results: Array<{
          ok: boolean
          target_class_subject_id: string
          new_exam_id?: string
          error?: string
        }>
      }
      const res = await apiClient.post<DupResult>(
        `/api/exams/${sourceExam.id}/duplicate`,
        { target_class_subject_ids: Array.from(picked) }
      )
      const okCount = res.results.filter((r) => r.ok).length
      const failCount = res.results.length - okCount
      if (failCount === 0)
        toast.success(
          `Copied to ${okCount} class-subject${okCount === 1 ? "" : "s"}`
        )
      else toast.warning(`${okCount} copied, ${failCount} failed`)
      onDuplicated()
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <CopyIcon className="mr-1.5 size-3.5" />
          Copy to…
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Copy this exam to</p>
          {targets.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              You&apos;re not assigned to any other classes.
            </p>
          ) : (
            <>
              <div className="flex max-h-64 flex-col overflow-y-auto">
                {targets.map((a) => {
                  const isOn = picked.has(a.class_subject_id)
                  return (
                    <button
                      key={a.class_subject_id}
                      type="button"
                      onClick={() => toggle(a.class_subject_id)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          isOn
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {isOn && <CheckIcon className="size-3" />}
                      </span>
                      <span className="truncate">{classLabel(a)}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Each copy is independent — edits on the copy won&apos;t affect
                this exam.
              </p>
              <div className="mt-1 flex items-center justify-end gap-1 border-t pt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={picked.size === 0 || busy}
                  onClick={handleApply}
                >
                  {busy
                    ? "Copying…"
                    : `Copy${picked.size > 0 ? ` (${picked.size})` : ""}`}
                </Button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ─── Clone-from-another-section sheet ───────────────────── */

interface DiscoverableExam {
  id: string
  exam_name: string
  total_marks: number
  pass_marks: number | null
  chapters_selected: string[]
  question_count: number
  visibility: "public" | "private"
  created_at: string
  is_mine: boolean
  section_label: string | null
  uploader: { id: string; full_name: string; profile_url?: string } | null
}

function CloneFromSectionSheet({
  open,
  onOpenChange,
  targetClassSubjectId,
  onCloned,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  targetClassSubjectId: string | null
  onCloned: (newExamId: string) => void
}) {
  const [exams, setExams] = useState<DiscoverableExam[]>([])
  const [loading, setLoading] = useState(false)
  const [cloningId, setCloningId] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !targetClassSubjectId) return
    let cancelled = false
    setLoading(true)
    apiClient
      .get<{ exams: DiscoverableExam[] }>(
        `/api/exams/discoverable?class_subject_id=${targetClassSubjectId}`
      )
      .then((res) => {
        if (!cancelled) setExams(res.exams ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        toast.error(err instanceof Error ? err.message : "Failed to load exams")
        setExams([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, targetClassSubjectId])

  const handleClone = async (source: DiscoverableExam) => {
    if (!targetClassSubjectId) return
    setCloningId(source.id)
    try {
      type DupResult = {
        results: Array<{ ok: boolean; new_exam_id?: string; error?: string }>
      }
      const res = await apiClient.post<DupResult>(
        `/api/exams/${source.id}/duplicate`,
        { target_class_subject_ids: [targetClassSubjectId] }
      )
      const hit = res.results.find((r) => r.ok && r.new_exam_id)
      if (!hit || !hit.new_exam_id) {
        toast.error(res.results[0]?.error || "Clone failed")
        return
      }
      toast.success("Cloned into this section")
      onCloned(hit.new_exam_id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clone failed")
    } finally {
      setCloningId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="md" className="flex h-full flex-col p-0">
        <SheetHeader className="border-b bg-muted/50 px-4 py-3 sm:px-6 sm:py-4">
          <SheetTitle className="text-base">
            Clone from another section
          </SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-6">
          <p className="text-xs text-muted-foreground">
            Exams in the same grade + subject, from your other sections or from
            other teachers who marked them public. Clones start private and
            editing them won&apos;t affect the original.
          </p>

          <LoadingSwap loading={loading} skeleton={<CloneListSkeleton />}>
            {exams.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <FileTextIcon className="size-10 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">
                  No exams available to clone yet.
                </p>
                <p className="text-xs text-muted-foreground">
                  When you or another teacher creates an exam in another section
                  of this grade + subject, it will show up here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {exams.map((e) => (
                  <div key={e.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium">
                          {e.exam_name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {e.total_marks} marks · {e.question_count} question
                          {e.question_count !== 1 ? "s" : ""}
                          {e.pass_marks != null
                            ? ` · pass ${e.pass_marks}`
                            : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 gap-1 text-xs"
                        onClick={() => handleClone(e)}
                        disabled={cloningId === e.id}
                      >
                        {cloningId === e.id ? (
                          <CircleNotchIcon className="size-3 animate-spin" />
                        ) : (
                          <CopyIcon className="size-3" />
                        )}
                        Clone
                      </Button>
                    </div>

                    {e.chapters_selected.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {e.chapters_selected.slice(0, 4).map((c) => (
                          <span
                            key={c}
                            className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {c}
                          </span>
                        ))}
                        {e.chapters_selected.length > 4 && (
                          <span className="text-[10px] text-muted-foreground/60">
                            +{e.chapters_selected.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>{e.section_label ?? "Class"}</span>
                      <span>·</span>
                      <span className="truncate">
                        {e.is_mine
                          ? "Your section"
                          : `by ${e.uploader?.full_name ?? "another teacher"}`}
                      </span>
                      {!e.is_mine && (
                        <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                          Shared
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </LoadingSwap>
        </div>
      </SheetContent>
    </Sheet>
  )
}
