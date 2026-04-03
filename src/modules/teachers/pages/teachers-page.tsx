import { useCallback, useEffect, useState } from "react"
import { ContactRoundIcon, PlusIcon } from "lucide-react"
import dayjs from "dayjs"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  TeacherCard,
  type Teacher,
} from "@/modules/teachers/components/teacher-card"
import {
  AddTeacherDrawer,
  type ClassSubjectOption,
  type ExistingAssignment,
  type TeacherFormData,
} from "@/modules/teachers/components/add-teacher-drawer"

interface Department {
  id: string
  school_id: string
  name: string
  created_at?: string
}

interface ClassItem {
  id: string
  grade: number
  section: string
  academic_year: string
}

interface ClassByIdSubject {
  class_subject_id: string
  id: string
  subject_name: string
}

interface ClassByIdResponse {
  class: ClassItem
  subjects: ClassByIdSubject[]
}

export function TeachersPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  // Form data (only fetched for admins, in background)
  const [departments, setDepartments] = useState<Department[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [isFormDataReady, setIsFormDataReady] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editData, setEditData] = useState<TeacherFormData | null>(null)
  const [editTeacherId, setEditTeacherId] = useState<string | null>(null)

  const departmentMap = new Map(departments.map((d) => [d.id, d.name]))

  const departmentOptions = departments.map((d) => ({
    value: d.id,
    label: d.name,
  }))

  const classOptions = classes.map((c) => ({
    value: c.id,
    label: `Grade ${c.grade} – ${c.section}`,
  }))

  const fetchTeachers = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const res = await apiClient.get<{ teachers: Teacher[] }>(
        "/api/auth/teachers",
      )
      setTeachers(res.teachers ?? [])
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchFormData = useCallback(async () => {
    try {
      const [deptRes, classRes] = await Promise.all([
        apiClient.get<{ departments: Department[] }>(
          "/api/schools/departments",
        ),
        apiClient.get<{ classes: ClassItem[] }>("/api/classes"),
      ])
      setDepartments(deptRes.departments ?? [])
      const items = classRes.classes ?? []
      items.sort((a, b) => {
        if (a.grade !== b.grade) return a.grade - b.grade
        return a.section.localeCompare(b.section)
      })
      setClasses(items)
      setIsFormDataReady(true)
    } catch (err) {
      console.error("Failed to fetch form data:", err)
    }
  }, [])

  useEffect(() => {
    fetchTeachers()
    fetchFormData()
  }, [fetchTeachers, fetchFormData])

  const fetchSubjectsForClass = async (
    classId: string,
  ): Promise<ClassSubjectOption[]> => {
    const res = await apiClient.get<ClassByIdResponse>(
      `/api/classes/${classId}`,
    )
    return (res.subjects ?? []).map((s) => ({
      subjectId: s.id,
      subjectName: s.subject_name,
      classSubjectId: s.class_subject_id,
    }))
  }

  const handleEditTeacher = async (teacherId: string) => {
    try {
      const res = await apiClient.get<{
        teacher: {
          id: string
          full_name: string
          email: string
          profile_url?: string | null
          department_id?: string | null
          designation?: string | null
          date_of_joining?: number | string | null
          phone_number?: string | null
          assignments?: {
            class_subject_id: string
            class: { id: string; grade: number | string; section: string }
            subject: { id: string; subject_name: string }
          }[]
        }
      }>(`/api/auth/teacher/${teacherId}/overview`)

      const t = res.teacher

      const existingAssignments: ExistingAssignment[] =
        t.assignments?.map((a) => ({
          classSubjectId: a.class_subject_id,
          className: `Grade ${a.class?.grade} – ${a.class?.section}`,
          subjectName: a.subject?.subject_name ?? "",
        })) ?? []

      setEditTeacherId(teacherId)
      setEditData({
        fullName: t.full_name || "",
        email: t.email || "",
        phone: t.phone_number || "",
        profileUrl: t.profile_url || "",
        departmentId: t.department_id || "",
        designation: t.designation || "",
        dateOfJoining: t.date_of_joining
          ? new Date(t.date_of_joining)
          : undefined,
        classSubjects: [{ classId: "", classSubjectId: "" }],
        existingAssignments,
      })
      setDrawerOpen(true)
    } catch (err) {
      console.error("Failed to fetch teacher details:", err)
    }
  }

  const handleDisassociate = async (
    tId: string,
    classSubjectId: string,
  ) => {
    await apiClient.post("/api/teacher-assignments/unassign", {
      teacher_id: tId,
      class_subject_id: classSubjectId,
    })
  }

  const handleSaveTeacher = async (data: TeacherFormData) => {
    setIsSaving(true)
    try {
      let teacherId: string

      if (editTeacherId) {
        teacherId = editTeacherId
        await apiClient.put(`/api/auth/teacher/${teacherId}`, {
          full_name: data.fullName,
          department_id: data.departmentId,
          designation: data.designation || undefined,
          date_of_joining: data.dateOfJoining
            ? dayjs(data.dateOfJoining).valueOf()
            : undefined,
          profile_url: data.profileUrl || undefined,
          phone_number: data.phone || undefined,
        })
      } else {
        const res = await apiClient.post<{
          message: string
          teacher: { id: string }
      }>("/api/auth/create-teacher", {
        email: data.email,
        full_name: data.fullName,
        department_id: data.departmentId,
        designation: data.designation || undefined,
        date_of_joining: data.dateOfJoining
          ? dayjs(data.dateOfJoining).valueOf()
          : undefined,
        profile_url: data.profileUrl || undefined,
        phone_number: data.phone || undefined,
      })
        teacherId = res.teacher.id
      }

      const newAssignments = data.classSubjects.filter(
        (entry) => entry.classId && entry.classSubjectId,
      )

      if (newAssignments.length > 0) {
        await Promise.all(
          newAssignments.map((entry) =>
            apiClient.post("/api/teacher-assignments", {
              teacher_id: teacherId,
              class_subject_id: entry.classSubjectId,
            }),
          ),
        )
      }

      setDrawerOpen(false)
      setEditData(null)
      setEditTeacherId(null)
      fetchTeachers()
    } catch (err) {
      console.error("Failed to save teacher:", err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex size-full flex-col gap-6 overflow-y-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-col">
          <h1 className="text-lg font-medium text-secondary-foreground">
            Manage Teachers
          </h1>
          <p className="text-sm text-muted-foreground">
            Keep track of who teaches what, and where
          </p>
        </div>
        {isAdmin && (
          <Button
            size="lg"
            disabled={!isFormDataReady}
            className="w-full sm:w-auto"
            onClick={() => {
              setEditData(null)
              setEditTeacherId(null)
              setDrawerOpen(true)
            }}
          >
            <PlusIcon />
            Add Teacher
          </Button>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-6" />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg bg-sidebar p-5">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={fetchTeachers}>
            Retry
          </Button>
        </div>
      ) : teachers.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg bg-sidebar p-5">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <ContactRoundIcon className="size-6 text-muted-foreground" />
          </div>
          <div className="flex max-w-[400px] flex-col items-center gap-1 text-center">
            <p className="text-base font-medium text-secondary-foreground">
              No teachers have been added
            </p>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "Easily add teachers to your system and assign them to classes and subjects."
                : "No teachers have been added to your school yet."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {teachers.map((teacher) => (
            <TeacherCard
              key={teacher.id}
              teacher={teacher}
              departmentName={
                teacher.department_id
                  ? departmentMap.get(teacher.department_id)
                  : undefined
              }
              onEdit={isAdmin ? handleEditTeacher : undefined}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <AddTeacherDrawer
          open={drawerOpen}
          onOpenChange={(open) => {
            setDrawerOpen(open)
            if (!open) {
              setEditData(null)
              setEditTeacherId(null)
            }
          }}
          onSave={handleSaveTeacher}
          onDisassociate={handleDisassociate}
          teacherId={editTeacherId}
          departments={departmentOptions}
          classes={classOptions}
          fetchSubjectsForClass={fetchSubjectsForClass}
          isSaving={isSaving}
          editData={editData}
        />
      )}
    </div>
  )
}
