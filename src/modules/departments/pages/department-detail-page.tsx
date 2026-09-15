import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  CaretDownIcon,
  CaretRightIcon,
  CheckIcon,
  CrownSimpleIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { describeGrades, gradeLabel } from "@/lib/grades"
import { showError } from "@/lib/show-error"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyNote } from "@/components/shared/empty-note"
import { Sticker } from "@/components/shared/sticker"
import { EditDepartmentDrawer } from "@/modules/departments/components/edit-department-drawer"
import { TeacherAllotment } from "@/modules/departments/components/teacher-allotment"
import { lookFor } from "@/modules/departments/lib/department-look"
import type {
  Department,
  SubjectLite,
  SubjectOption,
  Teacher,
} from "@/modules/departments/lib/types"

/**
 * One department's page. Reached by opening its card, with the trail back in
 * the header — a card with contents of its own is a page, not a drawer.
 */
export function DepartmentDetailPage() {
  const { id = "" } = useParams()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const navigate = useNavigate()

  const [departments, setDepartments] = useState<Department[] | null>(null)
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const [d, s, t] = await Promise.all([
        apiClient.get<{ departments: Department[] }>("/api/departments"),
        apiClient.get<{ subjects: SubjectOption[] }>("/api/subjects"),
        apiClient
          .get<{ teachers: Teacher[] }>("/api/auth/teachers")
          .catch(() => ({ teachers: [] })),
      ])
      setDepartments(d.departments ?? [])
      setSubjects(s.subjects ?? [])
      setTeachers(t.teachers ?? [])
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load this department"
      )
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const dept = useMemo(
    () => departments?.find((d) => d.id === id) ?? null,
    [departments, id]
  )
  const members = useMemo(
    () => teachers.filter((t) => t.department_id === id),
    [teachers, id]
  )
  // Which department owns each subject — a subject sits in exactly one
  // (founder's bucket model), so this is a plain lookup, not a best guess.
  const departmentIdBySubject = useMemo(() => {
    const m: Record<string, string> = {}
    for (const d of departments ?? [])
      for (const s of d.subjects) m[s.id] = d.id
    return m
  }, [departments])
  const departmentNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const d of departments ?? []) m[d.id] = d.name
    return m
  }, [departments])

  // Writes land locally first and go out one at a time.
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const send = useCallback(
    (fn: () => Promise<unknown>) => {
      chain.current = chain.current.then(fn).catch((e) => {
        showError(e, "That did not save")
        return load()
      })
      return chain.current
    },
    [load]
  )
  const patch = (fn: (d: Department) => Department) =>
    setDepartments(
      (prev) => prev?.map((d) => (d.id === id ? fn(d) : d)) ?? prev
    )

  // One head per department — picking a new one replaces whoever held it.
  const setHead = (t: Teacher | null) => {
    if (!dept) return
    const heads = t ? [{ id: t.id, full_name: t.full_name }] : []
    patch((x) => ({ ...x, heads }))
    send(() =>
      apiClient.put(`/api/departments/${id}/heads`, {
        user_ids: heads.map((h) => h.id),
      })
    )
  }
  const toggleSubject = (s: SubjectLite) => {
    if (!dept) return
    const next = dept.subjects.some((x) => x.id === s.id)
      ? dept.subjects.filter((x) => x.id !== s.id)
      : [...dept.subjects, s].sort((a, b) =>
          a.subject_name.localeCompare(b.subject_name)
        )
    patch((x) => ({ ...x, subjects: next }))
    send(() =>
      apiClient.put(`/api/departments/${id}/subjects`, {
        subject_ids: next.map((x) => x.id),
      })
    )
  }
  // A teacher's allotment, edited from the department's own teachers widget —
  // the same rows the teacher's own form writes, reached by the other door.
  const patchTeacher = (tid: string, fn: (t: Teacher) => Teacher) =>
    setTeachers((prev) => prev.map((t) => (t.id === tid ? fn(t) : t)))

  const setTeacherSubjects = (
    t: Teacher,
    subjectIds: string[],
    primaryId: string
  ) => {
    const byId = new Map(subjects.map((s) => [s.id, s]))
    patchTeacher(t.id, (x) => ({
      ...x,
      teachable_subjects: subjectIds
        .map((sid) => ({
          id: sid,
          subject_name: byId.get(sid)?.subject_name ?? "",
          is_primary: sid === primaryId,
        }))
        .sort(
          (a, b) =>
            Number(b.is_primary) - Number(a.is_primary) ||
            a.subject_name.localeCompare(b.subject_name)
        ),
    }))
    send(async () => {
      await apiClient.put(`/api/auth/teacher/${t.id}/subjects`, {
        subject_ids: subjectIds,
        primary_subject_id: primaryId,
      })
      // The primary subject decides the department, so a change here can move
      // the teacher out of this page's list entirely — reload rather than
      // guess where they landed.
      return load()
    })
  }

  const setTeacherGrades = (t: Teacher, grades: number[]) => {
    patchTeacher(t.id, (x) => ({ ...x, teachable_grades: grades }))
    send(() => apiClient.put(`/api/auth/teacher/${t.id}/grades`, { grades }))
  }

  /**
   * Put existing teachers in this department. When it owns exactly one
   * subject there is nothing to choose, so they get it as their primary —
   * which is itself what files them here. Otherwise set the department
   * directly and let each row say which of its subjects they take.
   */
  const addTeachers = (picked: Teacher[]) => {
    if (!picked.length || !dept) return
    const only = dept.subjects.length === 1 ? dept.subjects[0] : null
    for (const t of picked) {
      patchTeacher(t.id, (x) => ({
        ...x,
        department_id: id,
        teachable_subjects: only
          ? [{ ...only, is_primary: true }]
          : (x.teachable_subjects ?? []),
      }))
    }
    send(async () => {
      for (const t of picked) {
        if (only) {
          await apiClient.put(`/api/auth/teacher/${t.id}/subjects`, {
            subject_ids: [only.id],
            primary_subject_id: only.id,
          })
        } else {
          await apiClient.put(`/api/auth/teacher/${t.id}`, {
            department_id: id,
          })
        }
      }
      return load()
    })
  }

  const remove = async () => {
    if (!dept) return
    setBusy("del")
    try {
      await chain.current
      await apiClient.delete(`/api/departments/${id}`)
      toast.success(`${dept.name} deleted`)
      navigate("/departments")
    } catch (e) {
      showError(e)
    } finally {
      setBusy(null)
    }
  }

  if (error) {
    return (
      <div
        className={cn(
          PAGE_GUTTER,
          PAGE_TOP,
          "flex flex-col items-center gap-3 py-16 text-center"
        )}
      >
        <Sticker name="worried" size={88} />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    )
  }
  if (departments === null) {
    return (
      <div className={cn(PAGE_GUTTER, PAGE_TOP, "flex flex-col gap-5 pb-12")}>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (!dept) {
    return (
      <div
        className={cn(
          PAGE_GUTTER,
          PAGE_TOP,
          "flex flex-col items-center gap-3 py-16 text-center"
        )}
      >
        <Sticker name="worried" size={88} />
        <p className="text-base font-medium text-secondary-foreground">
          That department is gone
        </p>
        <Button variant="outline" asChild>
          <Link to="/departments">Back to departments</Link>
        </Button>
      </div>
    )
  }

  const { Icon, palette } = lookFor(dept.name)
  const isGeneral = dept.name.toLowerCase() === "general"
  const blocked = dept.member_count > 0 || dept.subjects.length > 0

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex min-h-full flex-col gap-5 pb-12"
      )}
    >
      {/* The trail back */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <Link
          to="/departments"
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Departments
        </Link>
        <CaretRightIcon className="size-3" aria-hidden />
        <span className="truncate text-foreground">{dept.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-xl text-white",
              palette.cover
            )}
          >
            <Icon className="size-6" weight="fill" aria-hidden />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {dept.name}
              </h1>
              <HeadTag
                head={dept.heads[0] ?? null}
                members={members}
                isAdmin={isAdmin}
                onPick={setHead}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {dept.member_count}{" "}
              {dept.member_count === 1 ? "teacher" : "teachers"}
              {" · "}
              {dept.subjects.length}{" "}
              {dept.subjects.length === 1 ? "subject" : "subjects"}
              {" · "}
              {describeGrades(dept.grades)}
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <PencilIcon className="size-4" />
                Edit
              </Button>
              {!isGeneral && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${dept.name}`}
                  onClick={remove}
                  disabled={busy === "del" || blocked}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <TrashIcon className="size-4" />
                </Button>
              )}
            </div>
            {blocked && !isGeneral && (
              <span className="text-[11px] text-muted-foreground">
                Move its teachers and subjects out first
              </span>
            )}
          </div>
        )}
      </div>

      {/* What the department is, in brief. Changed only from Edit — this
          is the record's summary, not a second place to edit it. */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5">
        <SummaryRow label="Subjects">
          {dept.subjects.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              None yet — add them from Edit
            </span>
          ) : (
            dept.subjects.map((s) => (
              <span
                key={s.id}
                className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground"
              >
                {s.subject_name}
              </span>
            ))
          )}
        </SummaryRow>
        <SummaryRow label="Grades">
          {dept.grades.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              Follows the grades its subjects run in
            </span>
          ) : (
            dept.grades.map((g) => (
              <span
                key={g}
                className="min-w-7 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-center text-xs text-foreground tabular-nums"
              >
                {gradeLabel(g)}
              </span>
            ))
          )}
        </SummaryRow>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Teachers</h2>
          {isAdmin && (
            <AddTeachers
              candidates={teachers.filter((t) => t.department_id !== id)}
              departmentNameById={departmentNameById}
              onAdd={addTeachers}
            />
          )}
        </div>
        {members.length === 0 ? (
          <EmptyNote
            icon={UsersThreeIcon}
            title="No teachers here yet"
            hint="Add one above, or give a teacher one of this department's subjects from their own profile."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {members.map((t) => {
              const isHead = dept.heads.some((h) => h.id === t.id)
              return (
                <li
                  key={t.id}
                  className="flex flex-col gap-2 py-3 @2xl:flex-row @2xl:items-start @2xl:gap-6"
                >
                  <div className="min-w-0 @2xl:w-56 @2xl:shrink-0">
                    <span className="flex items-center gap-1.5 text-sm text-foreground">
                      <span className="truncate">{t.full_name}</span>
                      {isHead && (
                        <CrownSimpleIcon
                          weight="fill"
                          aria-label="Head of department"
                          className="size-3.5 shrink-0 text-amber-500"
                        />
                      )}
                    </span>
                    {t.designation && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.designation}
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="min-w-0 flex-1">
                      <TeacherAllotment
                        teacher={t}
                        departmentSubjects={dept.subjects}
                        deptId={id}
                        departmentIdBySubject={departmentIdBySubject}
                        departmentNameById={departmentNameById}
                        onSetSubjects={(sids, pid) =>
                          setTeacherSubjects(t, sids, pid)
                        }
                        onSetGrades={(g) => setTeacherGrades(t, g)}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <EditDepartmentDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        dept={dept}
        members={members}
        allSubjects={subjects}
        allTeachers={teachers}
        onRemoveSubject={toggleSubject}
        onSetHead={setHead}
        onChanged={load}
      />
    </div>
  )
}

function SummaryRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

/**
 * Put existing teachers in this department. Search, tick several, add them
 * in one go (founder, 2026-09-15: "a teacher look up opens up for me to
 * search and multi select and add them here"). A teacher who already sits
 * somewhere else says so, so moving them is never a surprise.
 */
function AddTeachers({
  candidates,
  departmentNameById,
  onAdd,
}: {
  candidates: Teacher[]
  departmentNameById: Record<string, string>
  onAdd: (picked: Teacher[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const q = query.trim().toLowerCase()
  const shown = q
    ? candidates.filter((t) => t.full_name.toLowerCase().includes(q))
    : candidates

  const close = () => {
    setOpen(false)
    setQuery("")
    setPicked([])
  }

  return (
    <Popover open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusIcon className="size-4" />
          Add a teacher
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="w-80 max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="border-b border-border p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teachers"
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {shown.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              {candidates.length === 0
                ? "Every teacher is already here."
                : "No match."}
            </p>
          ) : (
            shown.map((t) => {
              const on = picked.includes(t.id)
              const from = t.department_id
                ? departmentNameById[t.department_id]
                : null
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setPicked((prev) =>
                      on ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                    )
                  }
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded border",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    )}
                  >
                    {on && <CheckIcon className="size-3" weight="bold" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{t.full_name}</span>
                  {from && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      in {from}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
        <div className="border-t border-border p-2">
          <Button
            size="sm"
            className="w-full"
            disabled={picked.length === 0}
            onClick={() => {
              onAdd(candidates.filter((t) => picked.includes(t.id)))
              close()
            }}
          >
            {picked.length > 1
              ? `Add ${picked.length} teachers`
              : "Add teacher"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

/**
 * The head, right next to the department's name — a tag, not a widget of
 * its own (founder, 2026-09-15: "add head of department as a tag like
 * dropdown to select from teachers rather than a widget"). One head per
 * department: picking someone else replaces whoever held it, so this is a
 * single current-head row plus a search list, never a multi-select (founder,
 * 2026-09-15: "there can only be one HOD for a department"). Sized to stay
 * inside the viewport at any width.
 */
function HeadTag({
  head,
  members,
  isAdmin,
  onPick,
}: {
  head: { id: string; full_name: string } | null
  members: Teacher[]
  isAdmin: boolean
  onPick: (t: Teacher | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const options = members
    .filter((t) => t.id !== head?.id)
    .filter((t) => (q ? t.full_name.toLowerCase().includes(q) : true))

  const label = head?.full_name ?? "Head of department"

  if (!isAdmin) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pr-2.5 pl-1 text-xs text-muted-foreground">
        {head && (
          <Avatar className="size-4">
            <AvatarFallback className="text-[9px]">
              {initials(head.full_name)}
            </AvatarFallback>
          </Avatar>
        )}
        {label}
        {head && (
          <CrownSimpleIcon
            weight="fill"
            className="size-3 shrink-0 text-amber-500"
          />
        )}
      </span>
    )
  }

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
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border py-1 pr-2 text-xs transition-colors",
            head
              ? "border-transparent bg-muted pl-1 text-foreground hover:bg-muted/70"
              : "border-dashed border-border pl-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {head && (
            <Avatar className="size-4">
              <AvatarFallback className="text-[9px]">
                {initials(head.full_name)}
              </AvatarFallback>
            </Avatar>
          )}
          {label}
          {head && (
            <CrownSimpleIcon
              weight="fill"
              className="size-3 shrink-0 text-amber-500"
            />
          )}
          <CaretDownIcon className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-72 max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">
                {head ? initials(head.full_name) : "—"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {head?.full_name ?? "No head yet"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Head of department
              </p>
            </div>
          </div>
          {head && (
            <button
              type="button"
              onClick={() => {
                onPick(null)
                setOpen(false)
              }}
              className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          )}
        </div>
        <div className="border-b border-border p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={head ? "Change to another teacher" : "Search teachers"}
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {options.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              {members.length === 0
                ? "Add a teacher to this department first."
                : q
                  ? "No match."
                  : "No other teacher in this department."}
            </p>
          ) : (
            options.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onPick(t)
                  setOpen(false)
                  setQuery("")
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <Avatar className="size-6 shrink-0">
                  <AvatarFallback className="text-[10px]">
                    {initials(t.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate">{t.full_name}</span>
                {t.designation && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {t.designation}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
