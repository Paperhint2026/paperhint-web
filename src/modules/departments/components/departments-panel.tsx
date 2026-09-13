import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CircleNotchIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
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

  /**
   * Writes are serialised and applied locally first. Toggling a set sends the
   * whole set, so two clicks in flight must not each compute it from the same
   * stale copy — the local patch lands before the next click reads it, and the
   * queue keeps the server seeing them in the order they were made.
   */
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const send = useCallback(
    (fn: () => Promise<unknown>, done?: string) => {
      chain.current = chain.current
        .then(fn)
        .then(() => {
          if (done) toast.success(done)
        })
        .catch((e) => {
          toast.error(e instanceof Error ? e.message : "That did not save")
          return load() // resync: the local copy is now a guess
        })
      return chain.current
    },
    [load]
  )

  /** Structural changes (create, delete) still reload — ids come from the server. */
  const runStructural = async (
    key: string,
    fn: () => Promise<unknown>,
    done?: string
  ) => {
    setBusy(key)
    try {
      await chain.current
      await fn()
      if (done) toast.success(done)
      await load()
    } catch (e) {
      if (e instanceof Error) toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  const patch = (id: string, fn: (d: Department) => Department) =>
    setDepartments(
      (prev) => prev?.map((d) => (d.id === id ? fn(d) : d)) ?? prev
    )

  const createDepartment = () =>
    runStructural(
      "new",
      async () => {
        const r = await apiClient.post<{ department: { id: string } }>(
          "/api/departments",
          { name: newName.trim() }
        )
        setNewName("")
        setSelectedId(r.department.id)
      },
      "Department added"
    )

  const toggleGrade = (d: Department, g: number) => {
    const grades = (
      d.grades.includes(g) ? d.grades.filter((x) => x !== g) : [...d.grades, g]
    ).sort((a, b) => a - b)
    patch(d.id, (x) => ({ ...x, grades }))
    send(() => apiClient.put(`/api/departments/${d.id}/grades`, { grades }))
  }

  const toggleHead = (d: Department, t: Teacher) => {
    const heads = d.heads.some((h) => h.id === t.id)
      ? d.heads.filter((h) => h.id !== t.id)
      : [...d.heads, { id: t.id, full_name: t.full_name }]
    patch(d.id, (x) => ({ ...x, heads }))
    send(() =>
      apiClient.put(`/api/departments/${d.id}/heads`, {
        user_ids: heads.map((h) => h.id),
      })
    )
  }

  const toggleSubject = (d: Department, s: SubjectLite) => {
    const next = d.subjects.some((x) => x.id === s.id)
      ? d.subjects.filter((x) => x.id !== s.id)
      : [...d.subjects, s].sort((a, b) =>
          a.subject_name.localeCompare(b.subject_name)
        )
    patch(d.id, (x) => ({ ...x, subjects: next }))
    send(() =>
      apiClient.put(`/api/departments/${d.id}/subjects`, {
        subject_ids: next.map((x) => x.id),
      })
    )
  }

  const toggleSubjectGrade = (s: SubjectLite, g: number) => {
    const cur = gradeSubjects[s.id] ?? []
    const grades = (
      cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]
    ).sort((a, b) => a - b)
    setGradeSubjects((prev) => ({ ...prev, [s.id]: grades }))
    send(() =>
      apiClient.put(`/api/departments/grade-subjects/${s.id}`, { grades })
    )
  }

  const createSubject = (d: Department, name: string) =>
    runStructural(
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
    runStructural(
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
    <div className="flex min-h-0 flex-1 flex-col">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : departments === null ? (
        <Skeleton className="min-h-0 flex-1 rounded-xl" />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background md:flex-row">
          {/* Level 3 — the list, divided from the detail by a real edge */}
          <aside className="flex shrink-0 flex-col border-b border-border md:w-60 md:border-r md:border-b-0">
            {/* Adding comes first: the list below it can be long */}
            <form
              className="flex shrink-0 gap-1 border-b border-border p-2"
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
            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
              {departments.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  aria-current={selectedId === d.id ? "true" : undefined}
                  className={cn(
                    "flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
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
            </div>
          </aside>

          {/* Detail */}
          {selected ? (
            <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
              <div className="flex shrink-0 items-start justify-between gap-3 px-5 py-4">
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
              <div className="flex flex-col gap-2 border-t border-dashed border-border px-5 py-4">
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
              <div className="flex flex-col gap-2 border-t border-dashed border-border px-5 py-4">
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
                    <li key={s.id} className="flex flex-col gap-2 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-foreground">
                          {s.subject_name}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSubject(selected, s)}
                          className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="mr-1 text-[11px] text-muted-foreground">
                          Runs in
                        </span>
                        {GRADES.map((g) => {
                          const on = (gradeSubjects[s.id] ?? []).includes(g)
                          return (
                            <button
                              key={g}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleSubjectGrade(s, g)}
                              className={cn(
                                "min-w-7 rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums transition-colors",
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
            </div>
          ) : (
            <p className="flex-1 p-8 text-center text-sm text-muted-foreground">
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
