import { useCallback, useEffect, useState, useRef } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { motion } from "motion/react"
import {
  WarningIcon,
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  ListChecksIcon,
  CameraIcon,
  CaretDownIcon,
  ClipboardTextIcon,
  EyeIcon,
  CircleNotchIcon,
  ArrowsClockwiseIcon,
  HandGrabbingIcon,
  TrashIcon,
  UploadIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { ClassPageHeader } from "@/components/layout/class-page-header"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Sticker } from "@/components/shared/sticker"
import { tameCaps } from "@/lib/format"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { ScanPagesModal } from "../components/scan-pages-modal"
import { ExamCardsGrid } from "../components/exam-cards-grid"
import { scoreTone } from "../lib/score"

function compressForUpload(file: File): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.type === "application/pdf") {
      resolve(file)
      return
    }
    if (file.size <= 5 * 1024 * 1024) {
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
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(
              new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                type: "image/jpeg",
              })
            )
          } else {
            resolve(file)
          }
        },
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

interface Exam {
  id: string
  exam_name: string
  total_marks: number
  question_count: number
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
  pdf_url: string
  status: string
  total_ai_marks: number | null
  total_final_marks: number | null
  uploaded_at: string
}

type SheetState = "graded" | "grading" | "failed" | "none"

function sheetState(sub: Submission | undefined): SheetState {
  if (!sub) return "none"
  if (sub.status === "graded") return "graded"
  if (sub.status === "failed") return "failed"
  return "grading"
}

const STATE_CELL: Record<SheetState, string> = {
  graded: "bg-primary",
  grading: "bg-violet-400",
  failed: "bg-destructive",
  none: "border border-border bg-muted",
}

const STATE_LABEL: Record<SheetState, string> = {
  graded: "Graded",
  grading: "Grading",
  failed: "Failed",
  none: "No sheet",
}

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp"]

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const ENTER = {
  hidden: { opacity: 0, y: 6 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i, 12) * 0.03, duration: 0.25 },
  }),
}

/**
 * The paper view while students and submissions load: the progress card
 * (headline count, one cell per student, legend) and the roll-ordered rows
 * beneath it, at the same heights as the real thing.
 */
function SheetListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-background px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-8 w-10" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="grid auto-cols-fr grid-flow-col gap-1">
          {Array.from({ length: 24 }).map((_, i) => (
            <Skeleton key={i} className="h-2.5 rounded-sm" />
          ))}
        </div>
        <div className="flex items-center gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-2.5 w-14" />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="hidden h-3 w-64 sm:block" />
        </div>
        <div className="-mx-3 flex flex-col">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="relative flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-border last:after:hidden"
            >
              <Skeleton className="h-3 w-6 shrink-0" />
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="hidden w-44 shrink-0 justify-end sm:flex">
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="size-7 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function GradingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { classSubjectId } = useParams<{ classSubjectId: string }>()

  const [exams, setExams] = useState<Exam[]>([])
  const [isLoadingExams, setIsLoadingExams] = useState(false)
  const [searchParams] = useSearchParams()
  const [selectedExamId, setSelectedExamId] = useState(
    () => searchParams.get("exam") ?? ""
  )

  const [students, setStudents] = useState<Student[]>([])
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)

  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false)

  const [uploadingSet, setUploadingSet] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    submissionId: string
    studentName: string
  } | null>(null)
  const [scanModal, setScanModal] = useState<{
    studentId: string
    studentName: string
  } | null>(null)

  const fetchExams = useCallback(async (csId: string) => {
    setIsLoadingExams(true)
    setSelectedExamId("")
    setStudents([])
    setSubmissions([])
    try {
      const res = await apiClient.get<{ exams: Exam[] }>(
        `/api/exams/class-subject/${csId}`
      )
      const onlyWithQuestions = (res.exams ?? []).filter(
        (e) => e.question_count > 0
      )
      setExams(onlyWithQuestions)
    } catch {
      setExams([])
    } finally {
      setIsLoadingExams(false)
    }
  }, [])

  const fetchStudentsAndSubmissions = useCallback(
    async (csId: string, examId: string) => {
      setIsLoadingStudents(true)
      setIsLoadingSubmissions(true)
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
      } catch (err) {
        console.error("Failed to fetch students/submissions:", err)
      } finally {
        setIsLoadingStudents(false)
        setIsLoadingSubmissions(false)
      }
    },
    []
  )

  useEffect(() => {
    if (classSubjectId) fetchExams(classSubjectId)
  }, [classSubjectId, fetchExams])

  useEffect(() => {
    if (classSubjectId && selectedExamId) {
      fetchStudentsAndSubmissions(classSubjectId, selectedExamId)
    }
  }, [classSubjectId, selectedExamId, fetchStudentsAndSubmissions])

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

          const stillPending = (res.submissions ?? []).some(
            (s) => s.status === "uploaded" || s.status === "processing"
          )
          if (!stillPending && pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
        } catch {
          /* ignore poll errors */
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

  const getSubmissionForStudent = (studentId: string) =>
    submissions.find((s) => s.student_id === studentId)

  const uploadSheet = async (studentId: string, rawFile: File) => {
    if (!selectedExamId) return
    if (!ACCEPTED.includes(rawFile.type)) {
      toast.error("Use a PDF or a JPG, PNG or WebP photo")
      return
    }

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
      fetchStudentsAndSubmissions(classSubjectId ?? "", selectedExamId)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to upload answer sheet")
    } finally {
      setUploadingSet((prev) => {
        const next = new Set(prev)
        next.delete(studentId)
        return next
      })
    }
  }

  const handleUploadClick = (studentId: string) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ACCEPTED.join(",")
    input.onchange = () => {
      const rawFile = input.files?.[0]
      if (rawFile) void uploadSheet(studentId, rawFile)
    }
    input.click()
  }

  /** Which row a dragged file is hovering — rows light up as drop targets. */
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const handleDeleteSubmission = async () => {
    if (!deleteConfirm) return
    setDeletingId(deleteConfirm.submissionId)
    try {
      await apiClient.delete(
        `/api/grading/submission/${deleteConfirm.submissionId}`
      )
      toast.success("Answer sheet removed")
      fetchStudentsAndSubmissions(classSubjectId ?? "", selectedExamId)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete submission")
    } finally {
      setDeletingId(null)
      setDeleteConfirm(null)
    }
  }

  const handleScanUpload = async (pdfFile: File) => {
    if (!scanModal || !selectedExamId) return
    const studentId = scanModal.studentId
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
      fetchStudentsAndSubmissions(classSubjectId ?? "", selectedExamId)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to upload answer sheet")
    } finally {
      setUploadingSet((prev) => {
        const next = new Set(prev)
        next.delete(studentId)
        return next
      })
    }
  }

  const selectedExam = exams.find((e) => e.id === selectedExamId)
  const isLoadingList = isLoadingStudents || isLoadingSubmissions

  const sortedStudents = [...students].sort(
    (a, b) => a.roll_number - b.roll_number
  )
  const gradedSubs = submissions.filter((s) => s.status === "graded")
  const gradedCount = gradedSubs.length
  const uploadedCount = submissions.length
  const withoutSheet = students.length - uploadedCount
  const gradedMarks = gradedSubs
    .map((s) => s.total_final_marks)
    .filter((m): m is number => typeof m === "number")
  const average =
    gradedMarks.length > 0
      ? gradedMarks.reduce((a, b) => a + b, 0) / gradedMarks.length
      : null

  if (!user) return null

  if (!classSubjectId) {
    return (
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-4">
        <ClipboardTextIcon className="size-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">Select a class from the sidebar</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex min-h-full flex-col gap-5 pb-12"
      )}
    >
      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this answer sheet?</AlertDialogTitle>
            <AlertDialogDescription>
              The sheet uploaded for{" "}
              <span className="font-semibold text-foreground">
                {deleteConfirm?.studentName}
              </span>{" "}
              and any marks on it will be removed. You can upload a new one
              afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubmission}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              {deletingId ? (
                <CircleNotchIcon className="mr-1.5 size-3.5 animate-spin" />
              ) : null}
              Remove sheet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Scan pages modal */}
      <ScanPagesModal
        open={!!scanModal}
        studentName={scanModal?.studentName ?? ""}
        onClose={() => setScanModal(null)}
        onSubmit={handleScanUpload}
      />

      {/* Header — page title on the cards view; once a paper is picked, the
          same two-tier shape as every class page: a breadcrumb back to all
          papers, then the paper name as a switcher with its facts beneath. */}
      {!selectedExamId ? (
        <ClassPageHeader
          icon={ListChecksIcon}
          title="Grading"
          description="Upload each student's answer sheet. Hint grades it; you review anything it flags."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSelectedExamId("")}
              aria-label="Back to all papers"
              className="-ml-1.5 rounded-full text-muted-foreground"
            >
              <ArrowLeftIcon className="size-4" />
            </Button>
            <button
              type="button"
              onClick={() => setSelectedExamId("")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-secondary-foreground transition-colors hover:bg-muted"
            >
              <ListChecksIcon className="size-3.5 text-muted-foreground" />
              Grading
              <span className="text-muted-foreground">· all papers</span>
            </button>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <Select
                value={selectedExamId}
                onValueChange={setSelectedExamId}
                disabled={isLoadingExams || exams.length === 0}
              >
                <SelectTrigger
                  aria-label="Switch paper"
                  className="-ml-2 h-10 w-auto gap-2 rounded-lg border-transparent bg-transparent px-2 text-2xl font-semibold tracking-tight text-foreground shadow-none hover:bg-muted data-[state=open]:bg-muted [&>svg:last-child]:hidden"
                >
                  <SelectValue
                    placeholder={
                      isLoadingExams
                        ? "Loading papers…"
                        : exams.length === 0
                          ? "No papers yet"
                          : "Choose a paper"
                    }
                  >
                    {selectedExam ? tameCaps(selectedExam.exam_name) : null}
                  </SelectValue>
                  <CaretDownIcon className="size-4 text-muted-foreground" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  sideOffset={6}
                  className="min-w-64"
                >
                  {exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {tameCaps(exam.exam_name)}
                      <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                        {exam.total_marks} marks
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedExam && (
                <p className="text-sm text-muted-foreground tabular-nums">
                  {selectedExam.question_count}{" "}
                  {selectedExam.question_count === 1 ? "question" : "questions"}
                  <span className="mx-1.5 text-border">·</span>
                  {selectedExam.total_marks} marks
                  {students.length > 0 && (
                    <>
                      <span className="mx-1.5 text-border">·</span>
                      {students.length}{" "}
                      {students.length === 1 ? "student" : "students"}
                    </>
                  )}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() =>
                navigate(
                  `/class/${classSubjectId}/exams/${selectedExamId}/questions`
                )
              }
            >
              <ArrowSquareOutIcon className="size-4" />
              Open paper
            </Button>
          </div>
        </div>
      )}

      {!selectedExamId ? (
        <ExamCardsGrid
          classSubjectId={classSubjectId ?? ""}
          onSelectExam={(examId) => setSelectedExamId(examId)}
        />
      ) : (
        <LoadingSwap
          loading={isLoadingList}
          skeleton={<SheetListSkeleton />}
          className="flex-1"
        >
          <div className="flex flex-1 flex-col gap-5">
            {students.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
                <Sticker name="friends" size={160} />
                <div className="flex max-w-[360px] flex-col items-center gap-1 text-center">
                  <p className="text-base font-medium text-secondary-foreground">
                    No students in this class yet
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Enrol students into this section and their answer sheets can
                    be uploaded here.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Progress — the headline count, one cell per student coloured by
              where their sheet is, and the class average once marks exist. */}
                <motion.div
                  variants={ENTER}
                  custom={0}
                  initial="hidden"
                  animate="show"
                  className="flex flex-col gap-3 rounded-xl border border-border bg-background px-5 py-4"
                >
                  <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                        {gradedCount}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        of {students.length} graded
                      </span>
                      {uploadedCount - gradedCount > 0 && (
                        <span className="text-sm text-muted-foreground">
                          <span className="mx-1 text-border">·</span>
                          {uploadedCount - gradedCount} in progress
                        </span>
                      )}
                      {withoutSheet > 0 && (
                        <span className="text-sm text-muted-foreground">
                          <span className="mx-1 text-border">·</span>
                          {withoutSheet} without a sheet
                        </span>
                      )}
                    </div>
                    {average !== null && selectedExam && (
                      <div className="flex items-baseline gap-1.5 text-sm">
                        <span className="text-muted-foreground">
                          Class average
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {average.toFixed(average % 1 === 0 ? 0 : 1)}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          / {selectedExam.total_marks}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="grid auto-cols-fr grid-flow-col gap-1">
                    {sortedStudents.map((st) => {
                      const state = sheetState(getSubmissionForStudent(st.id))
                      return (
                        <Tooltip key={st.id}>
                          <TooltipTrigger asChild>
                            <span
                              className={cn(
                                "h-2.5 rounded-sm transition-colors",
                                STATE_CELL[state]
                              )}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            {st.roll_number}. {st.full_name} ·{" "}
                            {STATE_LABEL[state]}
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {(
                      ["graded", "grading", "failed", "none"] as SheetState[]
                    ).map((state) => (
                      <span key={state} className="flex items-center gap-1.5">
                        <span
                          className={cn("size-2 rounded-sm", STATE_CELL[state])}
                        />
                        {STATE_LABEL[state]}
                      </span>
                    ))}
                  </div>
                </motion.div>

                {/* Students — one line each. Rows without a sheet are drop targets,
              so a photo or PDF can be dragged straight onto the student. */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between px-3 text-xs text-muted-foreground">
                    <span>Sorted by roll number</span>
                    {withoutSheet > 0 && (
                      <span className="hidden items-center gap-1.5 sm:flex">
                        <HandGrabbingIcon className="size-3.5" />
                        Drag a photo or PDF onto a student to upload their sheet
                      </span>
                    )}
                  </div>

                  <div className="-mx-3 flex flex-col">
                    {sortedStudents.map((student, i) => {
                      const submission = getSubmissionForStudent(student.id)
                      const state = sheetState(submission)
                      const isUploading = uploadingSet.has(student.id)
                      const canDrop =
                        !isUploading && (state === "none" || state === "failed")
                      const isDropTarget = dropTarget === student.id

                      return (
                        <motion.div
                          key={student.id}
                          variants={ENTER}
                          custom={i + 1}
                          initial="hidden"
                          animate="show"
                          onDragEnter={(e) => {
                            if (!canDrop) return
                            e.preventDefault()
                            setDropTarget(student.id)
                          }}
                          onDragOver={(e) => {
                            if (!canDrop) return
                            e.preventDefault()
                            e.dataTransfer.dropEffect = "copy"
                          }}
                          onDragLeave={(e) => {
                            if (
                              e.relatedTarget instanceof Node &&
                              e.currentTarget.contains(e.relatedTarget)
                            )
                              return
                            setDropTarget((cur) =>
                              cur === student.id ? null : cur
                            )
                          }}
                          onDrop={(e) => {
                            if (!canDrop) return
                            e.preventDefault()
                            setDropTarget(null)
                            const file = e.dataTransfer.files?.[0]
                            if (file) void uploadSheet(student.id, file)
                          }}
                          className={cn(
                            "group relative flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-border last:after:hidden hover:bg-muted/50",
                            isDropTarget &&
                              "bg-primary/5 ring-1 ring-primary/40 ring-inset after:hidden hover:bg-primary/5"
                          )}
                        >
                          <span className="w-6 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                            {student.roll_number}
                          </span>
                          <Avatar className="size-8">
                            <AvatarFallback className="text-[10px]">
                              {initialsOf(student.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <p className="truncate text-sm font-medium text-foreground">
                              {student.full_name}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {student.register_number ?? "No register number"}
                            </p>
                          </div>

                          {/* Status — quiet when there is nothing to say yet */}
                          <div className="hidden w-44 shrink-0 items-center justify-end sm:flex">
                            {isDropTarget ? (
                              <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                                <UploadIcon className="size-3.5" />
                                Drop to upload
                              </span>
                            ) : isUploading ? (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <CircleNotchIcon className="size-3.5 animate-spin" />
                                Uploading…
                              </span>
                            ) : state === "graded" &&
                              submission &&
                              selectedExam ? (
                              <span className="flex items-center gap-2 text-sm">
                                <span className="font-semibold text-foreground tabular-nums">
                                  {submission.total_final_marks}
                                </span>
                                <span className="text-muted-foreground tabular-nums">
                                  / {selectedExam.total_marks}
                                </span>
                                <span
                                  className={cn(
                                    "rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                                    scoreTone(
                                      submission.total_final_marks ?? 0,
                                      selectedExam.total_marks
                                    )
                                  )}
                                >
                                  {Math.round(
                                    ((submission.total_final_marks ?? 0) /
                                      selectedExam.total_marks) *
                                      100
                                  )}
                                  %
                                </span>
                              </span>
                            ) : state === "grading" && submission ? (
                              <span className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400">
                                <CircleNotchIcon className="size-3.5 animate-spin" />
                                {submission.status === "processing"
                                  ? "Hint is grading…"
                                  : "Uploaded, in queue"}
                              </span>
                            ) : state === "failed" ? (
                              <span className="flex items-center gap-1.5 text-xs text-destructive">
                                <WarningIcon
                                  weight="fill"
                                  className="size-3.5"
                                />
                                Grading failed
                              </span>
                            ) : null}
                          </div>

                          {/* Actions */}
                          <div className="flex w-52 shrink-0 items-center justify-end gap-1">
                            {state === "graded" && submission ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() =>
                                  navigate(
                                    `/class/${classSubjectId}/grading/${submission.id}/review`
                                  )
                                }
                              >
                                <EyeIcon className="size-3.5" />
                                Review
                              </Button>
                            ) : state === "grading" && submission ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  setDeleteConfirm({
                                    submissionId: submission.id,
                                    studentName: student.full_name,
                                  })
                                }
                              >
                                <TrashIcon className="size-3.5" />
                                Remove
                              </Button>
                            ) : state === "failed" && submission ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  disabled={isUploading}
                                  onClick={() => handleUploadClick(student.id)}
                                >
                                  <ArrowsClockwiseIcon className="size-3.5" />
                                  Re-upload
                                </Button>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon-sm"
                                      variant="ghost"
                                      aria-label="Scan pages"
                                      className="text-muted-foreground"
                                      onClick={() =>
                                        setScanModal({
                                          studentId: student.id,
                                          studentName: student.full_name,
                                        })
                                      }
                                    >
                                      <CameraIcon className="size-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Scan pages</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon-sm"
                                      variant="ghost"
                                      aria-label="Remove sheet"
                                      className="text-muted-foreground hover:text-destructive"
                                      onClick={() =>
                                        setDeleteConfirm({
                                          submissionId: submission.id,
                                          studentName: student.full_name,
                                        })
                                      }
                                    >
                                      <TrashIcon className="size-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remove sheet</TooltipContent>
                                </Tooltip>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-secondary-foreground"
                                  disabled={isUploading}
                                  onClick={() => handleUploadClick(student.id)}
                                >
                                  {isUploading ? (
                                    <CircleNotchIcon className="size-3.5 animate-spin" />
                                  ) : (
                                    <UploadIcon className="size-3.5" />
                                  )}
                                  Upload sheet
                                </Button>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon-sm"
                                      variant="ghost"
                                      aria-label="Scan pages with camera"
                                      className="text-muted-foreground"
                                      disabled={isUploading}
                                      onClick={() =>
                                        setScanModal({
                                          studentId: student.id,
                                          studentName: student.full_name,
                                        })
                                      }
                                    >
                                      <CameraIcon className="size-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Scan pages with camera
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </LoadingSwap>
      )}
    </div>
  )
}
