import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CircleNotchIcon,
  PlusIcon,
  StackIcon,
  PencilSimpleIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { showError } from "@/lib/show-error"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { useHeaderActions } from "@/components/layout/header-actions-context"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Sticker } from "@/components/shared/sticker"
import { BulkAddDialog } from "@/modules/subjects/components/bulk-add-dialog"
import { describeGrades, GRADES, gradeLabel } from "@/lib/grades"

/**
 * Subjects (module 02b). A subject is a name and the grades it runs in —
 * nothing more. Which department owns it is an association, written here and
 * equally from the departments page: the same junction from the other end.
 */

type DeptLite = { id: string; name: string }
type Subject = {
  id: string
  subject_name: string
  grades: number[]
  departments: DeptLite[]
  section_count: number
}

export function SubjectsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const { setHeaderActions } = useHeaderActions()
  const [subjects, setSubjects] = useState<Subject[] | null>(null)
  const [departments, setDepartments] = useState<DeptLite[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameTo, setRenameTo] = useState("")

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([
        apiClient.get<{ subjects: Subject[] }>("/api/subjects/detail"),
        apiClient.get<{ departments: DeptLite[] }>("/api/departments"),
      ])
      setSubjects(s.subjects ?? [])
      setDepartments(d.departments ?? [])
      setSelectedId((cur) => cur ?? s.subjects?.[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load subjects")
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  // The module's primary action belongs in the shell header, far right, beside
  // every other module's (founder, 2026-09-13).
  useEffect(() => {
    if (!isAdmin) return
    setHeaderActions(
      <div className="flex items-center gap-2">
        <BulkAddDialog onDone={load} />
        <Popover open={adding} onOpenChange={setAdding}>
          <PopoverTrigger asChild>
            <Button size="lg">
              <PlusIcon className="size-3.5" />
              <span className="hidden sm:inline">New subject</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (newName.trim()) create()
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-subject" className="text-xs">
                  Subject name
                </Label>
                <Input
                  id="new-subject"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Business Studies"
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  It finds its own department — you can change that after.
                </p>
              </div>
              <Button
                type="submit"
                disabled={!newName.trim() || busy === "new"}
              >
                {busy === "new" ? (
                  <CircleNotchIcon className="size-4 animate-spin" />
                ) : (
                  <PlusIcon className="size-4" />
                )}
                Add subject
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      </div>
    )
    return () => setHeaderActions(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, adding, newName, busy, load, setHeaderActions])

  const selected = useMemo(
    () => subjects?.find((s) => s.id === selectedId) ?? null,
    [subjects, selectedId]
  )

  // Writes apply locally first and go out one at a time, so two quick clicks
  // never both compute a set from the same stale copy.
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
  const patch = (id: string, fn: (s: Subject) => Subject) =>
    setSubjects((prev) => prev?.map((s) => (s.id === id ? fn(s) : s)) ?? prev)

  const structural = async (
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
      showError(e)
    } finally {
      setBusy(null)
    }
  }

  const create = () =>
    structural(
      "new",
      async () => {
        const r = await apiClient.post<{ subject: { id: string } }>(
          "/api/subjects",
          {
            subject_name: newName.trim(),
          }
        )
        setNewName("")
        setAdding(false)
        setSelectedId(r.subject.id)
      },
      "Subject added"
    )

  const rename = (s: Subject) => {
    const name = renameTo.trim()
    setRenaming(false)
    if (!name || name === s.subject_name) return
    patch(s.id, (x) => ({ ...x, subject_name: name }))
    send(() => apiClient.patch(`/api/subjects/${s.id}`, { subject_name: name }))
  }

  const remove = (s: Subject) =>
    structural(
      "del",
      async () => {
        await apiClient.delete(`/api/subjects/${s.id}`)
        setSelectedId(null)
      },
      `${s.subject_name} deleted`
    )

  const toggleDepartment = (s: Subject, d: DeptLite) => {
    const next = s.departments.some((x) => x.id === d.id)
      ? s.departments.filter((x) => x.id !== d.id)
      : [...s.departments, d].sort((a, b) => a.name.localeCompare(b.name))
    patch(s.id, (x) => ({ ...x, departments: next }))
    send(() =>
      apiClient.put(`/api/subjects/${s.id}/departments`, {
        department_ids: next.map((x) => x.id),
      })
    )
  }

  const toggleGrade = (s: Subject, g: number) => {
    const grades = (
      s.grades.includes(g) ? s.grades.filter((x) => x !== g) : [...s.grades, g]
    ).sort((a, b) => a - b)
    patch(s.id, (x) => ({ ...x, grades }))
    send(() => apiClient.put(`/api/subjects/${s.id}/grades`, { grades }))
  }

  if (!isAdmin) {
    return (
      <div
        className={cn(
          PAGE_GUTTER,
          PAGE_TOP,
          "flex min-h-full flex-col items-center justify-center gap-4 pb-12"
        )}
      >
        <Sticker name="peek" size={96} />
        <p className="text-base font-medium text-secondary-foreground">
          Subjects are set up by admins
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex h-full min-h-0 flex-col gap-5 overflow-hidden pb-6"
      )}
    >
      <PageHeader
        icon={StackIcon}
        title="Subjects"
        description="What the school teaches, and the grades each subject runs in."
      />

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : subjects === null ? (
        <Skeleton className="min-h-0 flex-1 rounded-xl" />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background md:flex-row">
          {/* Level 3 — the list */}
          <aside className="flex shrink-0 flex-col border-b border-border md:w-60 md:border-r md:border-b-0">
            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  aria-current={selectedId === s.id ? "true" : undefined}
                  className={cn(
                    "flex shrink-0 flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors",
                    selectedId === s.id
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <span className="w-full truncate text-sm">
                    {s.subject_name}
                  </span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {describeGrades(s.grades, "Not placed yet")}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          {/* Detail */}
          {selected ? (
            <div className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-4">
              <div className="flex shrink-0 items-start justify-between gap-3 px-5 py-4">
                <div>
                  {renaming ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        rename(selected)
                      }}
                    >
                      <Input
                        autoFocus
                        value={renameTo}
                        onChange={(e) => setRenameTo(e.target.value)}
                        onBlur={() => rename(selected)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setRenaming(false)
                        }}
                        className="h-8 w-56 text-base font-medium"
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isAdmin) return
                        setRenameTo(selected.subject_name)
                        setRenaming(true)
                      }}
                      className="group/name -mx-1 flex items-center gap-1.5 rounded px-1 text-left text-base font-medium text-foreground"
                    >
                      {selected.subject_name}
                      {isAdmin && (
                        <PencilSimpleIcon
                          aria-hidden
                          className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100"
                        />
                      )}
                    </button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {selected.section_count === 0
                      ? "No section teaches it yet"
                      : `${selected.section_count} ${selected.section_count === 1 ? "section teaches" : "sections teach"} it`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(selected)}
                  disabled={busy === "del" || selected.section_count > 0}
                >
                  <TrashIcon className="size-4" />
                  Delete
                </Button>
              </div>

              {/* Grades — the junction, from the subject's side */}
              <div className="flex flex-col gap-2 border-t border-dashed border-border px-5 py-4">
                <Label className="text-xs">Grades this subject runs in</Label>
                <p className="text-sm text-foreground">
                  {describeGrades(
                    selected.grades,
                    "Not placed in any grade yet"
                  )}
                </p>
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
              {/* Where it landed. Chosen on its own when the subject was
                  created; changed here when the guess was wrong. */}
              <div className="flex flex-col gap-2 border-t border-dashed border-border px-5 py-4">
                <Label className="text-xs">Department</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {selected.departments.map((d) => (
                    <span
                      key={d.id}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground"
                    >
                      {d.name}
                      <button
                        type="button"
                        aria-label={`Take ${selected.subject_name} out of ${d.name}`}
                        onClick={() => toggleDepartment(selected, d)}
                        className="grid size-3.5 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-destructive"
                      >
                        <XIcon className="size-2.5" />
                      </button>
                    </span>
                  ))}
                  <DepartmentPicker
                    options={departments.filter(
                      (d) => !selected.departments.some((x) => x.id === d.id)
                    )}
                    onPick={(d) => toggleDepartment(selected, d)}
                  />
                </div>
                {selected.departments.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Not in a department. It was not recognised, so pick one.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="flex-1 p-8 text-center text-sm text-muted-foreground">
              Pick a subject, or add the first one.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Only the departments it is not in, searchable. */
function DepartmentPicker({
  options,
  onPick,
}: {
  options: DeptLite[]
  onPick: (d: DeptLite) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const shown = q
    ? options.filter((o) => o.name.toLowerCase().includes(q))
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
          {options.length > 0 ? "Change" : "Add department"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
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
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No department matches.
            </p>
          ) : (
            shown.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  onPick(d)
                  setOpen(false)
                  setQuery("")
                }}
                className="w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                {d.name}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
