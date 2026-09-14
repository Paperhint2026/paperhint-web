import { useCallback, useEffect, useMemo, useState } from "react"
import {
  MagnifyingGlassIcon,
  UploadSimpleIcon,
  UserMinusIcon,
} from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
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
