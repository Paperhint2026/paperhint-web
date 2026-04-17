import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  BookCopyIcon,
  BookIcon,
  BookPlusIcon,
  CalendarIcon,
  ChevronRightIcon,
  FileTextIcon,
  ListChecksIcon,
  NewspaperIcon,
  PlusIcon,
  SchoolIcon,
  SearchIcon,
  SparklesIcon,
  SplitIcon,
  TimerResetIcon,
  UserRoundPlusIcon,
  UsersRoundIcon,
} from "lucide-react"

import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface Teacher {
  id: string
  full_name: string
  email: string
  designation?: string
  profile_url?: string
  subjects?: Subject[]
}

interface Subject {
  id: string
  subject_name: string
  teachers?: Teacher[]
}

interface Student {
  id: string
  full_name: string
  roll_number?: string
  class_id: string
}

interface Section {
  id: string
  grade: string
  section: string
  academic_year: string
  student_count: number
  students: Student[]
  subjects: (Subject & { class_subject_id: string })[]
  teachers: Teacher[]
}

interface GradeOverview {
  grade: string
  academic_year: string
  total_subjects: number
  total_sections: number
  total_students: number
  total_teachers: number
  subjects: Subject[]
  sections: Section[]
  teachers: Teacher[]
  created_by: string
}

interface ClassExam {
  id: string
  exam_name: string
  total_marks: number
  question_count: number
  chapters_selected: string[]
  source: "ai" | "uploaded" | null
  created_at: string
}

interface SubjectOption {
  classSubjectId: string
  subjectName: string
  sectionLabel: string
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/* ── Class Exams Tab ─────────────────────────────────────── */
function ClassExamsTab({ sections }: { sections: Section[] }) {
  const navigate = useNavigate()

  const subjectOptions = useMemo<SubjectOption[]>(
    () =>
      sections.flatMap((section) =>
        section.subjects.map((s) => ({
          classSubjectId: s.class_subject_id,
          subjectName: s.subject_name,
          sectionLabel: `Section ${section.section}`,
        })),
      ),
    [sections],
  )

  const [selectedCsId, setSelectedCsId] = useState(subjectOptions[0]?.classSubjectId ?? "")
  const [exams, setExams] = useState<ClassExam[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!selectedCsId) return
    setIsLoading(true)
    apiClient
      .get<{ exams: ClassExam[] }>(`/api/exams/class-subject/${selectedCsId}`)
      .then((res) => setExams(res.exams ?? []))
      .catch(() => setExams([]))
      .finally(() => setIsLoading(false))
  }, [selectedCsId])

  if (subjectOptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16">
        <p className="text-sm text-muted-foreground">No subjects found in this class.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Subject selector pills */}
      <div className="flex flex-wrap gap-1.5">
        {subjectOptions.map((opt) => (
          <button
            key={opt.classSubjectId}
            type="button"
            onClick={() => { setSelectedCsId(opt.classSubjectId); setExams([]) }}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              selectedCsId === opt.classSubjectId
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-muted-foreground hover:bg-muted/60",
            )}
          >
            {opt.sectionLabel} · {opt.subjectName}
          </button>
        ))}
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-secondary-foreground">
          {subjectOptions.find((o) => o.classSubjectId === selectedCsId)?.subjectName ?? "Exams"}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-full text-xs"
          onClick={() => navigate(`/class/${selectedCsId}/exams`)}
        >
          <NewspaperIcon className="size-3.5" />
          Create Exam
        </Button>
      </div>

      {/* Exam list */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <FileTextIcon className="size-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">No exams yet for this subject</p>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-full"
            onClick={() => navigate(`/class/${selectedCsId}/exams`)}
          >
            <PlusIcon className="size-3.5" />
            Create your first exam
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => {
            const hasQuestions = exam.question_count > 0
            return (
              <Card
                key={exam.id}
                className="group cursor-pointer transition-all hover:shadow-md"
                onClick={() => navigate(`/class/${selectedCsId}/exams`)}
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
                    {new Date(exam.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
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

                  {/* Open in full page hint */}
                  <div className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {hasQuestions ? (
                      <>
                        <SparklesIcon className="size-3" />
                        <span>View exam</span>
                      </>
                    ) : (
                      <>
                        <ChevronRightIcon className="size-3" />
                        <span>Generate or upload questions</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Shared right-panel content ─────────────────────────── */
function RightPanelContent({ data }: { data: GradeOverview }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Actions */}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-accent-foreground">Actions</p>
        <div className="flex flex-col gap-2.5">
          <Button variant="secondary" className="w-full gap-2 rounded-full">
            <NewspaperIcon className="size-4" />
            Create Exam
          </Button>
          <Button variant="secondary" className="w-full gap-2 rounded-full">
            <ListChecksIcon className="size-4" />
            Start Grading
          </Button>
        </div>
      </div>

      <Separator />

      {/* Subjects */}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-secondary-foreground">Subjects</p>
        <div className="flex flex-col gap-4">
          {data.subjects.map((subject) => (
            <div key={subject.id} className="flex items-center gap-2.5">
              <BookIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex-1 truncate text-sm font-medium text-secondary-foreground">
                  {subject.subject_name}
                </span>
                {subject.teachers && subject.teachers.length > 0 && (
                  <AvatarGroup className="shrink-0">
                    {subject.teachers.slice(0, 4).map((teacher) => (
                      <Avatar key={teacher.id} size="sm">
                        {teacher.profile_url ? (
                          <AvatarImage src={teacher.profile_url} alt={teacher.full_name} />
                        ) : null}
                        <AvatarFallback>{getInitials(teacher.full_name)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </AvatarGroup>
                )}
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" className="w-full gap-2 rounded-full">
          <BookPlusIcon className="size-4" />
          Add Subject
        </Button>
      </div>

      <Separator />

      {/* Overall Details */}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-accent-foreground">Overall Details</p>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5 text-sm">
            <BookCopyIcon className="size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-medium text-secondary-foreground">{data.total_subjects}</span>{" "}
              <span className="text-muted-foreground">Subjects</span>
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <SplitIcon className="size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-medium text-secondary-foreground">{data.total_sections}</span>{" "}
              <span className="text-muted-foreground">Sections</span>
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <UsersRoundIcon className="size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-medium text-secondary-foreground">{data.total_students}</span>{" "}
              <span className="text-muted-foreground">Students</span>
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              Academic Year{" "}
              <span className="font-medium text-secondary-foreground">{data.academic_year}</span>
            </span>
          </div>
          {data.created_by && (
            <div className="flex items-center gap-2.5 text-sm">
              <Avatar size="sm">
                <AvatarFallback>{getInitials(data.created_by)}</AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground">
                Created by{" "}
                <span className="font-medium text-secondary-foreground">{data.created_by}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────── */
export function ClassOverviewPage() {
  const { grade } = useParams<{ grade: string }>()
  const navigate = useNavigate()

  const [searchParams] = useSearchParams()
  const pageTab = (searchParams.get("tab") ?? "overview") as "overview" | "exams"

  const [data, setData] = useState<GradeOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"students" | "teachers">("students")
  const [searchQuery, setSearchQuery] = useState("")

  const fetchOverview = useCallback(async () => {
    if (!grade) return
    setIsLoading(true)
    setError("")
    try {
      const res = await apiClient.get<GradeOverview>(`/api/classes/grade/${grade}/overview`)
      setData(res)
      if (res.sections.length > 0) setSelectedSectionId(res.sections[0].id)
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [grade])

  useEffect(() => { fetchOverview() }, [fetchOverview])

  const selectedSection = useMemo(
    () => data?.sections.find((s) => s.id === selectedSectionId) ?? null,
    [data, selectedSectionId],
  )

  const filteredList = useMemo(() => {
    if (!selectedSection) return []
    const query = searchQuery.toLowerCase()
    if (activeTab === "students") {
      return selectedSection.students.filter((s) => s.full_name.toLowerCase().includes(query))
    }
    return (selectedSection.teachers || []).filter((t) => t.full_name.toLowerCase().includes(query))
  }, [selectedSection, activeTab, searchQuery])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-destructive">{error || "Grade not found"}</p>
        <Button variant="outline" onClick={() => navigate("/classes")}>Back to Classes</Button>
      </div>
    )
  }

  return (
    /* On mobile: single scrollable column. On lg+: two-column side-by-side. */
    <div className="flex min-h-full flex-col overflow-y-auto lg:h-full lg:min-h-0 lg:flex-row lg:overflow-hidden">

      {/* ── Main left area ── */}
      <div className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto">

        {/* Padded content area */}
        <div className="flex flex-1 flex-col gap-4 p-4 sm:gap-5 sm:p-5">

        {/* Header card — overview tab only */}
        <div className={cn("relative flex min-h-[90px] shrink-0 flex-col items-start justify-end gap-3 overflow-hidden rounded-xl border p-4 sm:min-h-[100px] sm:p-5", pageTab !== "overview" && "hidden")}>
          {/* Background image */}
          <div className="absolute inset-0 bg-[url('/header-image.jpg')] bg-cover bg-center bg-no-repeat" />
          {/* Overlay — keeps text legible and matches layout tone */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-background/20" />
          <div className="relative w-full">
            <div className="flex items-center gap-3">
              <h1 className="flex-1 truncate text-base font-medium text-secondary-foreground sm:text-lg">
                Grade {data.grade}
              </h1>
              <Badge className="hidden shrink-0 gap-1 rounded-full bg-secondary-foreground text-secondary text-[11px] sm:inline-flex">
                <TimerResetIcon className="size-3" />
                Current Batch
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm">{data.academic_year}</p>
          </div>
        </div>

        {/* ── Exams tab content ── */}
        {pageTab === "exams" && (
          <ClassExamsTab sections={data.sections} />
        )}

        {/* ── Mobile accordion — between banner and section tabs, hidden on lg ── */}
        <div className={cn("lg:hidden", pageTab !== "overview" && "hidden")}>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="actions">
              <AccordionTrigger className="text-sm font-medium text-accent-foreground">
                Actions
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-2.5 pb-2">
                  <Button variant="secondary" className="w-full gap-2 rounded-full">
                    <NewspaperIcon className="size-4" />
                    Create Exam
                  </Button>
                  <Button variant="secondary" className="w-full gap-2 rounded-full">
                    <ListChecksIcon className="size-4" />
                    Start Grading
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="subjects">
              <AccordionTrigger className="text-sm font-medium text-secondary-foreground">
                Subjects
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-4 pb-2">
                  {data.subjects.map((subject) => (
                    <div key={subject.id} className="flex items-center gap-2.5">
                      <BookIcon className="size-4 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex-1 truncate text-sm font-medium text-secondary-foreground">
                          {subject.subject_name}
                        </span>
                        {subject.teachers && subject.teachers.length > 0 && (
                          <AvatarGroup className="shrink-0">
                            {subject.teachers.slice(0, 4).map((teacher) => (
                              <Avatar key={teacher.id} size="sm">
                                {teacher.profile_url ? (
                                  <AvatarImage src={teacher.profile_url} alt={teacher.full_name} />
                                ) : null}
                                <AvatarFallback>{getInitials(teacher.full_name)}</AvatarFallback>
                              </Avatar>
                            ))}
                          </AvatarGroup>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full gap-2 rounded-full">
                    <BookPlusIcon className="size-4" />
                    Add Subject
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="details" className="border-b-0">
              <AccordionTrigger className="text-sm font-medium text-accent-foreground">
                Overall Details
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-4 pb-2">
                  <div className="flex items-center gap-2.5 text-sm">
                    <BookCopyIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="font-medium text-secondary-foreground">{data.total_subjects}</span>{" "}
                      <span className="text-muted-foreground">Subjects</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <SplitIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="font-medium text-secondary-foreground">{data.total_sections}</span>{" "}
                      <span className="text-muted-foreground">Sections</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <UsersRoundIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="font-medium text-secondary-foreground">{data.total_students}</span>{" "}
                      <span className="text-muted-foreground">Students</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Academic Year{" "}
                      <span className="font-medium text-secondary-foreground">{data.academic_year}</span>
                    </span>
                  </div>
                  {data.created_by && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Avatar size="sm">
                        <AvatarFallback>{getInitials(data.created_by)}</AvatarFallback>
                      </Avatar>
                      <span className="text-muted-foreground">
                        Created by{" "}
                        <span className="font-medium text-secondary-foreground">{data.created_by}</span>
                      </span>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Sections + content */}
        <div className={cn("flex min-h-0 flex-col gap-4 lg:flex-1 lg:flex-row lg:items-stretch lg:gap-5", pageTab !== "overview" && "hidden")}>

          {/* Section pills
              Mobile: horizontal scroll row
              Desktop: vertical 200px column */}
          <div className="flex shrink-0 flex-col gap-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:pb-0">
              {data.sections.map((section) => {
                const isSelected = selectedSectionId === section.id
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => { setSelectedSectionId(section.id); setSearchQuery("") }}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-left text-sm transition-colors lg:w-[200px]",
                      isSelected
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    <SchoolIcon className="size-4 shrink-0" />
                    <span className="truncate">Section {section.section}</span>
                  </button>
                )
              })}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full text-xs lg:w-[200px]">
              <PlusIcon className="size-3.5" />
              Add Section
            </Button>
          </div>

          {/* Content widget */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border">

            {/* Tabs + search header */}
            {/* Tab row — always visible, underline stays on border */}
            <div className="flex border-b px-5">
              {(["students", "teachers"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "mr-4 flex items-center self-stretch border-b-2 text-sm font-medium capitalize transition-colors",
                    activeTab === tab
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab === "students" ? "Students" : "Teachers"}
                </button>
              ))}
              {/* Search + action inline on sm+ */}
              <div className="ml-auto hidden items-center gap-2 py-2 sm:flex">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 w-52 rounded-full pl-9 text-sm sm:w-64"
                  />
                </div>
                <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 rounded-full text-xs">
                  <UserRoundPlusIcon className="size-3.5" />
                  <span>{activeTab === "students" ? "Add Student" : "Add Teacher"}</span>
                </Button>
              </div>
            </div>

            {/* Search + action below tabs on mobile only */}
            <div className="flex items-center gap-2 border-b px-5 py-2 sm:hidden">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-full pl-9 text-sm"
                />
              </div>
              <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 rounded-full text-xs">
                <UserRoundPlusIcon className="size-3.5" />
              </Button>
            </div>

            {/* Table */}
            {filteredList.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2">
                <p className="text-sm text-muted-foreground">
                  No {activeTab} found{searchQuery ? ` matching "${searchQuery}"` : " in this section"}
                </p>
              </div>
            ) : activeTab === "students" ? (
              <div className="overflow-auto [&_td]:px-5 [&_th]:px-5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[70px]">Roll No.</TableHead>
                      <TableHead>Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(filteredList as Student[]).map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="text-muted-foreground">
                          {student.roll_number ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar size="sm">
                              <AvatarFallback>{getInitials(student.full_name)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-secondary-foreground">
                              {student.full_name}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="overflow-auto [&_td]:px-5 [&_th]:px-5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Designation</TableHead>
                      <TableHead>Subjects</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(filteredList as Teacher[]).map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar size="sm">
                              {teacher.profile_url ? (
                                <AvatarImage src={teacher.profile_url} alt={teacher.full_name} />
                              ) : null}
                              <AvatarFallback>{getInitials(teacher.full_name)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-secondary-foreground">
                              {teacher.full_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                          {teacher.designation ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {teacher.subjects && teacher.subjects.length > 0
                              ? teacher.subjects.map((s) => (
                                  <Badge
                                    key={s.id}
                                    variant="secondary"
                                    className="rounded-full text-[11px]"
                                  >
                                    {s.subject_name}
                                  </Badge>
                                ))
                              : <span className="text-sm text-muted-foreground">—</span>
                            }
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
        </div>{/* end padded content area */}
      </div>

      {/* ── Right panel — desktop only, always visible ── */}
      <div className="hidden w-[380px] shrink-0 flex-col gap-5 self-stretch overflow-y-auto border-l p-5 lg:flex">
        <RightPanelContent data={data} />
      </div>
    </div>
  )
}
