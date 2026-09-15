import { useState } from "react"
import {
  ArrowLeftIcon,
  CaretDownIcon,
  CircleNotchIcon,
  CrownSimpleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { describeGrades, GRADES, gradeLabel } from "@/lib/grades"
import { showError } from "@/lib/show-error"
import { cn } from "@/lib/utils"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CurlyDivider } from "@/components/shared/curly-divider"
import { lookFor } from "@/modules/departments/lib/department-look"
import type {
  Department,
  Head,
  SubjectOption,
  Teacher,
} from "@/modules/departments/lib/types"

type View = "main" | "add-subject" | "set-grades" | "add-teacher" | "pick-head"

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

/**
 * Editing a department in one drawer, not a page navigation per field
 * (founder, 2026-09-15): renaming stays inline; adding a teacher, a subject,
 * or setting the head — and, when a newly-added subject has no grades yet,
 * setting them — opens as its own screen inside the same drawer with a back
 * arrow, never a separate route.
 */
export function EditDepartmentDrawer({
  open,
  onOpenChange,
  dept,
  members,
  allSubjects,
  allTeachers,
  onRemoveSubject,
  onSetHead,
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
  onSetHead: (t: Teacher | null) => void
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
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const { Icon, palette } = lookFor(dept.name)
  const head: Head | null = dept.heads[0] ?? null

  const reset = () => {
    setView("main")
    setName(dept.name)
    setQuery("")
    setPendingSubject(null)
    setPendingGrades([])
  }

  const back = () => {
    setView("main")
    setQuery("")
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
      if (departmentId) back()
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
      back()
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

  const gradesFor = (subjectId: string) =>
    allSubjects.find((s) => s.id === subjectId)?.grades ?? []

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

  // A head leads the department, so they have to be in it.
  const headOptions = members
    .filter((t) => t.id !== head?.id)
    .filter((t) =>
      query.trim()
        ? t.full_name.toLowerCase().includes(query.trim().toLowerCase())
        : true
    )

  const requestClose = (v: boolean) => {
    // A subject with no grades can't run anywhere — closing here would
    // silently drop it, so ask first rather than discard without saying so
    // (founder, 2026-09-15: this must be mandatory or the add is thrown away).
    if (!v && view === "set-grades" && pendingSubject) {
      setConfirmDiscard(true)
      return
    }
    onOpenChange(v)
    if (!v) reset()
  }

  return (
    <Sheet open={open} onOpenChange={requestClose}>
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
        {view === "main" && (
          <>
            <SheetHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <SheetTitle className="sr-only">Edit {dept.name}</SheetTitle>
              <span className="text-xs font-medium text-muted-foreground">
                Edit department
              </span>
            </SheetHeader>

            <div className="flex flex-col overflow-y-auto px-4 pb-4">
              <div className="flex items-center gap-3.5 pb-3">
                <span
                  className={cn(
                    "grid size-13 shrink-0 place-items-center rounded-2xl text-white",
                    palette.cover
                  )}
                >
                  <Icon className="size-6" weight="fill" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-col">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur()
                    }}
                    maxLength={80}
                    className="-mx-1 -my-0.5 rounded-md px-1 py-0.5 text-lg font-semibold text-foreground outline-none hover:bg-muted focus:bg-muted"
                  />
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      <span className="font-medium text-foreground tabular-nums">
                        {members.length}
                      </span>{" "}
                      {members.length === 1 ? "teacher" : "teachers"}
                    </span>
                    <span>
                      <span className="font-medium text-foreground tabular-nums">
                        {dept.subjects.length}
                      </span>{" "}
                      {dept.subjects.length === 1 ? "subject" : "subjects"}
                    </span>
                    <span>{describeGrades(dept.grades)}</span>
                    {savingName && (
                      <CircleNotchIcon className="size-3 shrink-0 animate-spin" />
                    )}
                  </div>
                </div>
              </div>

              <CurlyDivider id="dept-curly" />

              <div className="flex flex-col gap-1.5 pt-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Head of department
                </p>
                <button
                  type="button"
                  onClick={() => setView("pick-head")}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-left hover:border-primary/40"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar className="size-7">
                      <AvatarFallback className="text-[11px]">
                        {head ? initials(head.full_name) : "—"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm text-foreground">
                      {head?.full_name ?? (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </span>
                  </span>
                  <CaretDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5 pt-5">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Teachers
                </p>
                <button
                  type="button"
                  onClick={() => setView("add-teacher")}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-border px-2.5 py-2 text-sm text-muted-foreground hover:border-solid hover:bg-muted"
                >
                  <span className="flex items-center gap-1.5">
                    <PlusIcon className="size-3.5" />
                    Add a teacher
                  </span>
                </button>
                {members.map((t) => (
                  <div
                    key={t.id}
                    className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5"
                  >
                    <Avatar className="size-7">
                      <AvatarFallback className="text-[11px]">
                        {initials(t.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex flex-1 items-center gap-1.5 truncate text-sm text-foreground">
                      {t.full_name}
                      {t.id === head?.id && (
                        <CrownSimpleIcon
                          weight="fill"
                          className="size-3.5 shrink-0 text-amber-500"
                        />
                      )}
                    </span>
                    <button
                      type="button"
                      disabled={movingTeacherId === t.id}
                      onClick={() => setTeacherDepartment(t.id, null)}
                      className="shrink-0 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1.5 pt-5">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Subjects
                </p>
                <button
                  type="button"
                  onClick={() => setView("add-subject")}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-border px-2.5 py-2 text-sm text-muted-foreground hover:border-solid hover:bg-muted"
                >
                  <span className="flex items-center gap-1.5">
                    <PlusIcon className="size-3.5" />
                    Add a subject
                  </span>
                </button>
                <div className="flex flex-wrap gap-1.5">
                  {dept.subjects.map((s) => {
                    const grades = gradesFor(s.id)
                    return (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-1 pr-1 pl-3 text-xs text-foreground"
                      >
                        {s.subject_name}
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                            grades.length > 0
                              ? "bg-primary/10 text-primary"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                          )}
                        >
                          {describeGrades(grades, "No grades")}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${s.subject_name}`}
                          onClick={() => onRemoveSubject(s as SubjectOption)}
                          className="grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-destructive"
                        >
                          <XIcon className="size-2.5" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {view === "pick-head" && (
          <>
            <SheetHeader className="flex-row items-center gap-2 space-y-0">
              <button
                type="button"
                onClick={back}
                aria-label="Back"
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeftIcon className="size-4" />
              </button>
              <SheetTitle>Head of department</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
              {head && (
                <button
                  type="button"
                  onClick={() => {
                    onSetHead(null)
                    back()
                  }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-left text-sm hover:bg-muted"
                >
                  <span className="flex items-center gap-2.5">
                    <Avatar className="size-7">
                      <AvatarFallback className="text-[11px]">
                        {initials(head.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    {head.full_name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Remove
                  </span>
                </button>
              )}
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search teachers in this department"
                  className="pl-8"
                />
              </div>
              {headOptions.length === 0 ? (
                <p className="px-1 py-4 text-sm text-muted-foreground">
                  {members.length <= 1
                    ? "A head has to already be a teacher here."
                    : "No match."}
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {headOptions.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onSetHead(t)
                        back()
                      }}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-muted"
                    >
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback className="text-[11px]">
                          {initials(t.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{t.full_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {view === "add-subject" && (
          <>
            <SheetHeader className="flex-row items-center gap-2 space-y-0">
              <button
                type="button"
                onClick={back}
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
                onClick={back}
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
                      className="flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-muted disabled:opacity-60"
                    >
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback className="text-[11px]">
                          {initials(t.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate">
                        {t.full_name}
                      </span>
                      {t.department_id && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          Moves
                        </span>
                      )}
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

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Discard {pendingSubject?.subject_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              It needs at least one grade before it can run anywhere. Closing
              now won't add it to this department — you'd need to pick it again
              from the start.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false)
                onOpenChange(false)
                reset()
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
