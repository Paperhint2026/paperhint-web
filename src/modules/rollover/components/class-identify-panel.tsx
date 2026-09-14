import { useEffect, useState } from "react"

import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { RosterRow } from "@/modules/rollover/lib/types"

/**
 * Grade promotion's own identify list — who in this class is promoted and
 * who repeats. Nothing about sections here; that's Reshuffling's job once
 * this is settled (founder, 2026-09-14). Shown inline only for a class that
 * actually has someone to look at.
 */
export function ClassIdentifyPanel({
  sourceClassId,
  onDetainedCountChange,
}: {
  sourceClassId: string
  onDetainedCountChange: (count: number) => void
}) {
  const [roster, setRoster] = useState<RosterRow[] | null>(null)
  const [error, setError] = useState("")
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
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
        r.student_id === row.student_id ? { ...r, detained: nextDetained } : r
      )
      setRoster(next)
      onDetainedCountChange(next.filter((r) => r.detained).length)
    } catch (e) {
      showError(e)
    } finally {
      setTogglingId(null)
    }
  }

  if (error)
    return <p className="px-4 py-3 text-sm text-destructive">{error}</p>
  if (!roster)
    return (
      <div className="px-4 py-3">
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    )

  return (
    <div className="divide-y divide-border">
      {roster.map((row) => (
        <div
          key={row.student_id}
          className="flex items-center justify-between gap-3 px-4 py-2"
        >
          <span className="text-sm text-foreground">{row.full_name}</span>
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
        </div>
      ))}
    </div>
  )
}
