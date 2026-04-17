import { useCallback, useEffect, useMemo, useState } from "react"
import { ContactRoundIcon, Loader2Icon, PlusIcon, SearchIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react"
import { useHeaderActions } from "@/components/layout/header-actions-context"
import dayjs from "dayjs"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import {
  FilterChip,
  MultiSelectField,
  toggleArrayValue,
} from "@/components/shared/filter-controls"
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
  TeacherCard,
  type Teacher,
} from "@/modules/teachers/components/teacher-card"
import { TeacherDetailDrawer } from "@/modules/teachers/components/teacher-detail-drawer"
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
  const { setHeaderActions } = useHeaderActions()

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

  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)

  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [search, setSearch] = useState("")
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedDesignations, setSelectedDesignations] = useState<string[]>([])

  const STATUS_OPTIONS = ["active", "invited", "inactive"]
  const STATUS_LABEL: Record<string, string> = {
    active: "Active",
    invited: "Invited",
    inactive: "Inactive",
  }

  const designationOptions = useMemo(() => {
    const set = new Set<string>()
    teachers.forEach((t) => {
      if (t.designation) set.add(t.designation)
    })
    return [...set].sort().map((d) => ({ value: d, label: d }))
  }, [teachers])

  const filteredTeachers = useMemo(() => {
    let list = teachers
    if (selectedDepartments.length > 0) {
      list = list.filter(
        (t) => t.department_id && selectedDepartments.includes(t.department_id),
      )
    }
    if (selectedStatuses.length > 0) {
      list = list.filter((t) => t.status && selectedStatuses.includes(t.status))
    }
    if (selectedDesignations.length > 0) {
      list = list.filter(
        (t) => t.designation && selectedDesignations.includes(t.designation),
      )
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.full_name.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          t.designation?.toLowerCase().includes(q),
      )
    }
    return list
  }, [teachers, selectedDepartments, selectedStatuses, selectedDesignations, search])

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

  useEffect(() => {
    if (!isAdmin) return
    setHeaderActions(
      <Button
        size="lg"
        disabled={!isFormDataReady}
        className="rounded-full"
        onClick={() => {
          setEditData(null)
          setEditTeacherId(null)
          setDrawerOpen(true)
        }}
      >
        <PlusIcon className="size-3.5" />
        <span className="hidden sm:inline">Add Teacher</span>
      </Button>
    )
    return () => setHeaderActions(null)
  }, [isAdmin, isFormDataReady, setHeaderActions])

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

  const handleConfirmDelete = async () => {
    if (!teacherToDelete) return
    setIsDeleting(true)
    try {
      await apiClient.delete(`/api/auth/teacher/${teacherToDelete.id}`)
      setTeacherToDelete(null)
      await fetchTeachers()
    } catch (err) {
      console.error("Failed to delete teacher:", err)
    } finally {
      setIsDeleting(false)
    }
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
        phone_number: data.phone || undefined,
      })
        teacherId = res.teacher.id

        if (data.pendingProfileFile) {
          try {
            const formData = new FormData()
            formData.append("image", data.pendingProfileFile)
            formData.append("user_id", teacherId)

            const token = localStorage.getItem("access_token")
            const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

            await fetch(`${BASE_URL}/api/auth/upload-profile`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
            })
          } catch (err) {
            console.error("Failed to upload profile image for new teacher:", err)
          }
        }
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

  const activeCount =
    selectedDepartments.length +
    selectedStatuses.length +
    selectedDesignations.length

  const clearAllFilters = () => {
    setSelectedDepartments([])
    setSelectedStatuses([])
    setSelectedDesignations([])
  }

  const renderStatusPill = (value: string) => {
    const selected = selectedStatuses.includes(value)
    return (
      <button
        key={value}
        type="button"
        onClick={() => toggleArrayValue(setSelectedStatuses, value)}
        className={
          "rounded-full border px-2.5 py-1 text-xs transition-colors " +
          (selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-secondary-foreground hover:bg-muted")
        }
      >
        {STATUS_LABEL[value]}
      </button>
    )
  }

  const hasAnyFilter = activeCount > 0 || search.trim().length > 0

  return (
    <div className="flex min-h-full w-full flex-col gap-4 p-4 md:p-6">
      {/* Filters — search + popover + active-filter chips */}
      {!isLoading && !error && teachers.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-72">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search teachers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-full pl-9"
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 rounded-full">
                  <SlidersHorizontalIcon className="size-3.5" />
                  Filters
                  {activeCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px]"
                    >
                      {activeCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-medium">Filters</p>
                  {activeCount > 0 && (
                    <button
                      onClick={clearAllFilters}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="flex max-h-[60vh] flex-col gap-4 overflow-auto p-4">
                  <MultiSelectField
                    label="Department"
                    placeholder={
                      departmentOptions.length === 0
                        ? "No departments available"
                        : "All Departments"
                    }
                    options={departmentOptions}
                    selected={selectedDepartments}
                    onToggle={(v) => toggleArrayValue(setSelectedDepartments, v)}
                    onClear={() => setSelectedDepartments([])}
                    searchable={departmentOptions.length > 8}
                  />
                  <MultiSelectField
                    label="Designation"
                    placeholder={
                      designationOptions.length === 0
                        ? "No designations available"
                        : "All Designations"
                    }
                    options={designationOptions}
                    selected={selectedDesignations}
                    onToggle={(v) => toggleArrayValue(setSelectedDesignations, v)}
                    onClear={() => setSelectedDesignations([])}
                    searchable={designationOptions.length > 8}
                  />
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Status</p>
                      {selectedStatuses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedStatuses([])}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_OPTIONS.map((s) => renderStatusPill(s))}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {activeCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedDepartments.map((d) => (
                <FilterChip
                  key={`dept-${d}`}
                  label={departmentMap.get(d) ?? d}
                  onRemove={() => toggleArrayValue(setSelectedDepartments, d)}
                />
              ))}
              {selectedDesignations.map((d) => (
                <FilterChip
                  key={`desig-${d}`}
                  label={d}
                  onRemove={() => toggleArrayValue(setSelectedDesignations, d)}
                />
              ))}
              {selectedStatuses.map((s) => (
                <FilterChip
                  key={`status-${s}`}
                  label={STATUS_LABEL[s] ?? s}
                  onRemove={() => toggleArrayValue(setSelectedStatuses, s)}
                />
              ))}
              <button
                onClick={clearAllFilters}
                className="ml-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

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
      ) : filteredTeachers.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg bg-sidebar p-5">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <ContactRoundIcon className="size-6 text-muted-foreground" />
          </div>
          <div className="flex max-w-[400px] flex-col items-center gap-1 text-center">
            <p className="text-base font-medium text-secondary-foreground">
              No teachers match your filters
            </p>
            <p className="text-sm text-muted-foreground">
              Try removing a filter or clearing the search.
            </p>
          </div>
          {hasAnyFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("")
                clearAllFilters()
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTeachers.map((teacher) => (
            <TeacherCard
              key={teacher.id}
              teacher={teacher}
              departmentName={
                teacher.department_id
                  ? departmentMap.get(teacher.department_id)
                  : undefined
              }
              onView={(id) => { setSelectedTeacherId(id); setDetailDrawerOpen(true) }}
              onEdit={isAdmin ? handleEditTeacher : undefined}
              onDelete={
                isAdmin
                  ? (id) => {
                      const t = teachers.find((x) => x.id === id) ?? null
                      setTeacherToDelete(t)
                    }
                  : undefined
              }
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

      <AlertDialog
        open={!!teacherToDelete}
        onOpenChange={(open) => !open && setTeacherToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete teacher?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium text-foreground">
                {teacherToDelete?.full_name}
              </span>{" "}
              and their assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2Icon className="size-3.5" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TeacherDetailDrawer
        teacherId={selectedTeacherId}
        open={detailDrawerOpen}
        onOpenChange={setDetailDrawerOpen}
        canManage={isAdmin}
        onEdit={(id) => {
          setDetailDrawerOpen(false)
          handleEditTeacher(id)
        }}
        onDeleted={() => {
          setSelectedTeacherId(null)
          fetchTeachers()
        }}
      />
    </div>
  )
}
