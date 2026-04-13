import { useCallback, useEffect, useState } from "react"
import { PlusIcon, SchoolIcon } from "lucide-react"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { useAppDispatch, useAppSelector } from "@/store"
import { fetchSubjects } from "@/store/subjects-slice"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  ClassCard,
  type ClassRecord,
  type GroupedGrade,
} from "@/modules/classes/components/class-card"
import {
  AddClassDrawer,
  type ClassFormData,
} from "@/modules/classes/components/add-class-drawer"

interface GroupedClassesResponse {
  classes: Record<string, ClassRecord[]>
}

function toGroupedGrades(
  grouped: Record<string, ClassRecord[]>,
): GroupedGrade[] {
  return Object.entries(grouped)
    .map(([grade, records]) => ({
      grade,
      academicYear: records[0]?.academic_year ?? "",
      sections: records,
    }))
    .sort((a, b) => Number(a.grade) - Number(b.grade))
}

export function ClassesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  const dispatch = useAppDispatch()
  const { subjects: subjectRecords } = useAppSelector(
    (state) => state.subjects,
  )

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [grades, setGrades] = useState<GroupedGrade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const subjects = subjectRecords.map((s) => ({
    value: s.id,
    label: s.subject_name,
  }))

  const fetchClasses = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const res = await apiClient.get<GroupedClassesResponse>(
        "/api/classes/grouped",
      )
      setGrades(toGroupedGrades(res.classes ?? {}))
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
            },
          ),
        ),
      )

      const subjectAssignments = classResults.flatMap((result, index) => {
        const classId = result.class.id
        const sectionSubjects = data.sections[index].subjects
        return sectionSubjects.map((subjectId) =>
          apiClient.post("/api/class-subjects", {
            class_id: classId,
            subject_id: subjectId,
          }),
        )
      })

      await Promise.all(subjectAssignments)

      setDrawerOpen(false)
      fetchClasses()
    } catch (err) {
      console.error("Failed to create class:", err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-full w-full flex-col gap-6 p-4 md:p-6">
      {isAdmin ? (
        <div className="flex justify-end">
          <Button size="lg" onClick={() => setDrawerOpen(true)} className="w-full sm:w-auto">
            <PlusIcon />
            Add Class Room
          </Button>
        </div>
      ) : null}

      {/* Body */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-6" />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg bg-sidebar p-5">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={fetchClasses}>
            Retry
          </Button>
        </div>
      ) : grades.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg bg-sidebar p-5">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <SchoolIcon className="size-6 text-muted-foreground" />
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
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {grades.map((grade) => (
            <ClassCard key={grade.grade} data={grade} />
          ))}
        </div>
      )}

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
