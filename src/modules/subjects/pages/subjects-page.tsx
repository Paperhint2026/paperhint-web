import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CircleNotchIcon,
  PlusIcon,
  StackIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Sticker } from "@/components/shared/sticker"
import { describeGrades, GRADES, gradeLabel } from "@/lib/grades"

/**
 * Subjects (module 02b). A subject is a name and the grades it runs in —
 * nothing more. Which department owns it is an association, written here and
 * equally from the departments page: the same junction from the other end.
 */

type Subject = {
  id: string
  subject_name: string
  grades: number[]
  section_count: number
}

export function SubjectsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const [subjects, setSubjects] = useState<Subject[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const s = await apiClient.get<{ subjects: Subject[] }>(
        "/api/subjects/detail"
      )
      setSubjects(s.subjects ?? [])
      setSelectedId((cur) => cur ?? s.subjects?.[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load subjects")
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

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
        toast.error(e instanceof Error ? e.message : "That did not save")
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
      if (e instanceof Error) toast.error(e.message)
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
        setSelectedId(r.subject.id)
      },
      "Subject added"
    )

  const remove = (s: Subject) =>
    structural(
      "del",
      async () => {
        await apiClient.delete(`/api/subjects/${s.id}`)
        setSelectedId(null)
      },
      `${s.subject_name} deleted`
    )

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
            <form
              className="flex shrink-0 gap-1 border-b border-border p-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (newName.trim()) create()
              }}
            >
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New subject"
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
                  <h3 className="text-base font-medium text-foreground">
                    {selected.subject_name}
                  </h3>
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
