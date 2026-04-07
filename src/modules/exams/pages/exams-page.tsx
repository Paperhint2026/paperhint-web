import { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  CalendarIcon,
  ClipboardListIcon,
  EditIcon,
  FileTextIcon,
  Loader2Icon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import dayjs from "dayjs"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
} from "@/components/ui/drawer"
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

interface Assignment {
  class_subject_id: string
  class: { id: string; grade: number; section: string } | null
  subject: { id: string; subject_name: string } | null
}

interface TeacherOverview {
  assignments: Assignment[]
}

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

const DEFAULT_BLUEPRINT: BlueprintSection[] = [
  { section: "A", type: "MCQ", num_questions: 10, marks_per_question: 1 },
  { section: "B", type: "Short Answer (2 marks)", num_questions: 5, marks_per_question: 2 },
  { section: "C", type: "Short Answer (3 marks)", num_questions: 6, marks_per_question: 3 },
  { section: "D", type: "Long Answer (5 marks)", num_questions: 4, marks_per_question: 5 },
  { section: "E", type: "Case Study / Long Answer (5 marks)", num_questions: 3, marks_per_question: 5 },
]

export function ExamsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [activeTab, _setActiveTab] = useState("")
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true)

  const [exams, setExams] = useState<Exam[]>([])
  const [isLoadingExams, setIsLoadingExams] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editExam, setEditExam] = useState<Exam | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [examName, setExamName] = useState("")
  const [chapters, setChapters] = useState<string[]>([])
  const [chapterInput, setChapterInput] = useState("")
  const [blueprint, setBlueprint] = useState<BlueprintSection[]>(DEFAULT_BLUEPRINT)
  const [totalMarks, setTotalMarks] = useState(0)

  // Saved blueprints
  const [savedBlueprints, setSavedBlueprints] = useState<Blueprint[]>([])
  const [selectedBlueprintId, setSelectedBlueprintId] = useState("")
  const [blueprintModalOpen, setBlueprintModalOpen] = useState(false)
  const [blueprintEdited, setBlueprintEdited] = useState(false)
  const [showBlueprintSections, setShowBlueprintSections] = useState(false)

  // Chapter suggestions from materials tags
  const [chapterSuggestions, setChapterSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Delete confirmation
  const [deleteExam, setDeleteExam] = useState<Exam | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const setActiveTab = useCallback(
    (classSubjectId: string, list?: Assignment[]) => {
      _setActiveTab(classSubjectId)
      const items = list ?? assignments
      const match = items.find((a) => a.class_subject_id === classSubjectId)
      if (match?.class && match?.subject) {
        const label = `${match.class.grade}${match.class.section}-${match.subject.subject_name}`.replace(/\s+/g, "-")
        setSearchParams({ class: label }, { replace: true })
      }
    },
    [assignments, setSearchParams],
  )

  useEffect(() => {
    const calcMarks = blueprint.reduce((sum, s) => sum + s.num_questions * s.marks_per_question, 0)
    setTotalMarks(calcMarks)
  }, [blueprint])

  const fetchAssignments = useCallback(async () => {
    if (!user) return
    setIsLoadingAssignments(true)
    try {
      const res = await apiClient.get<{ teacher: TeacherOverview }>(
        `/api/auth/teacher/${user.id}/overview`,
      )
      const a = res.teacher.assignments ?? []
      setAssignments(a)

      if (a.length > 0) {
        const classParam = searchParams.get("class")
        let restored = false
        if (classParam) {
          const match = a.find((asn) => {
            if (!asn.class || !asn.subject) return false
            const label = `${asn.class.grade}${asn.class.section}-${asn.subject.subject_name}`.replace(/\s+/g, "-")
            return label === classParam
          })
          if (match) {
            setActiveTab(match.class_subject_id, a)
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
    try {
      const res = await apiClient.get<{ exams: Exam[] }>(
        `/api/exams/class-subject/${classSubjectId}`,
      )
      setExams(res.exams ?? [])
    } catch (err) {
      console.error("Failed to fetch exams:", err)
      setExams([])
    } finally {
      setIsLoadingExams(false)
    }
  }, [])

  const fetchChapterSuggestions = useCallback(async (classSubjectId: string) => {
    try {
      const res = await apiClient.get<{ materials: { tags: string[] }[] }>(
        `/api/knowledge/materials/${classSubjectId}`,
      )
      const allTags = Array.from(new Set((res.materials ?? []).flatMap((m) => m.tags ?? [])))
      setChapterSuggestions(allTags)
    } catch {
      setChapterSuggestions([])
    }
  }, [])

  const fetchBlueprints = useCallback(async () => {
    try {
      const res = await apiClient.get<{ blueprints: Blueprint[] }>("/api/blueprints")
      setSavedBlueprints(res.blueprints ?? [])
    } catch {
      setSavedBlueprints([])
    }
  }, [])

  useEffect(() => {
    fetchAssignments()
    fetchBlueprints()
  }, [fetchAssignments, fetchBlueprints])

  useEffect(() => {
    if (activeTab) {
      fetchExams(activeTab)
      fetchChapterSuggestions(activeTab)
    }
  }, [activeTab, fetchExams, fetchChapterSuggestions])

  const resetForm = () => {
    setExamName("")
    setChapters([])
    setChapterInput("")
    setBlueprint(DEFAULT_BLUEPRINT)
    setSelectedBlueprintId("")
    setBlueprintEdited(false)
    setShowBlueprintSections(false)
    setEditExam(null)
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
    setShowBlueprintSections(exam.blueprint && exam.blueprint.length > 0)
    setBlueprintEdited(false)
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!examName.trim()) return toast.error("Exam name is required")
    if (chapters.length === 0) return toast.error("Select at least one chapter")
    if (!showBlueprintSections || blueprint.length === 0) return toast.error("Select or create a blueprint")

    setIsSaving(true)
    try {
      if (editExam) {
        await apiClient.put(`/api/exams/${editExam.id}`, {
          exam_name: examName.trim(),
          chapters_selected: chapters,
          blueprint,
          total_marks: totalMarks,
        })
        toast.success("Exam updated successfully")
      } else {
        await apiClient.post("/api/exams/create", {
          class_subject_id: activeTab,
          exam_name: examName.trim(),
          chapters_selected: chapters,
          blueprint,
          total_marks: totalMarks,
        })
        toast.success("Exam created successfully")
      }
      setDrawerOpen(false)
      resetForm()
      fetchExams(activeTab)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to save exam")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteExam) return
    setIsDeleting(true)
    try {
      await apiClient.delete(`/api/exams/${deleteExam.id}`)
      toast.success("Exam deleted successfully")
      setDeleteExam(null)
      fetchExams(activeTab)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete exam")
    } finally {
      setIsDeleting(false)
    }
  }

  const addChapter = (ch: string) => {
    const trimmed = ch.trim()
    if (trimmed && !chapters.includes(trimmed)) {
      setChapters([...chapters, trimmed])
    }
    setChapterInput("")
    setShowSuggestions(false)
  }

  const removeChapter = (ch: string) => {
    setChapters(chapters.filter((c) => c !== ch))
  }

  const updateBlueprint = (idx: number, field: keyof BlueprintSection, value: string | number) => {
    setBlueprint((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    )
    setBlueprintEdited(true)
  }

  const addBlueprintSection = () => {
    setBlueprint((prev) => [
      ...prev,
      { section: String.fromCharCode(65 + prev.length), type: "", num_questions: 1, marks_per_question: 1 },
    ])
    setBlueprintEdited(true)
  }

  const removeBlueprintSection = (idx: number) => {
    setBlueprint((prev) => prev.filter((_, i) => i !== idx))
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
    const sourceName = savedBlueprints.find((bp) => bp.id === selectedBlueprintId)?.name
    const newName = sourceName ? `${sourceName} (edited)` : "Untitled Blueprint"
    try {
      const res = await apiClient.post<{ blueprint: Blueprint }>("/api/blueprints", {
        name: newName,
        sections: blueprint,
      })
      toast.success("Saved as new blueprint")
      setSavedBlueprints((prev) => [res.blueprint, ...prev])
      setSelectedBlueprintId(res.blueprint.id)
      setBlueprintEdited(false)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to save blueprint")
    }
  }

  const filteredSuggestions = chapterSuggestions.filter(
    (s) =>
      s.toLowerCase().includes(chapterInput.toLowerCase()) &&
      !chapters.includes(s),
  )

  const activeAssignment = assignments.find((a) => a.class_subject_id === activeTab)

  if (isLoadingAssignments) {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 overflow-y-auto">
        <ClipboardListIcon className="size-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">No class assignments found</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
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

      {/* Header row */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">
            Exams – Grade {activeAssignment?.class?.grade}-{activeAssignment?.class?.section} · {activeAssignment?.subject?.subject_name}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Create and manage question papers for your class
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="w-full sm:w-auto">
          <PlusIcon className="mr-1.5 size-4" />
          Create Exam
        </Button>
      </div>

      {/* Exam cards */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoadingExams ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : exams.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3">
            <FileTextIcon className="size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No exams created yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="group relative flex flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
              >
                {/* Actions */}
                {exam.question_count === 0 && (
                  <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(exam) }}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <EditIcon className="size-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteExam(exam) }}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 pr-16">
                  <h3 className="text-sm font-semibold">{exam.exam_name}</h3>
                  {exam.source && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold",
                        exam.source === "ai"
                          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                          : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
                      )}
                    >
                      {exam.source === "ai" ? "AI Generated" : "Uploaded"}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(exam.chapters_selected ?? []).slice(0, 3).map((ch) => (
                    <span
                      key={ch}
                      className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"
                    >
                      {ch}
                    </span>
                  ))}
                  {(exam.chapters_selected ?? []).length > 3 && (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      +{exam.chapters_selected.length - 3} more
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="font-medium">{exam.total_marks} marks</span>
                  <span>·</span>
                  <span>{exam.question_count} questions</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="size-3" />
                    {dayjs(exam.created_at).format("MMM D, YYYY")}
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-4 border-t pt-3">
                  {exam.question_count === 0 ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate(`/exams/${exam.id}/generate?${searchParams.toString()}`)}
                      >
                        <SparklesIcon className="mr-1.5 size-3.5" />
                        AI Generate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate(`/exams/${exam.id}/upload?${searchParams.toString()}`)}
                      >
                        <UploadIcon className="mr-1.5 size-3.5" />
                        Upload Paper
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/exams/${exam.id}/questions?${searchParams.toString()}`)}
                    >
                      <FileTextIcon className="mr-1.5 size-3.5" />
                      View Question Paper
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Exam Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent
          className="ml-auto h-full w-full rounded-none p-0 before:hidden sm:max-w-[580px]"
        >
          <div className="flex items-center gap-3 border-b bg-background px-4 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-medium text-secondary-foreground">
                {editExam ? "Edit Exam" : "Create Exam"}
              </h2>
            </div>
            <DrawerClose asChild>
              <button
                className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <XIcon className="size-5" />
              </button>
            </DrawerClose>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:p-6">
            {/* Exam Name */}
            <div className="space-y-1.5">
              <Label>Exam Name</Label>
              <Input
                placeholder="e.g., Mid-Term Examination 2026"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
              />
            </div>

            {/* Chapters */}
            <div className="space-y-1.5">
              <Label>Chapters / Topics</Label>
              <div className="relative">
                <Input
                  placeholder="Type to search chapters from your materials..."
                  value={chapterInput}
                  onChange={(e) => {
                    setChapterInput(e.target.value)
                    setShowSuggestions(true)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && chapterInput.trim()) {
                      e.preventDefault()
                      addChapter(chapterInput)
                    }
                  }}
                />
                {showSuggestions && chapterInput && filteredSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                    {filteredSuggestions.map((s) => (
                      <button
                        key={s}
                        className="w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted"
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
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {chapters.map((ch) => (
                    <span
                      key={ch}
                      className="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {ch}
                      <button
                        onClick={() => removeChapter(ch)}
                        className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-primary/20"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Suggestions come from tags in your uploaded materials. You can also type custom chapters.
              </p>
            </div>

            {/* Blueprint */}
            <div className="space-y-2">
              <Label>Blueprint</Label>

              {savedBlueprints.length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-1.5 text-xs"
                  onClick={() => setBlueprintModalOpen(true)}
                >
                  <PlusIcon className="size-3.5" />
                  Create Blueprint
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedBlueprintId || undefined}
                    onValueChange={handleBlueprintSelect}
                  >
                    <SelectTrigger className="h-9 flex-1 text-xs">
                      <SelectValue placeholder="Select a blueprint" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedBlueprints.map((bp) => (
                        <SelectItem key={bp.id} value={bp.id}>
                          {bp.name} ({bp.total_marks} marks)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-xs text-primary"
                    onClick={() => setBlueprintModalOpen(true)}
                  >
                    <PlusIcon className="mr-1 size-3" />
                    New
                  </Button>
                </div>
              )}

              {/* Section editor — shown after a blueprint is selected or editing an exam */}
              {showBlueprintSections && (
                <>
                  <div className="flex items-center justify-end">
                    <button
                      onClick={addBlueprintSection}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      + Add Section
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {blueprint.map((sec, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3"
                      >
                        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                              Section
                            </label>
                            <Input
                              value={sec.section}
                              onChange={(e) => updateBlueprint(idx, "section", e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                              Type
                            </label>
                            <Input
                              value={sec.type}
                              onChange={(e) => updateBlueprint(idx, "type", e.target.value)}
                              className="h-8 text-xs"
                              placeholder="e.g., MCQ"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                              Questions
                            </label>
                            <Input
                              type="number"
                              min={1}
                              value={sec.num_questions}
                              onChange={(e) => updateBlueprint(idx, "num_questions", Number(e.target.value))}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                              Marks each
                            </label>
                            <Input
                              type="number"
                              min={1}
                              value={sec.marks_per_question}
                              onChange={(e) => updateBlueprint(idx, "marks_per_question", Number(e.target.value))}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                        {blueprint.length > 1 && (
                          <button
                            onClick={() => removeBlueprintSection(idx)}
                            className="mt-5 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
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
                    <button
                      onClick={handleSaveEditedAsBlueprint}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Save changes as new blueprint
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <DrawerFooter className="border-t bg-muted/30">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setDrawerOpen(false); resetForm() }}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
                {editExam ? "Update Exam" : "Create Exam"}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteExam} onOpenChange={() => setDeleteExam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteExam?.exam_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Blueprint creation modal */}
      <BlueprintModal
        open={blueprintModalOpen}
        onClose={() => setBlueprintModalOpen(false)}
        onSaved={handleBlueprintCreated}
      />
    </div>
  )
}
