import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  BriefcaseIcon,
  CircleNotchIcon,
  IdentificationBadgeIcon,
  IdentificationCardIcon,
  PlusIcon,
  PulseIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { useHeaderActions } from "@/components/layout/header-actions-context"
import dayjs from "dayjs"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import {
  FilterPill,
  PageToolbar,
  PageToolbarSkeleton,
} from "@/components/shared/page-toolbar"
import { countSummary } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Sticker } from "@/components/shared/sticker"
import {
  FilterChip,
  FilterChipGroup,
  FilterFieldHeader,
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

/** The staff grid before the list arrives: the same columns and card shape
 *  as TeacherCard — photo beside a two-line identity, then three record rows
 *  under the dashed rule — so the page settles in place instead of jumping. */
function TeacherGridSkeleton() {
  return (
    <div
      aria-hidden
      className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @min-[60rem]:grid-cols-3 @min-[78rem]:grid-cols-4"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="relative flex flex-col rounded-xl border border-border bg-background"
        >
          <Skeleton className="absolute top-2.5 right-2.5 h-5 w-14 rounded-full" />
          <div className="flex items-center gap-3.5 px-4 py-4">
            <Skeleton className="size-12 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pr-16">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-dashed border-border px-4 py-3">
            {[0.4, 0.3, 0.55].map((w, j) => (
              <div key={j} className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3" style={{ width: `${w * 100}%` }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

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
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(
    null
  )

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
        (t) => t.department_id && selectedDepartments.includes(t.department_id)
      )
    }
    if (selectedStatuses.length > 0) {
      list = list.filter((t) => t.status && selectedStatuses.includes(t.status))
    }
    if (selectedDesignations.length > 0) {
      list = list.filter(
        (t) => t.designation && selectedDesignations.includes(t.designation)
      )
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.full_name.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          t.designation?.toLowerCase().includes(q)
      )
    }
    return list
  }, [
    teachers,
    selectedDepartments,
    selectedStatuses,
    selectedDesignations,
    search,
  ])

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
        "/api/auth/teachers"
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
          "/api/schools/departments"
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
    classId: string
  ): Promise<ClassSubjectOption[]> => {
    const res = await apiClient.get<ClassByIdResponse>(
      `/api/classes/${classId}`
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

  const handleDisassociate = async (tId: string, classSubjectId: string) => {
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
            console.error(
              "Failed to upload profile image for new teacher:",
              err
            )
          }
        }
      }

      const newAssignments = data.classSubjects.filter(
        (entry) => entry.classId && entry.classSubjectId
      )

      if (newAssignments.length > 0) {
        await Promise.all(
          newAssignments.map((entry) =>
            apiClient.post("/api/teacher-assignments", {
              teacher_id: teacherId,
              class_subject_id: entry.classSubjectId,
            })
          )
        )
      }

      setDrawerOpen(false)
      setEditData(null)
      setEditTeacherId(null)
      fetchTeachers()
      toast.success(editTeacherId ? "Teacher updated" : "Teacher added")
    } catch (err) {
      console.error("Failed to save teacher:", err)
      // surface the API error (e.g. "email already registered") — the drawer
      // stays open with the form intact so the admin can correct and retry
      toast.error(err instanceof Error ? err.message : "Failed to save teacher")
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

  const hasAnyFilter = activeCount > 0 || search.trim().length > 0

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex min-h-full flex-col gap-5 pb-12"
      )}
    >
      <PageHeader
        icon={IdentificationCardIcon}
        title="Teachers"
        description="Staff in your school and what they teach."
      >
        {/* Filters — search + popover + active-filter chips */}
        {isLoading && <PageToolbarSkeleton />}
        {!isLoading && !error && teachers.length > 0 && (
          <PageToolbar
            className="animate-in duration-300 fade-in-0"
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search by name or email…",
            }}
            summary={countSummary(
              filteredTeachers.length,
              teachers.length,
              "teacher",
              hasAnyFilter
            )}
            filters={{
              activeCount,
              onClearAll: clearAllFilters,
              resultLabel: `${filteredTeachers.length} of ${teachers.length} teachers`,
              children: (
                <>
                  <MultiSelectField
                    icon={BriefcaseIcon}
                    label="Department"
                    placeholder={
                      departmentOptions.length === 0
                        ? "No departments yet"
                        : "Any department"
                    }
                    options={departmentOptions}
                    selected={selectedDepartments}
                    onToggle={(v) =>
                      toggleArrayValue(setSelectedDepartments, v)
                    }
                    onClear={() => setSelectedDepartments([])}
                    searchable={departmentOptions.length > 8}
                  />
                  <MultiSelectField
                    icon={IdentificationBadgeIcon}
                    label="Designation"
                    placeholder={
                      designationOptions.length === 0
                        ? "No designations yet"
                        : "Any designation"
                    }
                    options={designationOptions}
                    selected={selectedDesignations}
                    onToggle={(v) =>
                      toggleArrayValue(setSelectedDesignations, v)
                    }
                    onClear={() => setSelectedDesignations([])}
                    searchable={designationOptions.length > 8}
                  />
                  <div className="flex flex-col gap-2">
                    <FilterFieldHeader
                      icon={PulseIcon}
                      label="Status"
                      count={selectedStatuses.length}
                      onClear={() => setSelectedStatuses([])}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_OPTIONS.map((st) => (
                        <FilterPill
                          key={st}
                          label={STATUS_LABEL[st]}
                          selected={selectedStatuses.includes(st)}
                          onToggle={() =>
                            toggleArrayValue(setSelectedStatuses, st)
                          }
                        />
                      ))}
                    </div>
                  </div>
                </>
              ),
            }}
            chips={
              <>
                {selectedDepartments.length > 0 && (
                  <FilterChipGroup icon={BriefcaseIcon} label="Department">
                    {selectedDepartments.map((d) => (
                      <FilterChip
                        key={`dept-${d}`}
                        label={departmentMap.get(d) ?? d}
                        onRemove={() =>
                          toggleArrayValue(setSelectedDepartments, d)
                        }
                      />
                    ))}
                  </FilterChipGroup>
                )}
                {selectedDesignations.length > 0 && (
                  <FilterChipGroup
                    icon={IdentificationBadgeIcon}
                    label="Designation"
                  >
                    {selectedDesignations.map((d) => (
                      <FilterChip
                        key={`desig-${d}`}
                        label={d}
                        onRemove={() =>
                          toggleArrayValue(setSelectedDesignations, d)
                        }
                      />
                    ))}
                  </FilterChipGroup>
                )}
                {selectedStatuses.length > 0 && (
                  <FilterChipGroup icon={PulseIcon} label="Status">
                    {selectedStatuses.map((st) => (
                      <FilterChip
                        key={`status-${st}`}
                        label={STATUS_LABEL[st] ?? st}
                        onRemove={() =>
                          toggleArrayValue(setSelectedStatuses, st)
                        }
                      />
                    ))}
                  </FilterChipGroup>
                )}
              </>
            }
          />
        )}
      </PageHeader>

      {/* Body */}
      <LoadingSwap
        loading={isLoading}
        skeleton={<TeacherGridSkeleton />}
        className="flex-1"
      >
        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <Sticker name="worried" size={88} />
            <div className="flex max-w-[360px] flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-secondary-foreground">
                Couldn't load the staff list
              </p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" onClick={fetchTeachers}>
              Try again
            </Button>
          </div>
        ) : teachers.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 p-5">
            <Sticker name="classroom" size={220} />
            <div className="flex max-w-[380px] flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-secondary-foreground">
                The staff room is empty
              </p>
              <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? "Add your first teacher and they'll show up here, ready to be assigned classes and subjects."
                  : "No teachers have joined your school yet. Check back once your admin adds them."}
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => setDrawerOpen(true)}>
                <PlusIcon className="size-3.5" />
                Add a teacher
              </Button>
            )}
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <Sticker name="lost" size={120} />
            <div className="flex max-w-[360px] flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-secondary-foreground">
                Nobody matches that
              </p>
              <p className="text-sm text-muted-foreground">
                {search.trim()
                  ? `No teacher named "${search.trim()}" with these filters. Try a shorter name or loosen a filter.`
                  : "No teacher fits every filter at once. Try dropping one."}
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
          <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @min-[60rem]:grid-cols-3 @min-[78rem]:grid-cols-4">
            {filteredTeachers.map((teacher) => (
              <TeacherCard
                key={teacher.id}
                teacher={teacher}
                departmentName={
                  teacher.department_id
                    ? departmentMap.get(teacher.department_id)
                    : undefined
                }
                onView={(id) => {
                  setSelectedTeacherId(id)
                  setDetailDrawerOpen(true)
                }}
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
      </LoadingSwap>

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
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <TrashIcon className="size-3.5" />
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
