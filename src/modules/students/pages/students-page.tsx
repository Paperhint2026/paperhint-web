import { useCallback, useEffect, useMemo, useState } from "react"
import { differenceInYears, format } from "date-fns"
import { DropletIcon, GraduationCapIcon, Loader2Icon, MoreHorizontalIcon, PencilIcon, PhoneIcon, PlusIcon, SearchIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import {
  FilterChip,
  MultiSelectField,
  toggleArrayValue,
} from "@/components/shared/filter-controls"
import { useHeaderActions } from "@/components/layout/header-actions-context"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type ClassItem } from "@/modules/students/components/student-class-card"
import {
  AddStudentDrawer,
  type StudentEntry,
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

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
]

const GENDER_BADGE: Record<string, string> = {
  Male: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  Female: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-800",
  Other: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

function getAvatarColor(name: string) {
  const sum = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

interface StudentWithClass extends Omit<Student, "grade" | "section" | "academic_year"> {
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
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)

  const [isScrolledX, setIsScrolledX] = useState(false)

  const [studentToDelete, setStudentToDelete] = useState<StudentWithClass | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [editStudentId, setEditStudentId] = useState<string | null>(null)
  const [editInitialData, setEditInitialData] = useState<StudentEntry | null>(null)
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
              })),
            )
            .catch(() => [] as StudentWithClass[]),
        ),
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

  useEffect(() => { fetchAll() }, [fetchAll])

  // Unique grades from classes
  const grades = useMemo(
    () => [...new Set(classes.map((c) => String(c.grade)))].sort((a, b) => Number(a) - Number(b)),
    [classes],
  )

  // Sections available for the selected grades
  const sections = useMemo(() => {
    const pool = selectedGrades.length === 0
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
    if (selectedGrades.length !== 1 || selectedSections.length !== 1) return null
    return classes.find(
      (c) =>
        String(c.grade) === selectedGrades[0] &&
        c.section === selectedSections[0],
    ) ?? null
  }, [classes, selectedGrades, selectedSections])

  // Filtered students
  const filtered = useMemo(() => {
    let list = allStudents
    if (selectedGrades.length > 0) list = list.filter((s) => selectedGrades.includes(String(s.grade)))
    if (selectedSections.length > 0) list = list.filter((s) => selectedSections.includes(s.section))
    if (selectedGenders.length > 0) list = list.filter((s) => s.gender && selectedGenders.includes(s.gender))
    if (selectedBloodGroups.length > 0) list = list.filter((s) => s.blood_group && selectedBloodGroups.includes(s.blood_group))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          String(s.roll_number).includes(q) ||
          s.register_number?.toLowerCase().includes(q) ||
          s.admission_number?.toLowerCase().includes(q),
      )
    }
    return list
  }, [allStudents, selectedGrades, selectedSections, selectedGenders, selectedBloodGroups, search])

  // Reset to page 1 when filters, search, or page size change
  useEffect(() => { setPage(1) }, [search, selectedGrades, selectedSections, selectedGenders, selectedBloodGroups, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginatedStudents = filtered.slice((page - 1) * pageSize, page * pageSize)

  // Header Add Students button — always visible for admins
  useEffect(() => {
    if (!isAdmin) {
      setHeaderActions(null)
      return
    }
    setHeaderActions(
      <Button size="lg" className="rounded-full" onClick={() => setDrawerOpen(true)}>
        <PlusIcon className="size-3.5" />
        <span className="hidden sm:inline">Add Students</span>
      </Button>
    )
    return () => setHeaderActions(null)
  }, [isAdmin, setHeaderActions])

  const handleSaveStudents = async (entry: StudentEntry) => {
    setIsSaving(true)
    try {
      await apiClient.post("/api/students", {
        class_id: selectedClass?.id ?? null,
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
        emergency_contact_relationship: entry.emergency_contact_relationship || null,
        emergency_contact_phone: entry.emergency_contact_phone || null,
      })
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
      const res = await apiClient.get<{ student: Record<string, unknown> }>(
        `/api/students/${studentId}`,
      )
      const s = res.student as Record<string, string | number | null | undefined>
      const entry: StudentEntry = {
        full_name: String(s.full_name ?? ""),
        date_of_birth: s.date_of_birth ? String(s.date_of_birth) : "",
        gender: String(s.gender ?? ""),
        blood_group: String(s.blood_group ?? ""),
        admission_number: String(s.admission_number ?? ""),
        academic_year: String(s.academic_year ?? ""),
        grade: s.grade != null ? String(s.grade) : "",
        section: String(s.section ?? ""),
        roll_number: s.roll_number != null && s.roll_number !== "" ? Number(s.roll_number) : "",
        register_number: String(s.register_number ?? ""),
        street: String(s.street ?? ""),
        city: String(s.city ?? ""),
        contact_number: String(s.contact_number ?? ""),
        emergency_contact_name: String(s.emergency_contact_name ?? ""),
        emergency_contact_relationship: String(s.emergency_contact_relationship ?? ""),
        emergency_contact_phone: String(s.emergency_contact_phone ?? ""),
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
        emergency_contact_relationship: entry.emergency_contact_relationship || null,
        emergency_contact_phone: entry.emergency_contact_phone || null,
      })
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

  if (isLoading) {
    return (
      <div className="flex min-h-full w-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchAll}>Retry</Button>
      </div>
    )
  }

  if (classes.length === 0) {
    return (
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <GraduationCapIcon className="size-6 text-muted-foreground" />
        </div>
        <div className="flex max-w-sm flex-col items-center gap-1 text-center">
          <p className="text-base font-medium text-secondary-foreground">No classes found</p>
          <p className="text-sm text-muted-foreground">
            Create classes first in the Classes module, then come back here to manage students.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 p-4 md:p-6">
      {/* Filters — minimal: search + popover + active-filter chips */}
      {(() => {
        const activeCount =
          selectedGrades.length +
          selectedSections.length +
          selectedGenders.length +
          selectedBloodGroups.length

        const clearAll = () => {
          setSelectedGrades([])
          setSelectedSections([])
          setSelectedGenders([])
          setSelectedBloodGroups([])
        }

        const renderOption = (
          value: string,
          label: string,
          selected: boolean,
          onToggle: () => void,
        ) => (
          <button
            key={value}
            type="button"
            onClick={onToggle}
            className={
              "rounded-full border px-2.5 py-1 text-xs transition-colors " +
              (selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-secondary-foreground hover:bg-muted")
            }
          >
            {label}
          </button>
        )

        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:max-w-72">
                <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 rounded-full pl-9"
                />
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full"
                  >
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
                        onClick={clearAll}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="flex max-h-[60vh] flex-col gap-4 overflow-auto p-4">
                    <MultiSelectField
                      label="Grade"
                      placeholder="All Grades"
                      options={grades.map((g) => ({ value: g, label: `Grade ${g}` }))}
                      selected={selectedGrades}
                      onToggle={(v) => toggleArrayValue(setSelectedGrades, v)}
                      onClear={() => setSelectedGrades([])}
                      searchable={grades.length > 8}
                    />
                    <MultiSelectField
                      label="Section"
                      placeholder={sections.length === 0 ? "No sections available" : "All Sections"}
                      options={sections.map((s) => ({ value: s, label: `Section ${s}` }))}
                      selected={selectedSections}
                      onToggle={(v) => toggleArrayValue(setSelectedSections, v)}
                      onClear={() => setSelectedSections([])}
                      searchable={sections.length > 8}
                    />
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">Gender</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {GENDER_OPTIONS.map((g) =>
                          renderOption(
                            g,
                            g,
                            selectedGenders.includes(g),
                            () => toggleArrayValue(setSelectedGenders, g),
                          ),
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">Blood Group</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {BLOOD_GROUPS.map((bg) =>
                          renderOption(
                            bg,
                            bg,
                            selectedBloodGroups.includes(bg),
                            () => toggleArrayValue(setSelectedBloodGroups, bg),
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {activeCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedGrades.map((g) => (
                  <FilterChip
                    key={`grade-${g}`}
                    label={`Grade ${g}`}
                    onRemove={() => toggleArrayValue(setSelectedGrades, g)}
                  />
                ))}
                {selectedSections.map((s) => (
                  <FilterChip
                    key={`section-${s}`}
                    label={`Section ${s}`}
                    onRemove={() => toggleArrayValue(setSelectedSections, s)}
                  />
                ))}
                {selectedGenders.map((g) => (
                  <FilterChip
                    key={`gender-${g}`}
                    label={g}
                    onRemove={() => toggleArrayValue(setSelectedGenders, g)}
                  />
                ))}
                {selectedBloodGroups.map((bg) => (
                  <FilterChip
                    key={`blood-${bg}`}
                    label={bg}
                    onRemove={() => toggleArrayValue(setSelectedBloodGroups, bg)}
                  />
                ))}
                <button
                  onClick={clearAll}
                  className="ml-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* Table — fills remaining height, only body scrolls */}
      <div
        onScroll={(e) => setIsScrolledX(e.currentTarget.scrollLeft > 0)}
        data-scrolled-x={isScrolledX || undefined}
        className="group/table min-h-0 flex-1 overflow-auto rounded-lg border [&_[data-slot=table-container]]:overflow-visible"
      >
        <Table className="border-collapse">
          <TableHeader className="sticky top-0 z-20 bg-background">
            <TableRow>
              <TableHead className="sticky left-0 z-30 w-10 shrink-0 bg-background">#</TableHead>
              <TableHead className="sticky left-10 z-30 min-w-56 bg-background transition-shadow group-data-[scrolled-x]/table:border-r group-data-[scrolled-x]/table:border-border group-data-[scrolled-x]/table:shadow-[6px_0_8px_-6px_rgba(0,0,0,0.18)]">Name</TableHead>
              <TableHead className="min-w-36">Class</TableHead>
              <TableHead className="min-w-40">Admission No.</TableHead>
              <TableHead className="min-w-28">Roll No.</TableHead>
              <TableHead className="min-w-40">Register No.</TableHead>
              <TableHead className="min-w-28">Gender</TableHead>
              <TableHead className="min-w-44">Date of Birth</TableHead>
              <TableHead className="min-w-32">Blood Group</TableHead>
              <TableHead className="min-w-40">Contact No.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-sm text-muted-foreground">
                  {search || selectedGrades.length > 0 || selectedSections.length > 0 || selectedGenders.length > 0 || selectedBloodGroups.length > 0
                    ? "No students match your filters."
                    : "No students found."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedStudents.map((student, idx) => {
                const dobDate = student.date_of_birth
                  ? new Date(student.date_of_birth + "T00:00:00")
                  : null
                const age = dobDate ? differenceInYears(new Date(), dobDate) : null

                return (
                  <TableRow
                    key={student.id}
                    className="group cursor-pointer"
                    onClick={() => handleRowClick(student.id)}
                  >
                    {/* Index */}
                    <TableCell className="sticky left-0 z-10 bg-background text-xs text-muted-foreground group-hover:bg-muted">
                      {(page - 1) * pageSize + idx + 1}
                    </TableCell>

                    {/* Name with avatar + hover actions */}
                    <TableCell className="sticky left-10 z-10 bg-background transition-shadow group-hover:bg-muted group-data-[scrolled-x]/table:border-r group-data-[scrolled-x]/table:border-border group-data-[scrolled-x]/table:shadow-[6px_0_8px_-6px_rgba(0,0,0,0.18)]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarColor(student.full_name)}`}>
                            {getInitials(student.full_name)}
                          </div>
                          <span className="truncate font-medium text-secondary-foreground">{student.full_name}</span>
                        </div>
                        {isAdmin && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 shrink-0 rounded-full opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                                  aria-label="Row actions"
                                >
                                  <MoreHorizontalIcon className="size-4" />
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
                                  <Trash2Icon className="size-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Class (Grade + Section merged) */}
                    <TableCell>
                      <span className="inline-flex items-center rounded-md border bg-muted px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                        G{student.grade} · {student.section}
                      </span>
                    </TableCell>

                    {/* Admission No. */}
                    <TableCell>
                      {student.admission_number
                        ? <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{student.admission_number}</span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>

                    {/* Roll No. */}
                    <TableCell className="text-sm text-secondary-foreground">
                      {student.roll_number || <span className="text-muted-foreground/40">—</span>}
                    </TableCell>

                    {/* Register No. */}
                    <TableCell>
                      {student.register_number
                        ? <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{student.register_number}</span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>

                    {/* Gender badge */}
                    <TableCell>
                      {student.gender
                        ? <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${GENDER_BADGE[student.gender] ?? "bg-muted text-muted-foreground border-border"}`}>
                            {student.gender}
                          </span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>

                    {/* Date of Birth + age */}
                    <TableCell>
                      {dobDate
                        ? <div className="flex flex-col gap-0.5">
                            <span className="text-sm text-secondary-foreground">{format(dobDate, "MMM d, yyyy")}</span>
                            <span className="text-xs text-muted-foreground">{age} yrs</span>
                          </div>
                        : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>

                    {/* Blood Group badge */}
                    <TableCell>
                      {student.blood_group
                        ? <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
                            <DropletIcon className="size-3" />
                            {student.blood_group}
                          </span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>

                    {/* Contact No. */}
                    <TableCell>
                      {student.contact_number
                        ? <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <PhoneIcon className="size-3.5 shrink-0 text-muted-foreground/50" />
                            {student.contact_number}
                          </span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>

                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer: rows-per-page left, prev/next right */}
      <div className="flex items-center justify-between gap-4">
        <Field orientation="horizontal" className="w-fit">
          <FieldLabel htmlFor="rows-per-page" className="text-xs text-muted-foreground">
            Rows per page
          </FieldLabel>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => setPageSize(Number(v))}
          >
            <SelectTrigger className="h-8 w-20 text-xs" id="rows-per-page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-disabled={page === 1}
                className={page === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-disabled={page === totalPages}
                className={page === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

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
    </div>
  )
}
