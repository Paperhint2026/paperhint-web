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
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { RolloverException, RosterRow } from "@/modules/rollover/lib/types"

/**
 * One class's roster, opened inline under its row in the plan table (founder,
 * 2026-09-14): "show the list of classes, and within each of these have a
 * picker to move students to another section or mark them detained" — not a
 * separate tab a step away from the class it belongs to.
 *
 * Everyone not listed here follows the class default: promoted with the
 * class, same section; a detained student stays in the same grade and
 * section (truth.md). Listing a student is the override.
 */
export function ClassRosterPanel({
  sourceClassId,
  classAction,
  onExceptions,
}: {
  sourceClassId: string
  classAction: "promote" | "graduate"
  /** The full, current exception list for THIS class — replaces, not appends. */
  onExceptions: (sourceClassId: string, exceptions: RolloverException[]) => void
}) {
  const [roster, setRoster] = useState<RosterRow[] | null>(null)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [bulkOpen, setBulkOpen] = useState(false)

  const loadRoster = useCallback(() => {
    // the reset runs in a microtask, not synchronously in the effect body
    Promise.resolve().then(() => setRoster(null))
    apiClient
      .get<{ roster: RosterRow[] }>(
        `/api/rollover/plan/roster?source_class_id=${sourceClassId}`
      )
      .then((r) => setRoster(r.roster))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load the roster")
      )
  }, [sourceClassId])

  useEffect(() => {
    loadRoster()
  }, [loadRoster])

  const shown = useMemo(() => {
    if (!roster) return []
    const q = query.trim().toLowerCase()
    return q
      ? roster.filter((r) => r.full_name.toLowerCase().includes(q))
      : roster
  }, [roster, query])

  const setException = (row: RosterRow, ex: RolloverException | null) => {
    const stamped = ex ? { ...ex, source_class_id: sourceClassId } : null
    const next = (roster ?? []).map((r) =>
      r.student_id === row.student_id ? { ...r, exception: ex } : r
    )
    setRoster(next)
    onExceptions(
      sourceClassId,
      next.map((r) => r.exception).filter((e): e is RolloverException => !!e)
    )
    void stamped
  }

  /**
   * Detain/Promote is a real switch, not a plan-time guess: it writes the
   * student's annual_result (the same field a teacher sets from Results),
   * because that is what "detained" means everywhere else in the app. Any
   * section override on the row is cleared — a fresh detain defaults to
   * staying put (truth.md), a fresh promote drops a stale detain-only choice.
   */
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const toggleDetain = async (row: RosterRow) => {
    const nextDetained = !row.detained
    setTogglingId(row.student_id)
    try {
      await apiClient.patch("/api/batches/annual-result", {
        updates: [
          {
            student_id: row.student_id,
            annual_result: nextDetained ? "detained" : "pass",
          },
        ],
      })
      const next = (roster ?? []).map((r) =>
        r.student_id === row.student_id
          ? { ...r, detained: nextDetained, exception: null }
          : r
      )
      setRoster(next)
      onExceptions(
        sourceClassId,
        next.map((r) => r.exception).filter((e): e is RolloverException => !!e)
      )
    } catch (e) {
      showError(e)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
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
        {classAction === "promote" && (
          <BulkReshuffleDialog
            open={bulkOpen}
            onOpenChange={setBulkOpen}
            roster={roster ?? []}
            onApply={(moves) => {
              const next = (roster ?? []).map((r) => {
                const m = moves.find((x) => x.student_id === r.student_id)
                return m
                  ? {
                      ...r,
                      exception: {
                        student_id: r.student_id,
                        source_class_id: sourceClassId,
                        kind: "move_section" as const,
                        target_section: m.target_section,
                      },
                    }
                  : r
              })
              setRoster(next)
              onExceptions(
                sourceClassId,
                next
                  .map((r) => r.exception)
                  .filter((e): e is RolloverException => !!e)
              )
            }}
          />
        )}
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !roster ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Student</th>
                <th className="w-44 px-3 py-2 font-medium">Grade</th>
                <th className="px-3 py-2 font-medium">
                  Section &amp; other changes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((row) => (
                <tr key={row.student_id}>
                  <td className="px-3 py-2.5">
                    <span className="text-foreground">{row.full_name}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-pressed={!row.detained}
                        disabled={togglingId === row.student_id}
                        onClick={() => row.detained && toggleDetain(row)}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-60",
                          !row.detained
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        Promote
                      </button>
                      <button
                        type="button"
                        aria-pressed={row.detained}
                        disabled={togglingId === row.student_id}
                        onClick={() => !row.detained && toggleDetain(row)}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-60",
                          row.detained
                            ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            : "border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        Detain
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StudentActionCell
                      // Remount when the exception changes underneath this
                      // row (e.g. cleared elsewhere) instead of an effect
                      // resyncing local state — the React-recommended fix.
                      key={`${row.exception?.kind ?? "none"}:${row.exception?.target_section ?? ""}`}
                      row={row}
                      classAction={classAction}
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

  const commitSection = (value: string) => {
    const v = value.trim().toUpperCase()
    if (!v) {
      onChange(null)
      return
    }
    onChange({
      student_id: row.student_id,
      source_class_id: "",
      kind: row.detained ? "detain_move" : "move_section",
      target_section: v,
    })
  }

  if (classAction === "graduate" && !row.detained) {
    // Nothing to move — a graduating student who is not detained just leaves.
    return (
      <span className="text-xs text-muted-foreground">Leaves the school</span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Section</span>
      <Input
        value={section}
        onChange={(e) => setSection(e.target.value.toUpperCase())}
        onBlur={(e) => commitSection(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitSection(section)
        }}
        placeholder={row.detained ? "same" : "same as class"}
        className="h-8 w-20 text-sm"
      />
      {row.detained && !section && (
        <span className="text-[11px] text-muted-foreground">
          stays in this section
        </span>
      )}
      <button
        type="button"
        onClick={() =>
          onChange({
            student_id: row.student_id,
            source_class_id: "",
            kind: "withdraw",
          })
        }
        className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
      >
        <UserMinusIcon className="size-3.5" />
        Withdraw
      </button>
    </div>
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
