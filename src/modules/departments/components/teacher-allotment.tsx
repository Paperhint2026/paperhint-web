import { useState } from "react"
import { PlusIcon, StarIcon, XIcon } from "@phosphor-icons/react"

import { GRADES, gradeLabel } from "@/lib/grades"
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
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { SubjectLite, Teacher } from "@/modules/departments/lib/types"

/**
 * A teacher's allotment, edited from inside the department they sit in
 * (founder, 2026-09-15: a junction row is one record with two doors — "the
 * user can either do it at teacher level edit or, more through natural
 * instinct, during the department level").
 *
 * Only a MULTI-SUBJECT department shows a subject choice at all. A teacher is
 * in this department because of the subject they were given when they were
 * created, so in an English department there is no alternative to pick and
 * the row would just repeat the department's own name on every teacher
 * (founder: "why would an English department teacher have to choose another
 * alternative subject"). Where the choice is real — Art & Culture holding
 * Art, Music and Dance — this is how you say who takes which.
 *
 * The picker therefore offers only THIS department's subjects. The primary
 * subject has no remove button: it is what holds them here, so you move the
 * star instead. A teacher may still hold a subject from elsewhere (given in
 * their own form); starring that one moves them out of the list you are
 * standing in, which asks first.
 */
export function TeacherAllotment({
  teacher,
  departmentSubjects,
  deptId,
  departmentIdBySubject,
  departmentNameById,
  onSetSubjects,
  onSetGrades,
}: {
  teacher: Teacher
  departmentSubjects: SubjectLite[]
  deptId: string
  departmentIdBySubject: Record<string, string>
  departmentNameById: Record<string, string>
  onSetSubjects: (subjectIds: string[], primaryId: string) => void
  onSetGrades: (grades: number[]) => void
}) {
  const held = teacher.teachable_subjects ?? []
  const grades = teacher.teachable_grades ?? []
  const primary = held.find((s) => s.is_primary) ?? null
  const [moving, setMoving] = useState<{ id: string; to: string } | null>(null)

  const ids = held.map((s) => s.id)
  // Nothing to say unless there is a real choice to represent.
  const showSubjects = departmentSubjects.length > 1 || held.length > 1
  const setPrimary = (id: string) => onSetSubjects(ids, id)

  const star = (id: string) => {
    const owner = departmentIdBySubject[id]
    if (owner && owner !== deptId) {
      setMoving({ id, to: departmentNameById[owner] ?? "another department" })
      return
    }
    setPrimary(id)
  }

  const add = (id: string) => {
    // The first subject a teacher gets has to be the primary — the API
    // requires one, and it is what files them under a department.
    onSetSubjects([...ids, id], primary?.id ?? id)
  }

  const drop = (id: string) => {
    const next = ids.filter((x) => x !== id)
    if (!next.length || !primary) return
    onSetSubjects(next, primary.id)
  }

  const toggleGrade = (g: number) =>
    onSetGrades(
      (grades.includes(g)
        ? grades.filter((x) => x !== g)
        : [...grades, g]
      ).sort((a, b) => a - b)
    )

  return (
    <div className="flex flex-col gap-2">
      {showSubjects && (
        <Row label="Subjects">
          {held.map((s) => {
            const isPrimary = s.is_primary
            return (
              <span
                key={s.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-2.5 text-xs",
                  isPrimary
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-foreground"
                )}
              >
                {!isPrimary && (
                  <button
                    type="button"
                    onClick={() => star(s.id)}
                    aria-label={`Make ${s.subject_name} the primary subject`}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <StarIcon className="size-3" />
                  </button>
                )}
                {isPrimary && <StarIcon className="size-3" weight="fill" />}
                {s.subject_name}
                {isPrimary ? (
                  <span className="px-1" />
                ) : (
                  <button
                    type="button"
                    onClick={() => drop(s.id)}
                    aria-label={`Remove ${s.subject_name}`}
                    className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <XIcon className="size-3" />
                  </button>
                )}
              </span>
            )
          })}
          <SubjectPicker
            options={departmentSubjects.filter((s) => !ids.includes(s.id))}
            onPick={add}
          />
        </Row>
      )}

      <Row label="Grades">
        {grades.map((g) => (
          <span
            key={g}
            className="min-w-7 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-center text-xs text-foreground tabular-nums"
          >
            {gradeLabel(g)}
          </span>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PlusIcon className="size-3" />
              {grades.length ? "Edit" : "Add grades"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64">
            <div className="flex flex-wrap gap-1">
              {GRADES.map((g) => {
                const on = grades.includes(g)
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleGrade(g)}
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
          </PopoverContent>
        </Popover>
      </Row>

      <AlertDialog
        open={moving !== null}
        onOpenChange={(v) => !v && setMoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move {teacher.full_name} to {moving?.to}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The primary subject is what files a teacher under a department.
              Making this one primary moves them to {moving?.to}, so they will
              leave this list. What they can teach stays exactly as it is.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them here</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (moving) setPrimary(moving.id)
                setMoving(null)
              }}
            >
              Move them
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 shrink-0 text-[11px] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

/** Offers only what the teacher does not already hold, searchable. */
function SubjectPicker({
  options,
  onPick,
}: {
  options: SubjectLite[]
  onPick: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const shown = q
    ? options.filter((o) => o.subject_name.toLowerCase().includes(q))
    : options

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PlusIcon className="size-3" />
          Add
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="border-b border-border p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subjects"
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {shown.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              {options.length === 0
                ? "They already hold every subject."
                : "No match."}
            </p>
          ) : (
            shown.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onPick(o.id)
                  setOpen(false)
                  setQuery("")
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className="truncate">{o.subject_name}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
