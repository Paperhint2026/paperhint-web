import { useCallback, useEffect, useMemo, useState } from "react"
import { differenceInYears } from "date-fns"
import {
  ArrowsSplitIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChalkboardIcon,
  CircleNotchIcon,
  DotsThreeIcon,
  DropIcon,
  GenderIntersexIcon,
  GraduationCapIcon,
  HashIcon,
  IdentificationBadgeIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import {
  FilterChip,
  FilterChipGroup,
  FilterFieldHeader,
  MultiSelectField,
  toggleArrayValue,
} from "@/components/shared/filter-controls"
import {
  FilterPill,
  PageToolbar,
  PageToolbarSkeleton,
} from "@/components/shared/page-toolbar"
import { countSummary } from "@/lib/format"
import { useHeaderActions } from "@/components/layout/header-actions-context"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Sticker } from "@/components/shared/sticker"
import { GroupedList, ListGroup } from "@/components/shared/list-group"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type ClassItem } from "@/modules/students/components/student-class-card"
import {
  AddStudentDrawer,
  type StudentEntry,
  type ElectiveChoice,
} from "@/modules/students/components/add-student-drawer"
import { StudentDetailDrawer } from "@/modules/students/components/student-detail-drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { type Student } from "@/modules/students/components/student-table"

/* Desk colour follows the student, not the grade: the lightest tint of blue
   for boys, rose for girls, the paper ground when gender is not recorded. */
const GENDER_WASH: Record<string, string> = {
  Male: "bg-sky-100 dark:bg-sky-950/40",
  Female: "bg-rose-100 dark:bg-rose-950/40",
  default: "bg-muted",
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

interface StudentWithClass extends Omit<
  Student,
  "grade" | "section" | "academic_year"
> {
  grade: number
  section: string
  academic_year: string
}

interface ClassesResponse {
  classes: ClassItem[]
}

interface StudentsResponse {
  students: Student[]
}

/** One desk in the seating chart, unfilled: the tinted band with a roll
 *  number, the avatar hanging off it, two identity lines, then the record
 *  rows under the dashed rule. Same grid as the loaded roster. */
function DeskSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex h-8 items-start justify-between bg-muted/60 px-3 pt-1.5">
        <Skeleton className="h-3 w-5 bg-background/70" />
        <Skeleton className="h-3 w-7 bg-background/70" />
      </div>
      <div className="-mt-4 flex justify-center">
        <Skeleton className="size-10 rounded-full ring-4 ring-background" />
      </div>
      <div className="flex flex-col items-center gap-1.5 px-3 pt-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="mt-3 flex flex-col gap-2 border-t border-dashed border-border px-4 py-3">
        {[0.45, 0.35, 0.5].map((w, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3" style={{ width: `${w * 100}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The roster before it loads: two section groups, each a pill heading over
 *  a seating-chart grid, so the page keeps its shape while students arrive. */
function RosterSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      {[8, 4].map((desks, g) => (
        <section
          key={g}
          className="flex flex-col border-t border-border py-5 first-of-type:border-t-0 first-of-type:pt-0"
        >
          <header className="flex items-center pb-2">
            <Skeleton className="h-6 w-44 rounded-full" />
          </header>
          <div className="-mx-3 grid grid-cols-2 gap-3 px-3 pt-1 @2xl:grid-cols-3 @5xl:grid-cols-4">
            {Array.from({ length: desks }).map((_, i) => (
              <DeskSkeleton key={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function StudentsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const { setHeaderActions } = useHeaderActions()

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [allStudents, setAllStudents] = useState<StudentWithClass[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [selectedGrades, setSelectedGrades] = useState<string[]>([])
  const [selectedSections, setSelectedSections] = useState<string[]>([])
  const [selectedGenders, setSelectedGenders] = useState<string[]>([])
  const [selectedBloodGroups, setSelectedBloodGroups] = useState<string[]>([])

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  )

  const [studentToDelete, setStudentToDelete] =
    useState<StudentWithClass | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [editStudentId, setEditStudentId] = useState<string | null>(null)
  const [editInitialData, setEditInitialData] = useState<StudentEntry | null>(
    null
  )
  const [isLoadingEdit, setIsLoadingEdit] = useState(false)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const res = await apiClient.get<ClassesResponse>("/api/classes")
      const items = (res.classes ?? []).sort((a, b) => {
        if (a.grade !== b.grade) return a.grade - b.grade
        return a.section.localeCompare(b.section)
      })
      setClasses(items)

      const studentResults = await Promise.all(
        items.map((c) =>
          apiClient
            .get<StudentsResponse>(`/api/students/class/${c.id}`)
            .then((r) =>
              (r.students ?? []).map((s) => ({
                ...s,
                grade: c.grade,
                section: c.section,
                academic_year: c.academic_year,
              }))
            )
            .catch(() => [] as StudentWithClass[])
        )
      )
      setAllStudents(studentResults.flat())
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Unique grades from classes
  const grades = useMemo(
    () =>
      [...new Set(classes.map((c) => String(c.grade)))].sort(
        (a, b) => Number(a) - Number(b)
      ),
    [classes]
  )

  // Sections available for the selected grades
  const sections = useMemo(() => {
    const pool =
      selectedGrades.length === 0
        ? classes
        : classes.filter((c) => selectedGrades.includes(String(c.grade)))
    return [...new Set(pool.map((c) => c.section))].sort()
  }, [classes, selectedGrades])

  const GENDER_OPTIONS = ["Male", "Female", "Other"]
  const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

  // Drop selected sections that aren't valid for the current grades anymore
  useEffect(() => {
    setSelectedSections((prev) => prev.filter((s) => sections.includes(s)))
  }, [sections])

  // The class matching a single grade+section pair (for Add Students)
  const selectedClass = useMemo(() => {
    if (selectedGrades.length !== 1 || selectedSections.length !== 1)
      return null
    return (
      classes.find(
        (c) =>
          String(c.grade) === selectedGrades[0] &&
          c.section === selectedSections[0]
      ) ?? null
    )
  }, [classes, selectedGrades, selectedSections])

  // Filtered students
  const filtered = useMemo(() => {
    let list = allStudents
    if (selectedGrades.length > 0)
      list = list.filter((s) => selectedGrades.includes(String(s.grade)))
    if (selectedSections.length > 0)
      list = list.filter((s) => selectedSections.includes(s.section))
    if (selectedGenders.length > 0)
      list = list.filter((s) => s.gender && selectedGenders.includes(s.gender))
    if (selectedBloodGroups.length > 0)
      list = list.filter(
        (s) => s.blood_group && selectedBloodGroups.includes(s.blood_group)
      )
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          String(s.roll_number).includes(q) ||
          s.register_number?.toLowerCase().includes(q) ||
          s.admission_number?.toLowerCase().includes(q)
      )
    }
    return list
  }, [
    allStudents,
    selectedGrades,
    selectedSections,
    selectedGenders,
    selectedBloodGroups,
    search,
  ])

  // Reset to page 1 when filters, search, or page size change
  useEffect(() => {
    setPage(1)
  }, [
    search,
    selectedGrades,
    selectedSections,
    selectedGenders,
    selectedBloodGroups,
    pageSize,
  ])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginatedStudents = filtered.slice(
    (page - 1) * pageSize,
    page * pageSize
  )

  // Rows on this page grouped under their class, in grade then section order.
  const groupedPage = useMemo(() => {
    const groups = new Map<string, StudentWithClass[]>()
    for (const st of paginatedStudents) {
      const key = `${st.grade}|${st.section}`
      groups.set(key, [...(groups.get(key) ?? []), st])
    }
    return [...groups.entries()]
      .map(([key, items]) => {
        const [grade, section] = key.split("|")
        return { key, grade: Number(grade), section, items }
      })
      .sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section))
  }, [paginatedStudents])

  // Header Add Students button — always visible for admins
  useEffect(() => {
    if (!isAdmin) {
      setHeaderActions(null)
      return
    }
    setHeaderActions(
      <Button size="lg" onClick={() => setDrawerOpen(true)}>
        <PlusIcon className="size-3.5" />
        <span className="hidden sm:inline">Add Students</span>
      </Button>
    )
    return () => setHeaderActions(null)
  }, [isAdmin, setHeaderActions])

  const resolveClassId = (entry: StudentEntry): string | null => {
    if (entry.grade && entry.section) {
      const cls = classes.find(
        (c) => String(c.grade) === entry.grade && c.section === entry.section
      )
      if (cls) return cls.id
    }
    return selectedClass?.id ?? null
  }

  const saveElectiveChoices = async (
    studentId: string,
    choices?: ElectiveChoice[]
  ) => {
    if (!choices || choices.length === 0) return
    const electives = choices.map((c) => ({
      class_subject_id: c.class_subject_id,
      elective_group_id: c.elective_group_id,
    }))
    await apiClient.post("/api/student-electives/bulk", {
      student_id: studentId,
      electives,
    })
  }

  const handleSaveStudents = async (entry: StudentEntry) => {
    setIsSaving(true)
    try {
      const classId = resolveClassId(entry)
      const res = await apiClient.post<{ student: { id: string } }>(
        "/api/students",
        {
          class_id: classId,
          full_name: entry.full_name,
          date_of_birth: entry.date_of_birth || null,
          gender: entry.gender || null,
          blood_group: entry.blood_group || null,
          admission_number: entry.admission_number || null,
          academic_year: entry.academic_year || null,
          grade: entry.grade || null,
          section: entry.section || null,
          roll_number: entry.roll_number !== "" ? entry.roll_number : null,
          register_number: entry.register_number || null,
          street: entry.street || null,
          city: entry.city || null,
          contact_number: entry.contact_number || null,
          emergency_contact_name: entry.emergency_contact_name || null,
          emergency_contact_relationship:
            entry.emergency_contact_relationship || null,
          emergency_contact_phone: entry.emergency_contact_phone || null,
        }
      )

      await saveElectiveChoices(res.student.id, entry.elective_choices)

      setDrawerOpen(false)
      await fetchAll()
    } catch (err) {
      console.error("Failed to create student:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRowClick = (studentId: string) => {
    setSelectedStudentId(studentId)
    setDetailDrawerOpen(true)
  }

  const handleEditStudent = async (studentId: string) => {
    setIsLoadingEdit(true)
    try {
      const [studentRes, electivesRes] = await Promise.all([
        apiClient.get<{ student: Record<string, unknown> }>(
          `/api/students/${studentId}`
        ),
        apiClient
          .get<{
            student_electives: {
              elective_group_id: string
              class_subject_id: string
            }[]
          }>(`/api/student-electives/student/${studentId}`)
          .catch(() => ({ student_electives: [] })),
      ])

      const s = studentRes.student as Record<
        string,
        string | number | null | undefined
      >
      const electiveChoices: ElectiveChoice[] = (
        electivesRes.student_electives ?? []
      ).map((e) => ({
        elective_group_id: e.elective_group_id,
        class_subject_id: e.class_subject_id,
      }))

      const entry: StudentEntry = {
        full_name: String(s.full_name ?? ""),
        date_of_birth: s.date_of_birth ? String(s.date_of_birth) : "",
        gender: String(s.gender ?? ""),
        blood_group: String(s.blood_group ?? ""),
        admission_number: String(s.admission_number ?? ""),
        academic_year: String(s.academic_year ?? ""),
        grade: s.grade != null ? String(s.grade) : "",
        section: String(s.section ?? ""),
        roll_number:
          s.roll_number != null && s.roll_number !== ""
            ? Number(s.roll_number)
            : "",
        register_number: String(s.register_number ?? ""),
        street: String(s.street ?? ""),
        city: String(s.city ?? ""),
        contact_number: String(s.contact_number ?? ""),
        emergency_contact_name: String(s.emergency_contact_name ?? ""),
        emergency_contact_relationship: String(
          s.emergency_contact_relationship ?? ""
        ),
        emergency_contact_phone: String(s.emergency_contact_phone ?? ""),
        elective_choices: electiveChoices,
      }
      setEditInitialData(entry)
      setEditStudentId(studentId)
    } catch (err) {
      console.error("Failed to load student for edit:", err)
    } finally {
      setIsLoadingEdit(false)
    }
  }

  const handleUpdateStudent = async (entry: StudentEntry) => {
    if (!editStudentId) return
    setIsSaving(true)
    try {
      await apiClient.put(`/api/students/${editStudentId}`, {
        full_name: entry.full_name,
        date_of_birth: entry.date_of_birth || null,
        gender: entry.gender || null,
        blood_group: entry.blood_group || null,
        admission_number: entry.admission_number || null,
        academic_year: entry.academic_year || null,
        grade: entry.grade || null,
        section: entry.section || null,
        roll_number: entry.roll_number !== "" ? entry.roll_number : null,
        register_number: entry.register_number || null,
        street: entry.street || null,
        city: entry.city || null,
        contact_number: entry.contact_number || null,
        emergency_contact_name: entry.emergency_contact_name || null,
        emergency_contact_relationship:
          entry.emergency_contact_relationship || null,
        emergency_contact_phone: entry.emergency_contact_phone || null,
      })

      await saveElectiveChoices(editStudentId, entry.elective_choices)

      setEditStudentId(null)
      setEditInitialData(null)
      await fetchAll()
    } catch (err) {
      console.error("Failed to update student:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return
    setIsDeleting(true)
    try {
      await apiClient.delete(`/api/students/${studentToDelete.id}`)
      setStudentToDelete(null)
      await fetchAll()
    } catch (err) {
      console.error("Failed to delete student:", err)
    } finally {
      setIsDeleting(false)
    }
  }

  const activeCount =
    selectedGrades.length +
    selectedSections.length +
    selectedGenders.length +
    selectedBloodGroups.length

  const clearAllFilters = () => {
    setSelectedGrades([])
    setSelectedSections([])
    setSelectedGenders([])
    setSelectedBloodGroups([])
  }

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex min-h-full flex-col gap-5 pb-12"
      )}
    >
      <PageHeader
        icon={GraduationCapIcon}
        title="Students"
        description="Everyone enrolled, across every class."
      >
        {isLoading && <PageToolbarSkeleton />}
        {!isLoading && !error && classes.length > 0 && (
          <PageToolbar
            className="animate-in duration-300 fade-in-0"
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search by name or roll number…",
            }}
            summary={
              <>
                {countSummary(
                  filtered.length,
                  allStudents.length,
                  "student",
                  activeCount > 0 || search.trim().length > 0
                )}
                {totalPages > 1 && ` · page ${page} of ${totalPages}`}
              </>
            }
            trailing={
              <div className="flex items-center gap-2">
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => setPageSize(Number(v))}
                >
                  <SelectTrigger
                    className="h-9 w-[7.5rem] text-xs"
                    aria-label="Students per page"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {[25, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} per page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {totalPages > 1 && (
                  <div className="flex h-9 items-center rounded-md border border-border">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-full w-8 rounded-r-none"
                      aria-label="Previous page"
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <CaretLeftIcon className="size-3.5" />
                    </Button>
                    <span className="h-4 w-px bg-border" />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-full w-8 rounded-l-none"
                      aria-label="Next page"
                      disabled={page === totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                    >
                      <CaretRightIcon className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            }
            filters={{
              activeCount,
              onClearAll: clearAllFilters,
              resultLabel: `${filtered.length} of ${allStudents.length} students`,
              children: (
                <>
                  <MultiSelectField
                    icon={ChalkboardIcon}
                    label="Grade"
                    placeholder="Any grade"
                    options={grades.map((g) => ({
                      value: g,
                      label: `Grade ${g}`,
                    }))}
                    selected={selectedGrades}
                    onToggle={(v) => toggleArrayValue(setSelectedGrades, v)}
                    onClear={() => setSelectedGrades([])}
                    searchable={grades.length > 8}
                  />
                  <MultiSelectField
                    icon={ArrowsSplitIcon}
                    label="Section"
                    placeholder={
                      sections.length === 0 ? "No sections yet" : "Any section"
                    }
                    options={sections.map((sec) => ({
                      value: sec,
                      label: `Section ${sec}`,
                    }))}
                    selected={selectedSections}
                    onToggle={(v) => toggleArrayValue(setSelectedSections, v)}
                    onClear={() => setSelectedSections([])}
                    searchable={sections.length > 8}
                  />
                  <div className="flex flex-col gap-2">
                    <FilterFieldHeader
                      icon={GenderIntersexIcon}
                      label="Gender"
                      count={selectedGenders.length}
                      onClear={() => setSelectedGenders([])}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {GENDER_OPTIONS.map((g) => (
                        <FilterPill
                          key={g}
                          label={g}
                          selected={selectedGenders.includes(g)}
                          onToggle={() =>
                            toggleArrayValue(setSelectedGenders, g)
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <FilterFieldHeader
                      icon={DropIcon}
                      label="Blood group"
                      count={selectedBloodGroups.length}
                      onClear={() => setSelectedBloodGroups([])}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {BLOOD_GROUPS.map((bg) => (
                        <FilterPill
                          key={bg}
                          label={bg}
                          selected={selectedBloodGroups.includes(bg)}
                          onToggle={() =>
                            toggleArrayValue(setSelectedBloodGroups, bg)
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
                {selectedGrades.length > 0 && (
                  <FilterChipGroup icon={ChalkboardIcon} label="Grade">
                    {selectedGrades.map((g) => (
                      <FilterChip
                        key={`grade-${g}`}
                        label={`Grade ${g}`}
                        onRemove={() => toggleArrayValue(setSelectedGrades, g)}
                      />
                    ))}
                  </FilterChipGroup>
                )}
                {selectedSections.length > 0 && (
                  <FilterChipGroup icon={ArrowsSplitIcon} label="Section">
                    {selectedSections.map((sec) => (
                      <FilterChip
                        key={`section-${sec}`}
                        label={`Section ${sec}`}
                        onRemove={() =>
                          toggleArrayValue(setSelectedSections, sec)
                        }
                      />
                    ))}
                  </FilterChipGroup>
                )}
                {selectedGenders.length > 0 && (
                  <FilterChipGroup icon={GenderIntersexIcon} label="Gender">
                    {selectedGenders.map((g) => (
                      <FilterChip
                        key={`gender-${g}`}
                        label={g}
                        onRemove={() => toggleArrayValue(setSelectedGenders, g)}
                      />
                    ))}
                  </FilterChipGroup>
                )}
                {selectedBloodGroups.length > 0 && (
                  <FilterChipGroup icon={DropIcon} label="Blood group">
                    {selectedBloodGroups.map((bg) => (
                      <FilterChip
                        key={`blood-${bg}`}
                        label={bg}
                        onRemove={() =>
                          toggleArrayValue(setSelectedBloodGroups, bg)
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

      <LoadingSwap
        loading={isLoading}
        skeleton={<RosterSkeleton />}
        className="flex-1"
      >
        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
            <Sticker name="worried" size={88} />
            <div className="flex max-w-[360px] flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-secondary-foreground">
                Couldn't load students
              </p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" onClick={fetchAll}>
              Try again
            </Button>
          </div>
        ) : classes.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
            <Sticker name="classroom" size={200} />
            <div className="flex max-w-[380px] flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-secondary-foreground">
                No classes yet
              </p>
              <p className="text-sm text-muted-foreground">
                Students live inside classes. Create your grades and sections
                first, then enrol students here.
              </p>
            </div>
          </div>
        ) : paginatedStudents.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <Sticker
              name={activeCount > 0 || search ? "lost" : "friends"}
              size={activeCount > 0 || search ? 120 : 200}
            />
            <div className="flex max-w-[360px] flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-secondary-foreground">
                {activeCount > 0 || search
                  ? "Nobody matches that"
                  : "No students enrolled yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {activeCount > 0 || search
                  ? "Try a different name or drop a filter."
                  : isAdmin
                    ? "Add students to a class and they'll appear here, grouped by section."
                    : "Once students are enrolled they'll appear here."}
              </p>
            </div>
            {activeCount > 0 || search ? (
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
            ) : isAdmin ? (
              <Button onClick={() => setDrawerOpen(true)}>
                <PlusIcon className="size-3.5" />
                Add students
              </Button>
            ) : null}
          </div>
        ) : (
          <GroupedList>
            {groupedPage.map((group) => (
              <ListGroup
                key={group.key}
                icon={ChalkboardIcon}
                label={`Grade ${group.grade} · Section ${group.section}`}
                count={group.items.length}
              >
                {/* Seating chart: one desk per student, roll number in the
                  corner, so a section reads the way its classroom does */}
                <div className="grid grid-cols-2 gap-3 px-3 pt-1 @2xl:grid-cols-3 @5xl:grid-cols-4">
                  {group.items.map((student) => {
                    const dobDate = student.date_of_birth
                      ? new Date(student.date_of_birth + "T00:00:00")
                      : null
                    const age = dobDate
                      ? differenceInYears(new Date(), dobDate)
                      : null
                    const vitals = [
                      age != null ? `${age} yrs` : null,
                      student.gender || null,
                    ].filter(Boolean)
                    const wash =
                      GENDER_WASH[student.gender ?? ""] ?? GENDER_WASH.default
                    return (
                      <div
                        key={student.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleRowClick(student.id)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleRowClick(student.id)
                        }
                        className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-background text-center transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {/* Desk top — tinted in the grade's colour */}
                        <div
                          className={cn(
                            "relative flex h-8 items-start justify-between px-3 pt-1.5",
                            wash
                          )}
                        >
                          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                            {student.roll_number
                              ? String(student.roll_number).padStart(2, "0")
                              : "—"}
                          </span>
                          {student.blood_group && (
                            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                              <DropIcon
                                weight="fill"
                                className="size-3 text-red-500"
                              />
                              {student.blood_group}
                            </span>
                          )}
                        </div>

                        {/* Avatar hangs off the band */}
                        <div className="-mt-4 flex justify-center">
                          <Avatar className="size-10 ring-4 ring-background">
                            <AvatarFallback
                              className={cn("text-xs text-foreground/70", wash)}
                            >
                              {getInitials(student.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        </div>

                        <div className="flex min-w-0 flex-col gap-0.5 px-3 pt-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {student.full_name}
                          </span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {vitals.length > 0 ? vitals.join(" · ") : "—"}
                          </span>
                        </div>

                        {/* Records */}
                        <dl className="mt-3 flex flex-col gap-1.5 border-t border-dashed border-border px-4 py-3 text-left text-[11px]">
                          {[
                            {
                              icon: IdentificationBadgeIcon,
                              label: "Admission",
                              value: student.admission_number,
                            },
                            {
                              icon: HashIcon,
                              label: "Register",
                              value: student.register_number,
                            },
                            {
                              icon: PhoneIcon,
                              label: "Phone",
                              value: student.contact_number,
                            },
                          ].map((row) => (
                            <div
                              key={row.label}
                              className="flex items-center justify-between gap-3"
                            >
                              <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                                <row.icon className="size-3.5" />
                                {row.label}
                              </dt>
                              <dd className="truncate text-secondary-foreground tabular-nums">
                                {row.value || "—"}
                              </dd>
                            </div>
                          ))}
                        </dl>

                        {isAdmin && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="absolute top-5 right-1.5"
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                                  aria-label="Student actions"
                                >
                                  <DotsThreeIcon
                                    weight="bold"
                                    className="size-4"
                                  />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                  onSelect={() => handleEditStudent(student.id)}
                                  disabled={isLoadingEdit}
                                >
                                  <PencilIcon className="size-3.5" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={(e) => {
                                    e.preventDefault()
                                    setStudentToDelete(student)
                                  }}
                                >
                                  <TrashIcon className="size-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ListGroup>
            ))}
          </GroupedList>
        )}
      </LoadingSwap>

      {isAdmin && (
        <AddStudentDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onSave={handleSaveStudents}
          classes={classes}
          isSaving={isSaving}
        />
      )}

      {isAdmin && (
        <AddStudentDrawer
          open={!!editStudentId}
          onOpenChange={(open) => {
            if (!open) {
              setEditStudentId(null)
              setEditInitialData(null)
            }
          }}
          onSave={handleUpdateStudent}
          classes={classes}
          isSaving={isSaving}
          mode="edit"
          initialData={editInitialData}
        />
      )}

      <StudentDetailDrawer
        studentId={selectedStudentId}
        open={detailDrawerOpen}
        onOpenChange={setDetailDrawerOpen}
        canManage={isAdmin}
        onEdit={(student) => {
          setDetailDrawerOpen(false)
          handleEditStudent(student.id)
        }}
        onDeleted={() => {
          setSelectedStudentId(null)
          fetchAll()
        }}
      />

      <AlertDialog
        open={!!studentToDelete}
        onOpenChange={(open) => !open && setStudentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium text-foreground">
                {studentToDelete?.full_name}
              </span>{" "}
              and their associated records. This action cannot be undone.
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
    </div>
  )
}
