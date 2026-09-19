import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CalendarCheckIcon,
  CircleNotchIcon,
  LockIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { showError } from "@/lib/show-error"

import { apiClient } from "@/lib/api-client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { DatePickerField } from "@/components/shared/date-picker-field"

/**
 * Setup › Academic year (module 01). One year is open at a time; closed years
 * are read-only forever. Opening a new year is the first step of rollover:
 * it closes the current one and points the school at the new one.
 */

export type AcademicYear = {
  id: string
  label: string
  start_date: string | null
  end_date: string | null
  status: "open" | "closed"
  opened_at: string
  closed_at: string | null
  class_count: number
}

function nextLabel(current?: string): string {
  const m = /^(\d{4})-(\d{2}|\d{4})$/.exec(current ?? "")
  const start = m ? Number(m[1]) + 1 : new Date().getFullYear()
  return `${start}-${start + 1}`
}

function fmt(d: string | null) {
  if (!d) return null
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function AcademicYearCard() {
  const [years, setYears] = useState<AcademicYear[] | null>(null)
  const [error, setError] = useState("")
  const [starting, setStarting] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [label, setLabel] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const load = useCallback(() => {
    apiClient
      .get<{ years: AcademicYear[] }>("/api/academic-years")
      .then((r) => setYears(r.years ?? []))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load years")
      )
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const open = useMemo(
    () => years?.find((y) => y.status === "open") ?? null,
    [years]
  )
  const closed = useMemo(
    () => (years ?? []).filter((y) => y.status !== "open"),
    [years]
  )

  const beginStart = () => {
    setLabel(nextLabel(open?.label))
    setStartDate("")
    setEndDate("")
    setStarting(true)
  }

  const submit = async () => {
    setSaving(true)
    try {
      await apiClient.post("/api/academic-years", {
        label: label.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
      })
      toast.success(`${label.trim()} is now the open year`)
      setStarting(false)
      setConfirm(false)
      load()
    } catch (e) {
      showError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
      <div className="flex items-center gap-2">
        <CalendarCheckIcon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Academic year</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Everything in the school dates from the open year. Closing a year is
        final: it stays readable, nothing in it can change.
      </p>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : years === null ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : (
        <>
          {/* The open year */}
          {open ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-foreground">
                    {open.label}
                  </span>
                  <Badge className="rounded-full">Open</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {fmt(open.start_date) && fmt(open.end_date)
                    ? `${fmt(open.start_date)} – ${fmt(open.end_date)}`
                    : "Dates not set"}
                  {" · "}
                  {open.class_count}{" "}
                  {open.class_count === 1 ? "class" : "classes"}
                </span>
              </div>
              {!starting && (
                <Button variant="outline" onClick={beginStart}>
                  Start new academic year
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3">
              <span className="text-sm text-muted-foreground">
                No academic year is open yet. Open the first one to start
                setting up.
              </span>
              {!starting && (
                <Button onClick={beginStart}>Open the first year</Button>
              )}
            </div>
          )}

          {/* Start a new year */}
          {starting && (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ay-label" className="text-xs">
                    Year
                  </Label>
                  <Input
                    id="ay-label"
                    className="w-36"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="2026-2027"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ay-start" className="text-xs">
                    Starts
                  </Label>
                  <DatePickerField
                    value={startDate}
                    onChange={setStartDate}
                    className="w-48"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ay-end" className="text-xs">
                    Ends
                  </Label>
                  <DatePickerField
                    value={endDate}
                    onChange={setEndDate}
                    className="w-48"
                  />
                </div>
                <div className="ml-auto flex gap-2">
                  <Button variant="ghost" onClick={() => setStarting(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => (open ? setConfirm(true) : submit())}
                    disabled={
                      !/^\d{4}-(\d{2}|\d{4})$/.test(label.trim()) || saving
                    }
                  >
                    {saving ? (
                      <CircleNotchIcon className="size-4 animate-spin" />
                    ) : open ? (
                      `Close ${open.label} and open ${label.trim() || "…"}`
                    ) : (
                      "Open year"
                    )}
                  </Button>
                </div>
              </div>
              {open && (
                <p className="text-xs text-muted-foreground">
                  Classes, students and allotments carry over through Year
                  rollover under Setup. This only opens the year.
                </p>
              )}
            </div>
          )}

          {/* Past years */}
          {closed.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Past years
              </span>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {closed.map((y) => (
                  <li
                    key={y.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <LockIcon className="size-3.5 text-muted-foreground" />
                      <span className="text-foreground">{y.label}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {y.class_count}{" "}
                      {y.class_count === 1 ? "class" : "classes"} · read-only
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {open?.label} for good?</AlertDialogTitle>
            <AlertDialogDescription>
              {open?.label} becomes read-only and cannot be reopened.{" "}
              {label.trim()} opens as the school&apos;s year. Nothing else
              changes until you run Year rollover.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>
              Keep {open?.label}
            </AlertDialogCancel>
            <AlertDialogAction onClick={submit} disabled={saving}>
              {saving ? (
                <CircleNotchIcon className="size-4 animate-spin" />
              ) : (
                "Close and open"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
