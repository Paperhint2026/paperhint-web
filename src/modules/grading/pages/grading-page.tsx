import { useCallback, useEffect, useState, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  EyeIcon,
  Loader2Icon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
  UserIcon,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
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
      const scale = Math.max(img.width, img.height) > maxDim
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
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }))
          } else {
            resolve(file)
          }
        },
        "image/jpeg",
        0.92,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })
}

interface Assignment {
  class_subject_id: string
  class: { id: string; grade: number; section: string } | null
  subject: { id: string; subject_name: string } | null
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

export function GradingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [activeTab, _setActiveTab] = useState("")
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true)

  const [exams, setExams] = useState<Exam[]>([])
  const [isLoadingExams, setIsLoadingExams] = useState(false)
  const [selectedExamId, setSelectedExamId] = useState("")

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

  const initialParamsRef = useRef({
    class: searchParams.get("class"),
    exam: searchParams.get("exam"),
  })

  const setActiveTab = useCallback(
    (classSubjectId: string, list?: Assignment[], isRestore = false) => {
      _setActiveTab(classSubjectId)
      const items = list ?? assignments
      const match = items.find((a) => a.class_subject_id === classSubjectId)
      if (match?.class && match?.subject) {
        const label = `${match.class.grade}${match.class.section}-${match.subject.subject_name}`.replace(/\s+/g, "-")
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.set("class", label)
          if (!isRestore) next.delete("exam")
          return next
        }, { replace: true })
      }
    },
    [assignments, setSearchParams],
  )

  const updateExamParam = useCallback(
    (examId: string) => {
      setSelectedExamId(examId)
      if (examId) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.set("exam", examId)
          return next
        }, { replace: true })
      }
    },
    [setSearchParams],
  )

  const fetchAssignments = useCallback(async () => {
    if (!user) return
    setIsLoadingAssignments(true)
    try {
      const res = await apiClient.get<{ teacher: { assignments: Assignment[] } }>(
        `/api/auth/teacher/${user.id}/overview`,
      )
      const a = res.teacher.assignments ?? []
      setAssignments(a)
      if (a.length > 0) {
        const classParam = initialParamsRef.current.class
        let restored = false
        if (classParam) {
          const match = a.find((asn) => {
            if (!asn.class || !asn.subject) return false
            const label = `${asn.class.grade}${asn.class.section}-${asn.subject.subject_name}`.replace(/\s+/g, "-")
            return label === classParam
          })
          if (match) {
            setActiveTab(match.class_subject_id, a, true)
            restored = true
          }
        }
        if (!restored) setActiveTab(a[0].class_subject_id, a)
      }
    } catch (err) {
      console.error("Failed to fetch assignments:", err)
    } finally {
      setIsLoadingAssignments(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const fetchExams = useCallback(async (classSubjectId: string) => {
    setIsLoadingExams(true)
    setSelectedExamId("")
    setStudents([])
    setSubmissions([])
    try {
      const res = await apiClient.get<{ exams: Exam[] }>(
        `/api/exams/class-subject/${classSubjectId}`,
      )
      const onlyWithQuestions = (res.exams ?? []).filter((e) => e.question_count > 0)
      setExams(onlyWithQuestions)

      const savedExam = initialParamsRef.current.exam
      if (savedExam && onlyWithQuestions.some((e) => e.id === savedExam)) {
        setSelectedExamId(savedExam)
        initialParamsRef.current.exam = null
      }
    } catch {
      setExams([])
    } finally {
      setIsLoadingExams(false)
    }
  }, [])

  const fetchStudentsAndSubmissions = useCallback(async (classSubjectId: string, examId: string) => {
    const assignment = assignments.find((a) => a.class_subject_id === classSubjectId)
    if (!assignment?.class) return

    setIsLoadingStudents(true)
    setIsLoadingSubmissions(true)
    try {
      const [studentsRes, submissionsRes] = await Promise.all([
        apiClient.get<{ students: Student[] }>(`/api/students/class/${assignment.class.id}`),
        apiClient.get<{ submissions: Submission[] }>(`/api/grading/submissions/${examId}`),
      ])
      setStudents(studentsRes.students ?? [])
      setSubmissions(submissionsRes.submissions ?? [])
    } catch (err) {
      console.error("Failed to fetch students/submissions:", err)
    } finally {
      setIsLoadingStudents(false)
      setIsLoadingSubmissions(false)
    }
  }, [assignments])

  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])

  useEffect(() => {
    if (activeTab) fetchExams(activeTab)
  }, [activeTab, fetchExams])

  useEffect(() => {
    if (activeTab && selectedExamId) {
      fetchStudentsAndSubmissions(activeTab, selectedExamId)
    }
  }, [activeTab, selectedExamId, fetchStudentsAndSubmissions])

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)

    const hasPending = submissions.some(
      (s) => s.status === "uploaded" || s.status === "processing",
    )

    if (hasPending && activeTab && selectedExamId) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await apiClient.get<{ submissions: Submission[] }>(
            `/api/grading/submissions/${selectedExamId}`,
          )
          setSubmissions(res.submissions ?? [])

          const stillPending = (res.submissions ?? []).some(
            (s) => s.status === "uploaded" || s.status === "processing",
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
  }, [submissions, activeTab, selectedExamId])

  const getSubmissionForStudent = (studentId: string) =>
    submissions.find((s) => s.student_id === studentId)

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
        fetchStudentsAndSubmissions(activeTab, selectedExamId)
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
    input.click()
  }

  const handleDeleteSubmission = async () => {
    if (!deleteConfirm) return
    setDeletingId(deleteConfirm.submissionId)
    try {
      await apiClient.delete(`/api/grading/submission/${deleteConfirm.submissionId}`)
      toast.success("Answer sheet removed")
      fetchStudentsAndSubmissions(activeTab, selectedExamId)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete submission")
    } finally {
      setDeletingId(null)
      setDeleteConfirm(null)
    }
  }

  const selectedExam = exams.find((e) => e.id === selectedExamId)
  const isLoadingList = isLoadingStudents || isLoadingSubmissions

  const gradedCount = submissions.filter((s) => s.status === "graded").length
  const uploadedCount = submissions.length

  if (!user) return null

  if (isLoadingAssignments) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <ClipboardCheckIcon className="size-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">No class assignments found</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Answer Sheet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the uploaded answer sheet for{" "}
              <span className="font-semibold text-foreground">{deleteConfirm?.studentName}</span>?
              This will remove the file and you can re-upload a new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubmission}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? <Loader2Icon className="mr-1.5 size-3.5 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Class tabs */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none md:gap-3">
        {assignments.map((a) => (
          <button
            key={a.class_subject_id}
            onClick={() => setActiveTab(a.class_subject_id)}
            className={cn(
              "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === a.class_subject_id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            Grade {a.class?.grade} – {a.class?.section} · {a.subject?.subject_name}
          </button>
        ))}
      </div>

      {/* Exam selector + summary */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Select
            value={selectedExamId}
            onValueChange={updateExamParam}
            disabled={isLoadingExams || exams.length === 0}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder={isLoadingExams ? "Loading exams..." : exams.length === 0 ? "No exams available" : "Select an exam"} />
            </SelectTrigger>
            <SelectContent>
              {exams.map((exam) => (
                <SelectItem key={exam.id} value={exam.id}>
                  {exam.exam_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedExam && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {selectedExam.total_marks} marks · {selectedExam.question_count} questions
            </span>
          )}
        </div>

        {selectedExamId && !isLoadingList && students.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{uploadedCount}/{students.length} uploaded</span>
            <span className="text-emerald-600 dark:text-emerald-400">{gradedCount} graded</span>
          </div>
        )}
      </div>

      {/* Student list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!selectedExamId ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3">
            <ClipboardCheckIcon className="size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Select an exam to view students</p>
          </div>
        ) : isLoadingList ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : students.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3">
            <UserIcon className="size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No students in this class</p>
          </div>
        ) : (
          <div className="space-y-2">
            {students
              .sort((a, b) => a.roll_number - b.roll_number)
              .map((student) => {
                const submission = getSubmissionForStudent(student.id)
                const isGraded = submission?.status === "graded"
                const isProcessing = submission?.status === "uploaded" || submission?.status === "processing"
                const isFailed = submission?.status === "failed"
                const isUploading = uploadingSet.has(student.id)

                return (
                  <div
                    key={student.id}
                    className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                  >
                    {/* Student info */}
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                        {student.roll_number}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{student.full_name}</p>
                        {student.register_number && (
                          <p className="text-xs text-muted-foreground">
                            Reg: {student.register_number}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right side: status + actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {submission && isGraded ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <CheckCircle2Icon className="size-3" />
                            Graded
                          </span>

                          {selectedExam && (
                            <span className="rounded-lg bg-muted px-3 py-1 text-xs font-bold">
                              {submission.total_final_marks}/{selectedExam.total_marks}
                            </span>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() =>
                              navigate(
                                `/grading/${submission.id}/review?${searchParams.toString()}`,
                              )
                            }
                          >
                            <EyeIcon className="mr-1 size-3.5" />
                            View Details
                          </Button>
                        </>
                      ) : submission && isProcessing ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <Loader2Icon className="size-3 animate-spin" />
                            {submission.status === "processing" ? "AI Grading..." : "Uploaded"}
                          </span>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              setDeleteConfirm({
                                submissionId: submission.id,
                                studentName: student.full_name,
                              })
                            }
                          >
                            <Trash2Icon className="mr-1 size-3.5" />
                            Remove
                          </Button>
                        </>
                      ) : submission && isFailed ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <AlertTriangleIcon className="size-3" />
                            Failed
                          </span>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              setDeleteConfirm({
                                submissionId: submission.id,
                                studentName: student.full_name,
                              })
                            }
                          >
                            <Trash2Icon className="mr-1 size-3.5" />
                            Remove
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => handleUploadClick(student.id)}
                          >
                            <RefreshCwIcon className="mr-1 size-3.5" />
                            Re-upload
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUploading}
                          onClick={() => handleUploadClick(student.id)}
                        >
                          {isUploading ? (
                            <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                          ) : (
                            <UploadIcon className="mr-1.5 size-3.5" />
                          )}
                          {isUploading ? "Uploading..." : "Upload Answer Sheet"}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
