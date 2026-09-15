import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowLeftIcon,
  CaretDownIcon,
  CaretRightIcon,
  PencilIcon,
  PlusIcon,
  StackIcon,
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
  const [tab, setTab] = useState<"teachers" | "subjects">("teachers")
  const reduceMotion = useReducedMotion()

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
  // A teacher's allotment, edited from the department's own Teachers tab —
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
                  size="sm"
                  onClick={remove}
                  disabled={busy === "del" || blocked}
                >
                  <TrashIcon className="size-4" />
                  Delete
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

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-1 border-b border-border">
          {(
            [
              {
                key: "teachers",
                label: "Teachers",
                icon: UsersThreeIcon,
                count: members.length,
              },
              {
                key: "subjects",
                label: "Subjects",
                icon: StackIcon,
                count: dept.subjects.length,
              },
            ] as const
          ).map((t) => {
            const on = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors outline-none focus-visible:text-foreground",
                  on
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon className="size-4" />
                {t.label}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    on ? "text-foreground/70" : "text-muted-foreground"
                  )}
                >
                  {t.count}
                </span>
                {on && (
                  <motion.span
                    layoutId="department-tab"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : {
                            type: "spring",
                            stiffness: 480,
                            damping: 40,
                            mass: 0.8,
                          }
                    }
                    className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-foreground"
                  />
                )}
              </button>
            )
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          >
            {tab === "teachers" ? (
              <section className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5">
                <div className="flex items-center justify-end gap-3">
                  <Link
                    to="/teachers"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Manage in Teachers →
                  </Link>
                </div>
                {members.length === 0 ? (
                  <EmptyNote
                    icon={UsersThreeIcon}
                    title="No teachers here yet"
                    hint="Add one from Edit, or a teacher can join from their own profile."
                    action={
                      isAdmin ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditOpen(true)}
                        >
                          <PencilIcon className="size-3.5" />
                          Edit
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/teachers">Open Teachers</Link>
                        </Button>
                      )
                    }
                  />
                ) : (
                  <ul className="-mr-2 flex max-h-[32rem] flex-col divide-y divide-border overflow-y-auto pr-2">
                    {members.map((t) => {
                      const isHead = dept.heads.some((h) => h.id === t.id)
                      return (
                        <li key={t.id} className="flex flex-col gap-2 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block truncate text-sm text-foreground">
                                {t.full_name}
                              </span>
                              {t.designation && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {t.designation}
                                </span>
                              )}
                            </span>
                            {isHead && (
                              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                                Head
                              </span>
                            )}
                          </div>
                          {isAdmin && (
                            <TeacherAllotment
                              teacher={t}
                              subjects={subjects}
                              deptId={id}
                              departmentIdBySubject={departmentIdBySubject}
                              departmentNameById={departmentNameById}
                              onSetSubjects={(sids, pid) =>
                                setTeacherSubjects(t, sids, pid)
                              }
                              onSetGrades={(g) => setTeacherGrades(t, g)}
                            />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            ) : (
              <section className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
                <div className="flex items-center justify-end gap-3">
                  <Link
                    to="/subjects"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    All subjects →
                  </Link>
                </div>
                {dept.subjects.length === 0 ? (
                  <EmptyNote
                    icon={StackIcon}
                    title="No subjects yet"
                    hint="Fine for a Library or Physical Education department; otherwise add one below."
                  />
                ) : (
                  <ul className="-mr-2 flex max-h-72 flex-col divide-y divide-border overflow-y-auto pr-2">
                    {dept.subjects.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <span className="truncate text-sm text-foreground">
                          {s.subject_name}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => toggleSubject(s)}
                            className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {isAdmin && (
                  <div className="flex">
                    <Picker
                      label="Add subject"
                      empty="Every subject is already here."
                      options={subjects
                        .filter(
                          (x) => !dept.subjects.some((y) => y.id === x.id)
                        )
                        .map((x) => ({ id: x.id, label: x.subject_name }))}
                      onPick={(sid) => {
                        const s = subjects.find((x) => x.id === sid)
                        if (s) toggleSubject(s)
                      }}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    Grades it serves
                  </h3>
                  {dept.subjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Grades follow the subjects a department owns.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-foreground">
                        {dept.grades.length === 0
                          ? "Its subjects are not placed in any grade yet"
                          : describeGrades(dept.grades, "")}
                      </p>
                      {dept.grades.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {dept.grades.map((g) => (
                            <span
                              key={g}
                              className="min-w-8 rounded-md border border-border bg-muted/50 px-2 py-1 text-center text-xs text-foreground tabular-nums"
                            >
                              {gradeLabel(g)}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Read from the subjects it owns.{" "}
                        <Link
                          to="/subjects"
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          Change a subject&apos;s grades
                        </Link>
                        .
                      </p>
                    </>
                  )}
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

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

/** Selection lives outside; this offers only the rest, searchable. */
function Picker({
  label,
  options,
  onPick,
  empty,
}: {
  label: string
  options: { id: string; label: string; note?: string }[]
  onPick: (id: string) => void
  empty: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const shown = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
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
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PlusIcon className="size-3" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="border-b border-border p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {shown.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">{empty}</p>
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
                <span className="truncate">{o.label}</span>
                {o.note && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {o.note}
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
