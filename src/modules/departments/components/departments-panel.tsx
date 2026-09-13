import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CircleNotchIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Departments & subjects (module 02) — the page body. A department groups people; a
 * subject is what a grade teaches. Department → subjects it owns → grades each
 * subject runs in. Heads are many. Subject-less departments (PT, Library) are
 * valid. "General" is the fallback and cannot be deleted.
 */

type Head = { id: string; full_name: string }
type SubjectLite = { id: string; subject_name: string }
type Department = {
  id: string
  name: string
  heads: Head[]
  grades: number[]
  subjects: SubjectLite[]
  member_count: number
}
type Teacher = { id: string; full_name: string; department_id?: string | null }

const GRADES = Array.from({ length: 13 }, (_, i) => i) // 0 = KG … 12
const gradeLabel = (g: number) => (g === 0 ? "KG" : String(g))

export function DepartmentsPanel() {
  const [departments, setDepartments] = useState<Department[] | null>(null)
  const [subjects, setSubjects] = useState<SubjectLite[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [gradeSubjects, setGradeSubjects] = useState<Record<string, number[]>>(
    {}
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [d, s, t, g] = await Promise.all([
        apiClient.get<{ departments: Department[] }>("/api/departments"),
        apiClient.get<{ subjects: SubjectLite[] }>("/api/subjects"),
        apiClient
          .get<{ teachers: Teacher[] }>("/api/auth/teachers")
          .catch(() => ({ teachers: [] })),
        apiClient.get<{ grade_subjects: Record<string, number[]> }>(
          "/api/departments/grade-subjects"
        ),
      ])
      setDepartments(d.departments ?? [])
      setSubjects(s.subjects ?? [])
      setTeachers(t.teachers ?? [])
      setGradeSubjects(g.grade_subjects ?? {})
      setSelectedId((cur) => cur ?? d.departments?.[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load departments")
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const selected = useMemo(
    () => departments?.find((d) => d.id === selectedId) ?? null,
    [departments, selectedId]
  )

  const run = async (
    key: string,
    fn: () => Promise<unknown>,
    done?: string
  ) => {
    setBusy(key)
    try {
      await fn()
      if (done) toast.success(done)
      await load()
    } catch (e) {
      if (e instanceof Error) toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  const createDepartment = () =>
    run(
      "new",
      async () => {
        const r = await apiClient.post<{ department: { id: string } }>(
          "/api/departments",
          {
            name: newName.trim(),
          }
        )
        setNewName("")
        setSelectedId(r.department.id)
      },
      "Department added"
    )

  const toggleGrade = (d: Department, g: number) =>
    run(`g${g}`, () =>
      apiClient.put(`/api/departments/${d.id}/grades`, {
        grades: d.grades.includes(g)
          ? d.grades.filter((x) => x !== g)
          : [...d.grades, g],
      })
    )

  const toggleHead = (d: Department, t: Teacher) =>
    run(`h${t.id}`, () =>
      apiClient.put(`/api/departments/${d.id}/heads`, {
        user_ids: d.heads.some((h) => h.id === t.id)
          ? d.heads.filter((h) => h.id !== t.id).map((h) => h.id)
          : [...d.heads.map((h) => h.id), t.id],
      })
    )

  const toggleSubject = (d: Department, s: SubjectLite) =>
    run(`s${s.id}`, () =>
      apiClient.put(`/api/departments/${d.id}/subjects`, {
        subject_ids: d.subjects.some((x) => x.id === s.id)
          ? d.subjects.filter((x) => x.id !== s.id).map((x) => x.id)
          : [...d.subjects.map((x) => x.id), s.id],
      })
    )

  const toggleSubjectGrade = (s: SubjectLite, g: number) => {
    const cur = gradeSubjects[s.id] ?? []
    return run(`sg${s.id}${g}`, () =>
      apiClient.put(`/api/departments/grade-subjects/${s.id}`, {
        grades: cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g],
      })
    )
  }

  const createSubject = (d: Department, name: string) =>
    run(
      "newsub",
      async () => {
        const r = await apiClient.post<{ subject: SubjectLite }>(
          "/api/subjects",
          {
            subject_name: name.trim(),
          }
        )
        await apiClient.put(`/api/departments/${d.id}/subjects`, {
          subject_ids: [...d.subjects.map((x) => x.id), r.subject.id],
        })
      },
      "Subject added"
    )

  const removeDepartment = (d: Department) =>
    run(
      "del",
      async () => {
        await apiClient.delete(`/api/departments/${d.id}`)
        setSelectedId(null)
      },
      `${d.name} deleted`
    )

  const deptTeachers = useMemo(() => {
    if (!selected) return []
    const inDept = teachers.filter((t) => t.department_id === selected.id)
    const rest = teachers.filter((t) => t.department_id !== selected.id)
    return [...inDept, ...rest]
  }, [teachers, selected])

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : departments === null ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          {/* Department list */}
          <div className="flex flex-col gap-1">
            {departments.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                aria-current={selectedId === d.id ? "true" : undefined}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  selectedId === d.id
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <span className="truncate">{d.name}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {d.member_count}
                </span>
              </button>
            ))}
            <form
              className="mt-2 flex gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                if (newName.trim()) createDepartment()
              }}
            >
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New department"
                className="h-8 text-sm"
              />
              <Button
                type="submit"
                size="icon"
                className="size-8 shrink-0"
                disabled={!newName.trim() || busy === "new"}
              >
                {busy === "new" ? (
                  <CircleNotchIcon className="size-4 animate-spin" />
                ) : (
                  <PlusIcon className="size-4" />
                )}
              </Button>
            </form>
          </div>

          {/* Detail */}
          {selected ? (
            <div className="flex min-w-0 flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-medium text-foreground">
                    {selected.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selected.member_count}{" "}
                    {selected.member_count === 1 ? "member" : "members"}
                    {" · "}
                    {selected.subjects.length}{" "}
                    {selected.subjects.length === 1 ? "subject" : "subjects"}
                  </p>
                </div>
                {selected.name.toLowerCase() !== "general" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDepartment(selected)}
                    disabled={
                      busy === "del" ||
                      selected.member_count > 0 ||
                      selected.subjects.length > 0
                    }
                  >
                    <TrashIcon className="size-4" />
                    Delete
                  </Button>
                )}
              </div>

              {/* Grades served */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Grades this department serves</Label>
                <div className="flex flex-wrap gap-1">
                  {GRADES.map((g) => {
                    const on = selected.grades.includes(g)
                    return (
                      <button
                        key={g}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleGrade(selected, g)}
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
              </div>

              {/* Heads — selection plus an Add picker, never every candidate
                  (docs/modules/00-principles.md) */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Heads of department</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {selected.heads.map((h) => (
                    <span
                      key={h.id}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground"
                    >
                      {h.full_name}
                      <button
                        type="button"
                        aria-label={`Remove ${h.full_name} as head`}
                        onClick={() =>
                          toggleHead(selected, {
                            id: h.id,
                            full_name: h.full_name,
                          })
                        }
                        disabled={busy === `h${h.id}`}
                        className="grid size-3.5 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-destructive"
                      >
                        <XIcon className="size-2.5" />
                      </button>
                    </span>
                  ))}
                  <AddPicker
                    label="Add head"
                    empty={
                      deptTeachers.length === 0
                        ? "Add teachers first, then pick heads here."
                        : "No one matches."
                    }
                    options={deptTeachers
                      .filter((t) => !selected.heads.some((h) => h.id === t.id))
                      .map((t) => ({
                        id: t.id,
                        label: t.full_name,
                        note:
                          t.department_id === selected.id
                            ? "in this department"
                            : undefined,
                      }))}
                    onPick={(id) => {
                      const t = teachers.find((x) => x.id === id)
                      if (t) toggleHead(selected, t)
                    }}
                  />
                </div>
                {selected.heads.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    No head yet. A head sees their department&apos;s work.
                  </p>
                )}
              </div>

              {/* Subjects owned, with the grades each runs in */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Subjects this department owns</Label>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {selected.subjects.length === 0 && (
                    <li className="px-3 py-2 text-xs text-muted-foreground">
                      No subjects. Fine for PT or Library; add one below
                      otherwise.
                    </li>
                  )}
                  {selected.subjects.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center gap-2 px-3 py-2"
                    >
                      <span className="min-w-28 text-sm text-foreground">
                        {s.subject_name}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {GRADES.map((g) => {
                          const on = (gradeSubjects[s.id] ?? []).includes(g)
                          return (
                            <button
                              key={g}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleSubjectGrade(s, g)}
                              className={cn(
                                "min-w-6 rounded border px-1 text-[11px] tabular-nums",
                                on
                                  ? "border-primary/60 bg-primary/10 text-foreground"
                                  : "border-border/60 text-muted-foreground/70 hover:bg-muted"
                              )}
                            >
                              {gradeLabel(g)}
                            </button>
                          )
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSubject(selected, s)}
                        className="ml-auto text-xs text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <AddPicker
                  label="Add subject"
                  empty="Every subject is already here. Type a name to create one."
                  options={subjects
                    .filter(
                      (x) => !selected.subjects.some((y) => y.id === x.id)
                    )
                    .map((x) => ({ id: x.id, label: x.subject_name }))}
                  onPick={(id) => {
                    const sub = subjects.find((x) => x.id === id)
                    if (sub) toggleSubject(selected, sub)
                  }}
                  onCreate={(name) => createSubject(selected, name)}
                  createLabel="Create subject"
                />
              </div>

              {selected.heads.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selected.heads.map((h) => (
                    <Badge
                      key={h.id}
                      variant="secondary"
                      className="rounded-full"
                    >
                      Head · {h.full_name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick a department, or add the first one.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The picker pattern used everywhere a set is chosen: what is selected lives
 * outside as chips; this shows only the rest, searchable, behind one button.
 * `onCreate` turns the search text into a new option when nothing matches.
 */
function AddPicker({
  label,
  options,
  onPick,
  onCreate,
  createLabel,
  empty,
}: {
  label: string
  options: { id: string; label: string; note?: string }[]
  onPick: (id: string) => void
  onCreate?: (name: string) => void | Promise<unknown>
  createLabel?: string
  empty: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const shown = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options
  const exact = options.some((o) => o.label.toLowerCase() === q)

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
          {onCreate && q && !exact && (
            <button
              type="button"
              onClick={async () => {
                await onCreate(query.trim())
                setOpen(false)
                setQuery("")
              }}
              className="mt-1 flex w-full items-center gap-1.5 rounded-md border-t border-border px-2 py-2 text-left text-sm text-primary hover:bg-muted"
            >
              <PlusIcon className="size-3.5" />
              {createLabel ?? "Create"} &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
