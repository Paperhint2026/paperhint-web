import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { PlusIcon, ChalkboardIcon } from "@phosphor-icons/react"
import { useHeaderActions } from "@/components/layout/header-actions-context"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import {
  PageToolbar,
  PageToolbarSkeleton,
} from "@/components/shared/page-toolbar"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { countSummary } from "@/lib/format"
import { useAppDispatch, useAppSelector } from "@/store"
import { fetchSubjects } from "@/store/subjects-slice"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Sticker } from "@/components/shared/sticker"
import {
  ClassCard,
  type ClassRecord,
  type GroupedGrade,
} from "@/modules/classes/components/class-card"
import {
  AddClassDrawer,
  type ClassFormData,
} from "@/modules/classes/components/add-class-drawer"
import { GradeOverviewSheet } from "@/modules/classes/components/grade-overview-sheet"

interface SubjectInfo {
  id: string
  subject_name: string
}

interface GroupedClassesResponse {
  classes: Record<string, ClassRecord[]>
  gradeSubjects?: Record<string, SubjectInfo[]>
  studentCounts?: Record<string, number>
  active_academic_year?: string | null
}

function toGroupedGrades(
  grouped: Record<string, ClassRecord[]>,
  gradeSubjects?: Record<string, SubjectInfo[]>,
  studentCounts?: Record<string, number>
): GroupedGrade[] {
  return Object.entries(grouped)
    .map(([grade, records]) => ({
      grade,
      academicYear: records[0]?.academic_year ?? "",
      // Neither the API nor the grouping orders these, so the card would
      // otherwise render section chips as "B A".
      sections: [...records].sort((a, b) => a.section.localeCompare(b.section)),
      subjects: gradeSubjects?.[grade] ?? [],
      studentCount: studentCounts?.[grade] ?? 0,
    }))
    .sort((a, b) => Number(a.grade) - Number(b.grade))
}

/** Placeholder in the shape of a ClassCard — cover with its two pills and
 *  grade name, the icon disc on the cover edge, then the sections, subjects
 *  and students rows — so the grid doesn't jump when the real cards land. */
function ClassCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs">
      {/* Cover */}
      <div className="flex h-28 shrink-0 flex-col justify-between bg-muted p-4">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-6 w-20 rounded-full bg-background/60" />
          <Skeleton className="h-6 w-24 rounded-full bg-background/60" />
        </div>
        <Skeleton className="h-6 w-24 bg-background/60" />
      </div>

      {/* Icon disc straddling the cover edge */}
      <div className="relative h-0">
        <div className="absolute -top-6 right-4 flex size-12 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
          <Skeleton className="size-6 rounded-full" />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-4">
        <div className="flex items-center gap-1.5 pr-14">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="size-6 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
        <div className="mt-auto flex items-center border-t border-border pt-3">
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="ml-2 h-3.5 w-20" />
        </div>
      </div>
    </div>
  )
}

export function ClassesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const navigate = useNavigate()
  // `/classes/:grade/overview` renders this same page with the grade's sheet
  // open, so the grid stays put underneath and the link is shareable.
  const { grade: openGrade } = useParams<{ grade?: string }>()
  const { setHeaderActions } = useHeaderActions()

  const dispatch = useAppDispatch()
  const { subjects: subjectRecords } = useAppSelector((state) => state.subjects)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [grades, setGrades] = useState<GroupedGrade[]>([])
  const [activeAcademicYear, setActiveAcademicYear] = useState<string | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const visibleGrades = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return grades
    return grades.filter(
      (g) =>
        `grade ${g.grade}`.includes(q) ||
        g.subjects?.some((sub) => sub.subject_name.toLowerCase().includes(q))
    )
  }, [grades, search])

  const subjects = subjectRecords.map((s) => ({
    value: s.id,
    label: s.subject_name,
  }))

  const fetchClasses = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const res = await apiClient.get<GroupedClassesResponse>(
        "/api/classes/grouped"
      )
      setGrades(
        toGroupedGrades(res.classes ?? {}, res.gradeSubjects, res.studentCounts)
      )
      setActiveAcademicYear(res.active_academic_year ?? null)
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClasses()
    dispatch(fetchSubjects())
  }, [fetchClasses, dispatch])

  useEffect(() => {
    if (!isAdmin) return
    setHeaderActions(
      <Button size="lg" onClick={() => setDrawerOpen(true)}>
        <PlusIcon className="size-3.5" />
        <span className="hidden sm:inline">Add Class Room</span>
      </Button>
    )
    return () => setHeaderActions(null)
  }, [isAdmin, setHeaderActions])

  const handleSaveClass = async (data: ClassFormData) => {
    setIsSaving(true)
    try {
      const classResults = await Promise.all(
        data.sections.map((section) =>
          apiClient.post<{ message: string; class: { id: string } }>(
            "/api/classes",
            {
              grade: data.grade,
              section: section.name,
              academic_year: data.academicYear,
            }
          )
        )
      )

      const allAssignments = classResults.flatMap((result, index) => {
        const classId = result.class.id
        const section = data.sections[index]

        const coreAssignments = section.subjects.map((subjectId) =>
          apiClient.post("/api/class-subjects", {
            class_id: classId,
            subject_id: subjectId,
          })
        )

        const electiveAssignments = section.electives.map((group) =>
          apiClient.post("/api/class-subjects", {
            class_id: classId,
            subject_type: "elective",
            subject_ids: group.subjectIds,
            elective_group_name: group.groupName,
          })
        )

        return [...coreAssignments, ...electiveAssignments]
      })

      await Promise.all(allAssignments)

      setDrawerOpen(false)
      fetchClasses()
    } catch (err) {
      console.error("Failed to create class:", err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex min-h-full flex-col gap-6 pb-12"
      )}
    >
      <PageHeader
        icon={ChalkboardIcon}
        title="Classes"
        description="Grades, sections and the subjects taught in each."
      >
        {isLoading && <PageToolbarSkeleton filters={false} />}
        {!isLoading && !error && grades.length > 0 && (
          <PageToolbar
            className="animate-in duration-300 fade-in-0"
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search by grade or subject…",
            }}
            summary={countSummary(
              visibleGrades.length,
              grades.length,
              "grade",
              search.trim().length > 0
            )}
          />
        )}
      </PageHeader>

      {/* Body */}
      <LoadingSwap
        loading={isLoading}
        className="flex-1"
        skeleton={
          <div
            aria-hidden
            className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @min-[60rem]:grid-cols-3 @min-[78rem]:grid-cols-4"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <ClassCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={fetchClasses}>
              Retry
            </Button>
          </div>
        ) : grades.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <ChalkboardIcon className="size-6 text-muted-foreground" />
            </div>
            <div className="flex max-w-[400px] flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-secondary-foreground">
                No classes have been added
              </p>
              <p className="text-sm text-muted-foreground">
                Create your first class room to start organizing grades,
                sections, and subjects for your school.
              </p>
            </div>
          </div>
        ) : visibleGrades.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <Sticker name="lost" size={120} />
            <div className="flex max-w-[360px] flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-secondary-foreground">
                No grade matches that
              </p>
              <p className="text-sm text-muted-foreground">
                Nothing called "{search.trim()}" here. Try a grade number or a
                subject name.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSearch("")}>
              Clear search
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @min-[60rem]:grid-cols-3 @min-[78rem]:grid-cols-4">
            {visibleGrades.map((grade) => (
              <ClassCard
                key={grade.grade}
                data={grade}
                activeAcademicYear={activeAcademicYear}
                onClick={() => navigate(`/classes/${grade.grade}/overview`)}
              />
            ))}
          </div>
        )}
      </LoadingSwap>

      <GradeOverviewSheet
        grade={openGrade ?? null}
        open={!!openGrade}
        onOpenChange={(open) => {
          if (!open) navigate("/classes")
        }}
      />

      {isAdmin && (
        <AddClassDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onSave={handleSaveClass}
          availableSubjects={subjects}
          existingGrades={grades.map((g) => Number(g.grade))}
          isSaving={isSaving}
        />
      )}
    </div>
  )
}
