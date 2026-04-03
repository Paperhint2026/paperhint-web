import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import dayjs from "dayjs"
import {
  ArrowLeftIcon,
  BookOpenIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  GraduationCapIcon,
  MailIcon,
  PhoneIcon,
} from "lucide-react"

import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"

interface ClassInfo {
  id: string
  grade: number | string
  section: string
  academic_year?: string
}

interface SubjectInfo {
  id: string
  subject_name: string
}

interface Assignment {
  class_subject_id: string
  class: ClassInfo
  subject: SubjectInfo
}

interface TeacherOverview {
  id: string
  full_name: string
  email: string
  profile_url?: string | null
  status?: string | null
  department_id?: string | null
  department_name?: string | null
  designation?: string | null
  phone_number?: string | null
  date_of_joining?: number | string | null
  total_assignments: number
  total_classes: number
  total_subjects: number
  assignments: Assignment[]
  classes: ClassInfo[]
  subjects: SubjectInfo[]
}

const GRADIENTS = [
  "from-indigo-900 to-slate-900",
  "from-sky-900 to-slate-900",
  "from-emerald-900 to-slate-900",
  "from-teal-900 to-slate-900",
  "from-blue-900 to-slate-900",
  "from-cyan-900 to-slate-900",
  "from-violet-900 to-slate-900",
  "from-slate-800 to-slate-900",
]

const BORDER_GRADIENTS = [
  "from-indigo-400/40 to-indigo-200/10",
  "from-sky-400/40 to-sky-200/10",
  "from-emerald-400/40 to-emerald-200/10",
  "from-teal-400/40 to-teal-200/10",
  "from-blue-400/40 to-blue-200/10",
  "from-cyan-400/40 to-cyan-200/10",
  "from-violet-400/40 to-violet-200/10",
  "from-slate-400/40 to-slate-200/10",
]

function hashStringToIndex(str: string, max: number): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % max
}

function getGradient(departmentId?: string | null) {
  const idx = departmentId
    ? hashStringToIndex(departmentId, GRADIENTS.length)
    : 0
  return { bg: GRADIENTS[idx], border: BORDER_GRADIENTS[idx] }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const STATUS_COLORS: Record<string, string> = {
  invited: "bg-amber-500",
  active: "bg-emerald-500",
  inactive: "bg-slate-500",
}

export function TeacherOverviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [teacher, setTeacher] = useState<TeacherOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchOverview = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError("")
    try {
      const res = await apiClient.get<{ teacher: TeacherOverview }>(
        `/api/auth/teacher/${id}/overview`,
      )
      setTeacher(res.teacher)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  if (isLoading) {
    return (
      <div className="flex size-full items-center justify-center overflow-y-auto">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (error || !teacher) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-4 overflow-y-auto">
        <p className="text-sm text-destructive">{error || "Teacher not found"}</p>
        <Button variant="outline" onClick={() => navigate("/teachers")}>
          <ArrowLeftIcon className="size-4" />
          Back to Teachers
        </Button>
      </div>
    )
  }

  const assignmentsByClass = teacher.assignments.reduce<
    Record<string, { classInfo: ClassInfo; subjects: SubjectInfo[] }>
  >((acc, a) => {
    const key = a.class.id
    if (!acc[key]) {
      acc[key] = { classInfo: a.class, subjects: [] }
    }
    acc[key].subjects.push(a.subject)
    return acc
  }, {})

  return (
    <div className="flex size-full flex-col overflow-y-auto">
      {/* Back button */}
      <div className="px-4 pt-3 sm:px-6 sm:pt-4">
        <button
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => navigate("/teachers")}
        >
          <ArrowLeftIcon className="size-5" />
        </button>
      </div>

      {/* Profile Card */}
      <div className="mx-auto w-full max-w-4xl px-4 pt-3 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl">

          {/* Status tag */}
          {teacher.status && (
            <span
              className={`absolute right-4 top-4 z-20 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize text-white ${STATUS_COLORS[teacher.status] ?? "bg-slate-500"}`}
            >
              {teacher.status === "inactive" ? "In-Active" : teacher.status}
            </span>
          )}

          {/* Background gradient - department based */}
          <div className={`absolute inset-0 bg-gradient-to-r ${getGradient(teacher.department_id).bg}`} />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)",
              backgroundSize: "10px 10px",
            }}
          />

          {/* Content */}
          <div className="relative flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:items-center sm:gap-6 sm:p-8 sm:text-left">
            {/* Profile photo with department-tinted border */}
            <div className="relative shrink-0">
              <div className={`absolute -inset-1.5 rounded-xl bg-gradient-to-br ${getGradient(teacher.department_id).border}`} />
              <div className="relative size-24 overflow-hidden rounded-lg sm:size-28">
                {teacher.profile_url ? (
                  <img
                    src={teacher.profile_url}
                    alt={teacher.full_name}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-white/10 text-2xl font-bold text-white/40 sm:text-3xl">
                    {getInitials(teacher.full_name)}
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex flex-1 flex-col gap-2">
              <h1 className="text-xl font-bold text-white sm:text-2xl">
                {teacher.full_name}
              </h1>
              {(teacher.designation || teacher.department_name) && (
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
                  {teacher.designation && (
                    <p className="text-sm font-medium text-white/60">
                      {teacher.designation}
                    </p>
                  )}
                  {teacher.designation && teacher.department_name && (
                    <span className="text-white/30">·</span>
                  )}
                  {teacher.department_name && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-white/60">
                      <BuildingIcon className="size-3.5" />
                      {teacher.department_name}
                    </span>
                  )}
                </div>
              )}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-white/50 sm:justify-start sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <MailIcon className="size-3.5" />
                  <span className="break-all">{teacher.email}</span>
                </span>
                {teacher.phone_number && (
                  <span className="inline-flex items-center gap-1.5">
                    <PhoneIcon className="size-3.5" />
                    {teacher.phone_number}
                  </span>
                )}
                {teacher.date_of_joining && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarIcon className="size-3.5" />
                    Joined{" "}
                    {dayjs(teacher.date_of_joining).format("MMM DD, YYYY")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats & Content */}
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            icon={GraduationCapIcon}
            label="Classes"
            value={teacher.total_classes}
            color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            icon={BookOpenIcon}
            label="Subjects"
            value={teacher.total_subjects}
            color="bg-sky-500/10 text-sky-600 dark:text-sky-400"
          />
        </div>

        <Separator />

        {/* Assignments grouped by class */}
        <div className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-base font-medium text-secondary-foreground">
            <BriefcaseIcon className="size-4" />
            Class &amp; Subject Assignments
          </h2>

          {Object.keys(assignmentsByClass).length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10">
              <p className="text-sm text-muted-foreground">
                No assignments yet
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Object.values(assignmentsByClass).map(
                ({ classInfo, subjects }) => (
                  <div
                    key={classInfo.id}
                    className="flex flex-col gap-3 rounded-lg border bg-background p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/10">
                          <GraduationCapIcon className="size-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-secondary-foreground">
                            Grade {classInfo.grade} - Section{" "}
                            {classInfo.section}
                          </p>
                          {classInfo.academic_year && (
                            <p className="text-xs text-muted-foreground">
                              {classInfo.academic_year}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {subjects.length}{" "}
                        {subjects.length === 1 ? "subject" : "subjects"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {subjects.map((sub) => (
                        <span
                          key={sub.id}
                          className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-secondary-foreground"
                        >
                          <BookOpenIcon className="size-3 text-muted-foreground" />
                          {sub.subject_name}
                        </span>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-background p-4">
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${color}`}
      >
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-secondary-foreground">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
