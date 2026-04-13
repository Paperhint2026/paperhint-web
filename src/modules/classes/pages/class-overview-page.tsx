import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  BookOpenIcon,
  CalendarIcon,
  ChevronLeftIcon,
  GraduationCapIcon,
  LayoutGridIcon,
  SearchIcon,
  TimerResetIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"

import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar"

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

const SECTION_COLORS = [
  "bg-cyan-600",
  "bg-indigo-600",
  "bg-emerald-600",
  "bg-lime-600",
  "bg-yellow-600",
  "bg-rose-600",
  "bg-violet-600",
  "bg-orange-600",
]

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function ClassOverviewPage() {
  const { grade } = useParams<{ grade: string }>()
  const navigate = useNavigate()

  const [data, setData] = useState<GradeOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  )
  const [activeTab, setActiveTab] = useState<"students" | "teachers">(
    "teachers",
  )
  const [searchQuery, setSearchQuery] = useState("")

  const fetchOverview = useCallback(async () => {
    if (!grade) return
    setIsLoading(true)
    setError("")
    try {
      const res = await apiClient.get<GradeOverview>(
        `/api/classes/grade/${grade}/overview`,
      )
      setData(res)
      if (res.sections.length > 0) {
        setSelectedSectionId(res.sections[0].id)
      }
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [grade])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  const selectedSection = useMemo(
    () => data?.sections.find((s) => s.id === selectedSectionId) ?? null,
    [data, selectedSectionId],
  )

  const filteredList = useMemo(() => {
    if (!selectedSection) return []
    const query = searchQuery.toLowerCase()

    if (activeTab === "students") {
      return selectedSection.students.filter((s) =>
        s.full_name.toLowerCase().includes(query),
      )
    }

    return (selectedSection.teachers || []).filter((t) =>
      t.full_name.toLowerCase().includes(query),
    )
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
        <p className="text-sm text-destructive">
          {error || "Grade not found"}
        </p>
        <Button variant="outline" onClick={() => navigate("/classes")}>
          Back to Classes
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-6 p-6">
      {/* Left Sidebar */}
      <div className="flex w-[280px] shrink-0 flex-col gap-4 overflow-y-auto">
        <Button
          variant="outline"
          size="icon"
          className="size-9 shrink-0"
          onClick={() => navigate("/classes")}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>

        <div>
          <h1 className="truncate text-lg font-medium text-secondary-foreground">
            Grade {data.grade}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {data.academic_year}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-accent-foreground">
              <TimerResetIcon className="size-3" />
              Current Batch
            </span>
          </div>
        </div>

        <p className="text-sm font-semibold text-secondary-foreground">
          Subjects
        </p>

        <div className="flex flex-col gap-3">
          {data.subjects.map((subject) => (
            <div key={subject.id} className="flex items-center gap-3">
              <BookOpenIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm font-medium text-secondary-foreground">
                {subject.subject_name}
              </span>
              {subject.teachers && subject.teachers.length > 0 && (
                <AvatarGroup className="shrink-0">
                  {subject.teachers.slice(0, 4).map((teacher) => (
                    <Avatar key={teacher.id} size="sm">
                      {teacher.profile_url ? (
                        <AvatarImage
                          src={teacher.profile_url}
                          alt={teacher.full_name}
                        />
                      ) : null}
                      <AvatarFallback>
                        {getInitials(teacher.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </AvatarGroup>
              )}
            </div>
          ))}
        </div>

        <Separator />

        <p className="text-sm font-semibold text-secondary-foreground">
          Class Room Overview
        </p>
        <div className="flex flex-col gap-3 pb-4">
          <div className="flex items-center gap-3 text-sm">
            <BookOpenIcon className="size-4 text-muted-foreground" />
            <span>
              <span className="font-medium">{data.total_subjects}</span>{" "}
              <span className="text-muted-foreground">Subjects</span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <LayoutGridIcon className="size-4 text-muted-foreground" />
            <span>
              <span className="font-medium">{data.total_sections}</span>{" "}
              <span className="text-muted-foreground">Sections</span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <UsersIcon className="size-4 text-muted-foreground" />
            <span>
              <span className="font-medium">{data.total_students}</span>{" "}
              <span className="text-muted-foreground">Students</span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CalendarIcon className="size-4 text-muted-foreground" />
            <span>
              <span className="text-muted-foreground">Academic Year</span>{" "}
              <span className="font-medium">{data.academic_year}</span>
            </span>
          </div>
          {data.created_by && (
            <div className="flex items-center gap-3 text-sm">
              <UserIcon className="size-4 text-muted-foreground" />
              <span>
                <span className="text-muted-foreground">Created by</span>{" "}
                <span className="font-medium">{data.created_by}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Sections + Right panel in a bordered container */}
      <div className="flex min-w-0 flex-1 overflow-hidden rounded-lg border">
        {/* Sections column */}
        <div className="flex w-[260px] shrink-0 flex-col gap-4 border-r p-4 overflow-y-auto">
          <p className="text-sm font-medium text-secondary-foreground">
            Sections
          </p>
          <div className="flex flex-col gap-2">
            {data.sections.map((section, index) => {
              const isSelected = selectedSectionId === section.id
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setSelectedSectionId(section.id)
                    setSearchQuery("")
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-md border p-3 text-left transition-colors",
                    isSelected
                      ? "border-border bg-muted"
                      : "border-border bg-background hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-sm",
                      SECTION_COLORS[index % SECTION_COLORS.length],
                    )}
                  >
                    <GraduationCapIcon className="size-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm",
                        isSelected ? "font-semibold" : "font-normal",
                      )}
                    >
                      Section {section.section}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {section.student_count} Students
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {/* Tabs */}
          <div className="flex items-center gap-0 self-start rounded-full bg-muted p-[3px]">
            <button
              type="button"
              onClick={() => {
                setActiveTab("students")
                setSearchQuery("")
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium transition-all",
                activeTab === "students"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <UsersIcon className="size-4" />
              Students
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("teachers")
                setSearchQuery("")
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium transition-all",
                activeTab === "teachers"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <UserIcon className="size-4" />
              Teachers
            </button>
          </div>

          {/* Search + Action */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeTab === "students" ? "Students" : "Teachers"}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button size="default">
              <UsersIcon className="size-4" />
              {activeTab === "students" ? "Students" : "Teachers"}
            </Button>
          </div>

          <Separator />

          {/* List */}
          <div className="flex flex-col gap-4">
            {filteredList.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <p className="text-sm text-muted-foreground">
                  No {activeTab} found
                  {searchQuery
                    ? ` matching "${searchQuery}"`
                    : " in this section"}
                </p>
              </div>
            ) : (
              filteredList.map((item) => {
                if (activeTab === "students") {
                  const student = item as Student
                  return (
                    <div
                      key={student.id}
                      className="flex items-center gap-3"
                    >
                      <Avatar size="sm">
                        <AvatarFallback>
                          {getInitials(student.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {student.full_name}
                        </p>
                        {student.roll_number && (
                          <p className="text-xs text-muted-foreground">
                            Roll No. {student.roll_number}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                }

                const teacher = item as Teacher
                const subjectNames =
                  teacher.subjects
                    ?.map((s) => s.subject_name)
                    .join(", ") ?? ""
                return (
                  <div
                    key={teacher.id}
                    className="flex items-center gap-3"
                  >
                    <Avatar size="sm">
                      {teacher.profile_url ? (
                        <AvatarImage
                          src={teacher.profile_url}
                          alt={teacher.full_name}
                        />
                      ) : null}
                      <AvatarFallback>
                        {getInitials(teacher.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {teacher.full_name}
                      </p>
                      {teacher.designation && (
                        <p className="text-xs text-muted-foreground">
                          {teacher.designation}
                        </p>
                      )}
                    </div>
                    {subjectNames && (
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-accent-foreground">
                        {subjectNames}
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
