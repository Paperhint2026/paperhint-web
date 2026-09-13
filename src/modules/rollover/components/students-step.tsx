import { useCallback, useEffect, useMemo, useState } from "react"
import {
  MagnifyingGlassIcon,
  UploadSimpleIcon,
  UserMinusIcon,
} from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type {
  RolloverException,
  RolloverPlan,
  RolloverPlanClass,
  RosterRow,
} from "@/modules/rollover/lib/types"

/**
 * Step 3: the per-student exceptions. Everyone not listed here follows the
 * default from the class plan — promoted with the class, same section; a
 * detained student stays in the same grade and section (truth.md). Listing a
 * student here is the override: a different section, promotion despite
 * detention, or withdrawal.
 */
export function StudentsStep({
  planClasses,
  onExceptionsChanged,
}: {
  planClasses: RolloverPlanClass[]
  onExceptionsChanged: (exceptions: RolloverException[]) => void
}) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    planClasses[0]?.source_class_id ?? null
  )
  const [roster, setRoster] = useState<RosterRow[] | null>(null)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [exceptions, setExceptions] = useState<RolloverException[]>([])
  const [bulkOpen, setBulkOpen] = useState(false)

  const loadRoster = useCallback((classId: string) => {
    // the reset runs in a microtask, not synchronously in the effect body
    Promise.resolve().then(() => setRoster(null))
    apiClient
      .get<{ roster: RosterRow[] }>(
        `/api/rollover/plan/roster?source_class_id=${classId}`
      )
      .then((r) => {
        setRoster(r.roster)
        setExceptions((prev) => {
          const others = prev.filter((e) => e.source_class_id !== classId)
          const mine = r.roster
            .map((row) => row.exception)
            .filter((e): e is RolloverException => !!e)
          return [...others, ...mine]
        })
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load the roster")
      )
  }, [])

  useEffect(() => {
    if (selectedClassId) loadRoster(selectedClassId)
  }, [selectedClassId, loadRoster])

  const shown = useMemo(() => {
    if (!roster) return []
    const q = query.trim().toLowerCase()
    return q
      ? roster.filter((r) => r.full_name.toLowerCase().includes(q))
      : roster
  }, [roster, query])

  const setException = (row: RosterRow, ex: RolloverException | null) => {
    if (!selectedClassId) return
    // StudentActionCell does not know which class it is in — stamp it here.
    const stamped = ex ? { ...ex, source_class_id: selectedClassId } : null
    setExceptions((prev) => {
      const rest = prev.filter((e) => e.student_id !== row.student_id)
      return stamped ? [...rest, stamped] : rest
    })
    setRoster((prev) =>
      prev
        ? prev.map((r) =>
            r.student_id === row.student_id ? { ...r, exception: ex } : r
          )
        : prev
    )
  }

  const save = useCallback(
    async (list: RolloverException[]) => {
      try {
        const r = await apiClient.put<{ plan: RolloverPlan }>(
          "/api/rollover/plan/students",
          { students: list }
        )
        onExceptionsChanged(r.plan.plan.students)
      } catch (e) {
        showError(e)
      }
    },
    [onExceptionsChanged]
  )

  // save shortly after each local change — the exceptions list is small, so a
  // plain debounce is enough
  useEffect(() => {
    const t = setTimeout(() => save(exceptions), 500)
    return () => clearTimeout(t)
  }, [exceptions, save])

  const current = planClasses.find((c) => c.source_class_id === selectedClassId)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
      {/* Level 3 — which class's roster is open */}
      <aside className="flex shrink-0 flex-col gap-0.5 md:w-56">
        {planClasses.map((c) => (
          <button
            key={c.source_class_id}
            type="button"
            onClick={() => setSelectedClassId(c.source_class_id)}
            aria-pressed={selectedClassId === c.source_class_id}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
              selectedClassId === c.source_class_id
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            {c.action === "graduate"
              ? "Graduating class"
              : `→ Grade ${c.target?.grade}${c.target?.section}`}
          </button>
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a student"
              className="h-9 pl-8"
            />
          </div>
          {current && current.action === "promote" && (
            <BulkReshuffleDialog
              open={bulkOpen}
              onOpenChange={setBulkOpen}
              roster={roster ?? []}
              onApply={(moves) => {
                for (const m of moves) {
                  const row = roster?.find((r) => r.student_id === m.student_id)
                  if (row) {
                    setException(row, {
                      student_id: m.student_id,
                      source_class_id: selectedClassId!,
                      kind: "move_section",
                      target_section: m.target_section,
                    })
                  }
                }
              }}
            />
          )}
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !roster ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((row) => (
                  <tr key={row.student_id}>
                    <td className="px-3 py-2.5">
                      <span className="text-foreground">{row.full_name}</span>
                      {row.detained && (
                        <span className="ml-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                          detained
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StudentActionCell
                        row={row}
                        classAction={current?.action ?? "promote"}
                        onChange={(ex) => setException(row, ex)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StudentActionCell({
  row,
  classAction,
  onChange,
}: {
  row: RosterRow
  classAction: "promote" | "graduate"
  onChange: (ex: RolloverException | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState(row.exception?.target_section ?? "")

  if (row.exception?.kind === "withdraw") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-destructive">Withdrawn</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Undo
        </button>
      </div>
    )
  }
  if (row.exception?.kind === "move_section") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-foreground">
          Section {row.exception.target_section}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Undo
        </button>
      </div>
    )
  }
  if (row.exception?.kind === "detain_promote") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-foreground">Promoted anyway</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Undo
        </button>
      </div>
    )
  }
  if (row.exception?.kind === "detain_move") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-foreground">
          Stays, section {row.exception.target_section}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Undo
        </button>
      </div>
    )
  }

  const defaultLabel =
    classAction === "graduate"
      ? row.detained
        ? "Held back — needs a section"
        : "Graduates"
      : row.detained
        ? "Stays in the same section"
        : "Promoted with the class"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-xs underline decoration-dotted underline-offset-2",
            row.detained
              ? "text-amber-700 dark:text-amber-400"
              : "text-muted-foreground"
          )}
        >
          {defaultLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="flex flex-col gap-1">
          {classAction === "promote" && !row.detained && (
            <div className="flex items-center gap-1.5 px-1 py-1">
              <Input
                value={section}
                onChange={(e) => setSection(e.target.value.toUpperCase())}
                placeholder="Section"
                className="h-8 w-20 text-sm"
              />
              <Button
                size="sm"
                onClick={() => {
                  onChange({
                    student_id: row.student_id,
                    source_class_id: "",
                    kind: "move_section",
                    target_section: section,
                  })
                  setOpen(false)
                }}
                disabled={!section.trim()}
              >
                Move
              </Button>
            </div>
          )}
          {row.detained && (
            <>
              <div className="flex items-center gap-1.5 px-1 py-1">
                <Input
                  value={section}
                  onChange={(e) => setSection(e.target.value.toUpperCase())}
                  placeholder="Section"
                  className="h-8 w-20 text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    onChange({
                      student_id: row.student_id,
                      source_class_id: "",
                      kind: "detain_move",
                      target_section: section,
                    })
                    setOpen(false)
                  }}
                  disabled={!section.trim()}
                >
                  Different section
                </Button>
              </div>
              <button
                type="button"
                onClick={() => {
                  onChange({
                    student_id: row.student_id,
                    source_class_id: "",
                    kind: "detain_promote",
                  })
                  setOpen(false)
                }}
                className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                Promote despite detention
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              onChange({
                student_id: row.student_id,
                source_class_id: "",
                kind: "withdraw",
              })
              setOpen(false)
            }}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
          >
            <UserMinusIcon className="size-3.5" />
            Withdraw
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Reshuffle by list (founder, 2026-09-13): class teachers work this out
 * offline and hand the admin "student → section"; this pastes that list
 * straight in rather than clicking through each row.
 */
function BulkReshuffleDialog({
  open,
  onOpenChange,
  roster,
  onApply,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  roster: RosterRow[]
  onApply: (moves: { student_id: string; target_section: string }[]) => void
}) {
  const [text, setText] = useState("")

  const parsed = useMemo(() => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
    return lines.map((line) => {
      const m = line.match(/^(.*?)[\s,:\t-]+([A-Za-z]{1,2})$/)
      const name = (m ? m[1] : line).trim().toLowerCase()
      const section = m ? m[2].toUpperCase() : ""
      const match = roster.find(
        (r) => r.full_name.trim().toLowerCase() === name
      )
      return { line, name, section, match }
    })
  }, [text, roster])

  const matched = parsed.filter((p) => p.match && p.section)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button variant="outline" size="sm" onClick={() => onOpenChange(true)}>
        <UploadSimpleIcon className="size-3.5" />
        Reshuffle by list
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reshuffle by list</DialogTitle>
          <DialogDescription>
            One student per line: name, then the section. &ldquo;Akil BP -
            A&rdquo; or &ldquo;Akil BP, A&rdquo; both work.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Akil BP - A&#10;Deepthi Menon - B"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {matched.length} of {parsed.length} lines matched a student in this
          class.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={matched.length === 0}
            onClick={() => {
              onApply(
                matched.map((m) => ({
                  student_id: m.match!.student_id,
                  target_section: m.section,
                }))
              )
              setText("")
              onOpenChange(false)
            }}
          >
            Apply {matched.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
