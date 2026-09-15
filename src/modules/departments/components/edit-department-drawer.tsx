import { useState } from "react"
import {
  ArrowLeftIcon,
  CaretRightIcon,
  CircleNotchIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { describeGrades, GRADES, gradeLabel } from "@/lib/grades"
import { showError } from "@/lib/show-error"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type {
  Department,
  SubjectOption,
  Teacher,
} from "@/modules/departments/lib/types"

type View = "main" | "add-subject" | "set-grades" | "add-teacher"

/**
 * Editing a department in one drawer, not a page navigation per field
 * (founder, 2026-09-15): renaming stays inline; adding a subject or a
 * teacher — and, when a newly-added subject has no grades yet, setting
 * them — opens as its own screen inside the same drawer with a back arrow,
 * never a separate route ("nest the drawer with a back button providing a
 * lookup to select subjects and teachers for the department").
 */
export function EditDepartmentDrawer({
  open,
  onOpenChange,
  dept,
  members,
  allSubjects,
  allTeachers,
  onRemoveSubject,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dept: Department
  /** Teachers currently in this department. */
  members: Teacher[]
  allSubjects: SubjectOption[]
  /** Every teacher in the school, for the add-teacher lookup. */
  allTeachers: Teacher[]
  onRemoveSubject: (s: SubjectOption) => void
  /** Refetch from the server after a write this drawer made directly. */
  onChanged: () => void
}) {
  const [view, setView] = useState<View>("main")
  const [name, setName] = useState(dept.name)
  const [savingName, setSavingName] = useState(false)
  const [query, setQuery] = useState("")
  const [pendingSubject, setPendingSubject] = useState<SubjectOption | null>(
    null
  )
  const [pendingGrades, setPendingGrades] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [movingTeacherId, setMovingTeacherId] = useState<string | null>(null)

  const reset = () => {
    setView("main")
    setName(dept.name)
    setQuery("")
    setPendingSubject(null)
    setPendingGrades([])
  }

  const setTeacherDepartment = async (
    teacherId: string,
    departmentId: string | null
  ) => {
    setMovingTeacherId(teacherId)
    try {
      await apiClient.put(`/api/auth/teacher/${teacherId}`, {
        department_id: departmentId,
      })
      onChanged()
      if (departmentId) {
        setView("main")
        setQuery("")
      }
    } catch (e) {
      showError(e)
    } finally {
      setMovingTeacherId(null)
    }
  }

  const saveName = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === dept.name) {
      setName(dept.name)
      return
    }
    setSavingName(true)
    try {
      await apiClient.patch(`/api/departments/${dept.id}`, { name: trimmed })
      onChanged()
    } catch (e) {
      showError(e)
      setName(dept.name)
    } finally {
      setSavingName(false)
    }
  }

  const addSubjectToDept = async (s: SubjectOption) => {
    setSaving(true)
    try {
      const ids = [...dept.subjects.map((x) => x.id), s.id]
      await apiClient.put(`/api/departments/${dept.id}/subjects`, {
        subject_ids: ids,
      })
      onChanged()
      setView("main")
      setQuery("")
    } catch (e) {
      showError(e)
    } finally {
      setSaving(false)
    }
  }

  const pickSubject = (s: SubjectOption) => {
    if (s.grades.length > 0) {
      addSubjectToDept(s)
      return
    }
    // No grades yet — this subject can't run anywhere until it has some.
    setPendingSubject(s)
    setPendingGrades([])
    setView("set-grades")
  }

  const confirmGrades = async () => {
    if (!pendingSubject) return
    setSaving(true)
    try {
      await apiClient.put(`/api/subjects/${pendingSubject.id}/grades`, {
        grades: pendingGrades,
      })
      await addSubjectToDept(pendingSubject)
    } catch (e) {
      showError(e)
      setSaving(false)
    }
  }

  const available = allSubjects
    .filter((s) => !dept.subjects.some((x) => x.id === s.id))
    .filter((s) =>
      query.trim()
        ? s.subject_name.toLowerCase().includes(query.trim().toLowerCase())
        : true
    )

  const availableTeachers = allTeachers
    .filter((t) => t.department_id !== dept.id)
    .filter((t) =>
      query.trim()
        ? t.full_name.toLowerCase().includes(query.trim().toLowerCase())
        : true
    )

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
    >
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
        {view === "main" && (
          <>
            <SheetHeader>
              <SheetTitle>Edit {dept.name}</SheetTitle>
              <SheetDescription>
                Rename it, or change which teachers and subjects it owns.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dept-name" className="text-xs">
                  Name
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="dept-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur()
                    }}
                    maxLength={80}
                  />
                  {savingName && (
                    <CircleNotchIcon className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Teachers</Label>
                <div className="overflow-hidden rounded-lg border border-border">
                  {members.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">
                      No teachers yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {members.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <span className="truncate text-foreground">
                            {t.full_name}
                          </span>
                          <button
                            type="button"
                            disabled={movingTeacherId === t.id}
                            onClick={() => setTeacherDepartment(t.id, null)}
                            className="shrink-0 text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => setView("add-teacher")}
                    className="flex w-full items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <span className="flex items-center gap-1.5">
                      <PlusIcon className="size-3.5" />
                      Add a teacher
                    </span>
                    <CaretRightIcon className="size-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Subjects</Label>
                  <span className="text-xs text-muted-foreground">
                    {describeGrades(dept.grades)}
                  </span>
                </div>
                <div className="overflow-hidden rounded-lg border border-border">
                  {dept.subjects.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">
                      No subjects yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {dept.subjects.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <span className="truncate text-foreground">
                            {s.subject_name}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveSubject(s as SubjectOption)}
                            className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => setView("add-subject")}
                    className="flex w-full items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <span className="flex items-center gap-1.5">
                      <PlusIcon className="size-3.5" />
                      Add a subject
                    </span>
                    <CaretRightIcon className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {view === "add-subject" && (
          <>
            <SheetHeader className="flex-row items-center gap-2 space-y-0">
              <button
                type="button"
                onClick={() => {
                  setView("main")
                  setQuery("")
                }}
                aria-label="Back"
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeftIcon className="size-4" />
              </button>
              <SheetTitle>Add a subject</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search subjects"
                  className="pl-8"
                />
              </div>
              {available.length === 0 ? (
                <p className="px-1 py-4 text-sm text-muted-foreground">
                  {allSubjects.length === dept.subjects.length
                    ? "Every subject is already here."
                    : "No match."}
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {available.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={saving}
                      onClick={() => pickSubject(s)}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted disabled:opacity-60"
                    >
                      <span className="truncate">{s.subject_name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {describeGrades(s.grades, "No grades yet")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {view === "add-teacher" && (
          <>
            <SheetHeader className="flex-row items-center gap-2 space-y-0">
              <button
                type="button"
                onClick={() => {
                  setView("main")
                  setQuery("")
                }}
                aria-label="Back"
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeftIcon className="size-4" />
              </button>
              <SheetTitle>Add a teacher</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search teachers"
                  className="pl-8"
                />
              </div>
              {availableTeachers.length === 0 ? (
                <p className="px-1 py-4 text-sm text-muted-foreground">
                  {allTeachers.length === members.length
                    ? "Every teacher is already here."
                    : "No match."}
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {availableTeachers.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={movingTeacherId === t.id}
                      onClick={() => setTeacherDepartment(t.id, dept.id)}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted disabled:opacity-60"
                    >
                      <span className="truncate">{t.full_name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {t.department_id
                          ? "Moves from another department"
                          : "Unassigned"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {view === "set-grades" && pendingSubject && (
          <>
            <SheetHeader className="flex-row items-center gap-2 space-y-0">
              <button
                type="button"
                onClick={() => setView("add-subject")}
                aria-label="Back"
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeftIcon className="size-4" />
              </button>
              <SheetTitle>Grades for {pendingSubject.subject_name}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
              <p className="text-xs text-muted-foreground">
                It has no grades yet — pick which ones run it before adding it
                here.
              </p>
              <div className="flex flex-wrap gap-1">
                {GRADES.map((g) => {
                  const on = pendingGrades.includes(g)
                  return (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setPendingGrades((prev) =>
                          (on
                            ? prev.filter((x) => x !== g)
                            : [...prev, g]
                          ).sort((a, b) => a - b)
                        )
                      }
                      className={cn(
                        "min-w-8 rounded-md border px-2 py-1 text-xs tabular-nums transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {gradeLabel(g)}
                    </button>
                  )
                })}
              </div>
              <Button
                onClick={confirmGrades}
                disabled={pendingGrades.length === 0 || saving}
              >
                {saving && <CircleNotchIcon className="size-4 animate-spin" />}
                Add with these grades
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
