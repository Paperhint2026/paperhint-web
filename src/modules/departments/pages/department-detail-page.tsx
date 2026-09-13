import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  BookmarkSimpleIcon,
  CaretRightIcon,
  PlusIcon,
  StackIcon,
  TrashIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { describeGrades, GRADES, gradeLabel } from "@/lib/grades"
import { showError } from "@/lib/show-error"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyNote } from "@/components/shared/empty-note"
import { Sticker } from "@/components/shared/sticker"
import { lookFor } from "@/modules/departments/lib/department-look"
import type {
  Department,
  SubjectLite,
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
  const [subjects, setSubjects] = useState<SubjectLite[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [d, s, t] = await Promise.all([
        apiClient.get<{ departments: Department[] }>("/api/departments"),
        apiClient.get<{ subjects: SubjectLite[] }>("/api/subjects"),
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

  const setGrades = (grades: number[]) => {
    patch((x) => ({ ...x, grades }))
    send(() => apiClient.put(`/api/departments/${id}/grades`, { grades }))
  }
  const toggleGrade = (g: number) => {
    if (!dept) return
    setGrades(
      (dept.grades.includes(g)
        ? dept.grades.filter((x) => x !== g)
        : [...dept.grades, g]
      ).sort((a, b) => a - b)
    )
  }
  const toggleHead = (t: Teacher) => {
    if (!dept) return
    const heads = dept.heads.some((h) => h.id === t.id)
      ? dept.heads.filter((h) => h.id !== t.id)
      : [...dept.heads, { id: t.id, full_name: t.full_name }]
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
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {dept.name}
            </h1>
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
        {isAdmin && !isGeneral && (
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={remove}
              disabled={busy === "del" || blocked}
            >
              <TrashIcon className="size-4" />
              Delete
            </Button>
            {blocked && (
              <span className="text-[11px] text-muted-foreground">
                Move its teachers and subjects out first
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid content-start gap-4 @3xl:grid-cols-2">
        {/* Teachers */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              Teachers
              {members.length > 0 && (
                <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
                  {members.length}
                </span>
              )}
            </h2>
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
              hint="A teacher joins a department from their own profile."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/teachers">Open Teachers</Link>
                </Button>
              }
            />
          ) : (
            <ul className="-mr-2 flex max-h-72 flex-col divide-y divide-border overflow-y-auto pr-2">
              {members.map((t) => {
                const isHead = dept.heads.some((h) => h.id === t.id)
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
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
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Heads */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Heads of department
          </h2>
          {dept.heads.length > 0 && (
            <div className="-mr-2 flex max-h-40 flex-wrap items-start gap-1.5 overflow-y-auto pr-2">
              {dept.heads.map((h) => (
                <span
                  key={h.id}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground"
                >
                  {h.full_name}
                  {isAdmin && (
                    <button
                      type="button"
                      aria-label={`Remove ${h.full_name} as head`}
                      onClick={() =>
                        toggleHead({ id: h.id, full_name: h.full_name })
                      }
                      className="grid size-3.5 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-destructive"
                    >
                      <XIcon className="size-2.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {isAdmin && (
            <div className="flex">
              <Picker
                label="Add head"
                empty={
                  teachers.length === 0
                    ? "Add teachers first."
                    : "No one matches."
                }
                options={[
                  ...members,
                  ...teachers.filter((t) => t.department_id !== id),
                ]
                  .filter((t) => !dept.heads.some((h) => h.id === t.id))
                  .map((t) => ({
                    id: t.id,
                    label: t.full_name,
                    note:
                      t.department_id === id ? "in this department" : undefined,
                  }))}
                onPick={(pid) => {
                  const t = teachers.find((x) => x.id === pid)
                  if (t) toggleHead(t)
                }}
              />
            </div>
          )}
          {dept.heads.length === 0 && (
            <EmptyNote
              icon={BookmarkSimpleIcon}
              title="No head yet"
              hint={
                members.length === 0
                  ? "Add a teacher to this department first."
                  : "A head sees their department's work and approves inside it."
              }
            />
          )}
        </section>

        {/* Subjects */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              Subjects it owns
            </h2>
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
                  .filter((x) => !dept.subjects.some((y) => y.id === x.id))
                  .map((x) => ({ id: x.id, label: x.subject_name }))}
                onPick={(sid) => {
                  const s = subjects.find((x) => x.id === sid)
                  if (s) toggleSubject(s)
                }}
              />
            </div>
          )}
        </section>

        {/* Grades */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              Grades it serves
            </h2>
            {isAdmin && dept.grades.length > 0 && (
              <button
                type="button"
                onClick={() => setGrades([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Serve all grades
              </button>
            )}
          </div>
          <p className="text-sm text-foreground">
            {describeGrades(dept.grades)}
          </p>
          {isAdmin && (
            <>
              <Label className="text-xs text-muted-foreground">
                Nothing ticked means every grade. Ticking 1 to 5 already says
                primary — the band is read back, never typed.
              </Label>
              <div className="flex flex-wrap gap-1">
                {GRADES.map((g) => {
                  const on = dept.grades.includes(g)
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
            </>
          )}
        </section>
      </div>
    </div>
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
