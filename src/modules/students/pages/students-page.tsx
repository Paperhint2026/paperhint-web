import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeftIcon,
  GraduationCapIcon,
  PlusIcon,
} from "lucide-react"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  StudentClassCard,
  type ClassItem,
} from "@/modules/students/components/student-class-card"
import {
  StudentTable,
  type Student,
} from "@/modules/students/components/student-table"
import {
  AddStudentDrawer,
  type StudentEntry,
} from "@/modules/students/components/add-student-drawer"

interface ClassesResponse {
  classes: ClassItem[]
}

interface StudentCountResponse {
  class_id: string
  count: number
}

interface StudentsResponse {
  students: Student[]
}

export function StudentsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  // Detail view state
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const fetchClasses = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const res = await apiClient.get<ClassesResponse>("/api/classes")
      const items = res.classes ?? []
      items.sort((a, b) => {
        if (a.grade !== b.grade) return a.grade - b.grade
        return a.section.localeCompare(b.section)
      })
      setClasses(items)

      if (items.length > 0) {
        const counts = await Promise.all(
          items.map((c) =>
            apiClient
              .get<StudentCountResponse>(`/api/students/count/${c.id}`)
              .catch(() => ({ class_id: c.id, count: 0 })),
          ),
        )
        const countMap: Record<string, number> = {}
        for (const c of counts) {
          countMap[c.class_id] = c.count
        }
        setStudentCounts(countMap)
      }
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
  }, [fetchClasses])

  const handleClassClick = async (classItem: ClassItem) => {
    setSelectedClass(classItem)
    setIsLoadingStudents(true)
    try {
      const res = await apiClient.get<StudentsResponse>(
        `/api/students/class/${classItem.id}`,
      )
      setStudents(res.students ?? [])
    } catch (err) {
      console.error("Failed to fetch students:", err)
      setStudents([])
    } finally {
      setIsLoadingStudents(false)
    }
  }

  const handleBack = () => {
    setSelectedClass(null)
    setStudents([])
  }

  const handleSaveStudents = async (entries: StudentEntry[]) => {
    if (!selectedClass) return
    setIsSaving(true)
    try {
      await Promise.all(
        entries.map((entry) =>
          apiClient.post("/api/students", {
            class_id: selectedClass.id,
            full_name: entry.full_name,
            roll_number: entry.roll_number,
            register_number: entry.register_number,
          }),
        ),
      )

      setDrawerOpen(false)

      const res = await apiClient.get<StudentsResponse>(
        `/api/students/class/${selectedClass.id}`,
      )
      setStudents(res.students ?? [])

      setStudentCounts((prev) => ({
        ...prev,
        [selectedClass.id]: (res.students ?? []).length,
      }))
    } catch (err) {
      console.error("Failed to create students:", err)
    } finally {
      setIsSaving(false)
    }
  }

  // Detail view for a selected class
  if (selectedClass) {
    const classLabel = `Grade ${selectedClass.grade} – Section ${selectedClass.section}`

    return (
      <div className="flex min-h-full w-full flex-col gap-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeftIcon />
            </Button>
            <div className="flex flex-1 flex-col">
              <h1 className="text-lg font-medium text-secondary-foreground">
                {classLabel}
              </h1>
            </div>
          </div>
          {isAdmin && (
            <Button size="lg" onClick={() => setDrawerOpen(true)} className="w-full sm:w-auto">
              <PlusIcon />
              Add Students
            </Button>
          )}
        </div>

        {/* Body */}
        {isLoadingStudents ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg bg-sidebar p-5">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <GraduationCapIcon className="size-6 text-muted-foreground" />
            </div>
            <div className="flex max-w-[400px] flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-secondary-foreground">
                No students yet
              </p>
              <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? `Add students to ${classLabel} manually or by uploading a CSV file.`
                  : `No students have been added to ${classLabel} yet.`}
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => setDrawerOpen(true)}>
                <PlusIcon />
                Add Students
              </Button>
            )}
          </div>
        ) : (
          <StudentTable students={students} />
        )}

        {isAdmin && (
          <AddStudentDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            onSave={handleSaveStudents}
            classLabel={classLabel}
            isSaving={isSaving}
          />
        )}
      </div>
    )
  }

  // Class list view
  return (
    <div className="flex min-h-full w-full flex-col gap-6 p-4 md:p-6">
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
      ) : classes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg bg-sidebar p-5">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <GraduationCapIcon className="size-6 text-muted-foreground" />
          </div>
          <div className="flex max-w-[400px] flex-col items-center gap-1 text-center">
            <p className="text-base font-medium text-secondary-foreground">
              No classes found
            </p>
            <p className="text-sm text-muted-foreground">
              Create classes first in the Classes module, then come back here to
              manage students.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {classes.map((classItem) => (
            <StudentClassCard
              key={classItem.id}
              classItem={classItem}
              studentCount={studentCounts[classItem.id] ?? null}
              onClick={() => handleClassClick(classItem)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
