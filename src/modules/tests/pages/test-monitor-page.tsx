import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  CameraIcon,
  CheckIcon,
  CircleNotchIcon,
  MonitorPlayIcon,
  SparkleIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Sticker } from "@/components/shared/sticker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface MonitorRow {
  student_id: string
  full_name: string
  attempt_id: string | null
  status: "not_started" | "in_progress" | "submitted"
  started_at: string | null
  submitted_at: string | null
  deadline_at: string | null
  auto_submitted: boolean
  score: number | null
  pending_review_count: number
  violation_count: number
  capture_count: number
}

interface WrittenAnswer {
  question_id: string
  question_text: string
  max_marks: number
  answer_text: string | null
  marks_awarded: number | null
  ai_feedback: string | null
  needs_review: boolean
  confidence: string | null
}

interface Report {
  attempt: {
    id: string
    student_name: string
    status: string
    started_at: string
    submitted_at: string | null
    auto_submitted: boolean
    score: number | null
    pending_review_count: number
    violation_count: number
    device_info: string | null
  }
  grading_mode: "ai" | "manual"
  events: { kind: string; at: string; meta: Record<string, unknown> | null }[]
  captures: { at: string; url: string }[]
  written: WrittenAnswer[]
}

const EVENT_LABEL: Record<string, string> = {
  tab_hidden: "Left the test tab",
  window_blur: "Switched to another window",
  fullscreen_exit: "Exited fullscreen",
  camera_denied: "Camera not allowed",
  camera_off: "Camera turned off",
  ai_graded: "AI graded the written answers",
  ai_skipped_quota: "AI grading skipped — plan limit reached, grade manually",
}

const POLL_MS = 10_000

/**
 * The teacher's live view while a test runs: the batch roster with each
 * student's state, violations and captures — polled, no refresh button
 * mashing needed. A row opens the flag report (timeline + filmstrip).
 */
export function TestMonitorPage() {
  const { classSubjectId, testId } = useParams<{
    classSubjectId: string
    testId: string
  }>()
  const [name, setName] = useState("")
  const [totalMarks, setTotalMarks] = useState<number | null>(null)
  const [rows, setRows] = useState<MonitorRow[] | null>(null)
  const [error, setError] = useState("")
  const [report, setReport] = useState<Report | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [resetting, setResetting] = useState(false)

  const fetchMonitor = useCallback(async () => {
    try {
      const res = await apiClient.get<{
        test: { name: string; total_marks: number | null }
        rows: MonitorRow[]
      }>(`/api/online-tests/${testId}/monitor`)
      setName(res.test.name)
      setTotalMarks(res.test.total_marks)
      setRows(res.rows)
      setError("")
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setError(err.message)
    }
  }, [testId])

  useEffect(() => {
    fetchMonitor()
    const id = setInterval(fetchMonitor, POLL_MS)
    return () => clearInterval(id)
  }, [fetchMonitor])

  const openReport = async (row: MonitorRow) => {
    if (!row.attempt_id) return
    setReportLoading(true)
    try {
      const res = await apiClient.get<Report>(
        `/api/online-tests/${testId}/attempts/${row.attempt_id}/report`
      )
      setReport(res)
    } catch (err) {
      showError(err)
    } finally {
      setReportLoading(false)
    }
  }

  const resetAttempt = async () => {
    if (!report) return
    setResetting(true)
    try {
      await apiClient.post(
        `/api/online-tests/${testId}/attempts/${report.attempt.id}/reset`
      )
      toast.success(`${report.attempt.student_name} can start again`)
      setReport(null)
      fetchMonitor()
    } catch (err) {
      showError(err)
    } finally {
      setResetting(false)
    }
  }

  const counts = {
    not_started: (rows ?? []).filter((r) => r.status === "not_started").length,
    in_progress: (rows ?? []).filter((r) => r.status === "in_progress").length,
    submitted: (rows ?? []).filter((r) => r.status === "submitted").length,
  }

  return (
    <div className={cn(PAGE_GUTTER, PAGE_TOP, "flex min-h-full flex-col gap-5 pb-12")}>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          to={`/class/${classSubjectId}/tests/${testId}`}
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          {name || "Test"}
        </Link>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <MonitorPlayIcon className="size-6 text-muted-foreground" />
            Live monitor
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ArrowsClockwiseIcon className="size-3.5" />
            Updates every {POLL_MS / 1000}s · {counts.in_progress} writing ·{" "}
            {counts.submitted} submitted · {counts.not_started} yet to start
          </p>
        </div>
      </div>

      <LoadingSwap
        loading={rows === null && !error}
        className="flex-1"
        skeleton={
          <div aria-hidden className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        }
      >
        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <Sticker name="worried" size={88} />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={fetchMonitor}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
            {(rows ?? []).map((r) => (
              <button
                key={r.student_id}
                type="button"
                disabled={!r.attempt_id}
                onClick={() => openReport(r)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-left",
                  r.attempt_id ? "transition-colors hover:bg-muted/40" : "cursor-default"
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{r.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.status === "not_started"
                      ? "Not started"
                      : r.status === "in_progress"
                        ? `Writing — started ${r.started_at ? new Date(r.started_at).toLocaleTimeString() : ""}`
                        : `${r.auto_submitted ? "Auto-submitted" : "Submitted"} ${r.submitted_at ? new Date(r.submitted_at).toLocaleTimeString() : ""}`}
                  </span>
                </div>
                {r.violation_count > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    <WarningIcon className="size-3" />
                    {r.violation_count}
                  </span>
                )}
                {r.capture_count > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    <CameraIcon className="size-3" />
                    {r.capture_count}
                  </span>
                )}
                <span
                  className={cn(
                    "w-16 shrink-0 text-right text-sm font-semibold tabular-nums",
                    r.status !== "submitted" && "text-muted-foreground/40"
                  )}
                >
                  {r.status === "submitted" && r.score != null
                    ? `${r.score}/${totalMarks ?? "—"}`
                    : "—"}
                </span>
              </button>
            ))}
          </div>
        )}
      </LoadingSwap>

      {/* Flag report */}
      <Dialog open={!!report || reportLoading} onOpenChange={(o) => !o && setReport(null)}>
        {/* overflow-x-hidden + min-w-0 so a long UA string (or any other
            overflowing child) wraps inside the dialog instead of pushing it
            wider than the viewport. */}
        <DialogContent className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-lg">
          {report ? (
            <>
              <DialogHeader>
                <DialogTitle>{report.attempt.student_name}</DialogTitle>
                <DialogDescription>
                  {report.attempt.status === "submitted"
                    ? `${report.attempt.auto_submitted ? "Auto-submitted" : "Submitted"} · score ${report.attempt.score ?? "—"}`
                    : "Still writing"}
                  {report.attempt.violation_count > 0 &&
                    ` · ${report.attempt.violation_count} violation${report.attempt.violation_count === 1 ? "" : "s"}`}
                </DialogDescription>
              </DialogHeader>

              <div className="flex min-w-0 flex-col gap-4 text-sm">
                {report.written.length > 0 && (
                  <WrittenReview
                    testId={testId!}
                    report={report}
                    onScored={(score, pending) => {
                      setReport((cur) =>
                        cur
                          ? {
                              ...cur,
                              attempt: { ...cur.attempt, score, pending_review_count: pending },
                            }
                          : cur
                      )
                      fetchMonitor()
                    }}
                  />
                )}

                {report.captures.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Camera ({report.captures.length})
                    </p>
                    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                      {report.captures.map((c) => (
                        <a key={c.url} href={c.url} target="_blank" rel="noreferrer" className="shrink-0">
                          <img
                            src={c.url}
                            alt={`Capture at ${new Date(c.at).toLocaleTimeString()}`}
                            className="h-24 rounded-lg border border-border object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Timeline
                  </p>
                  {report.events.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nothing flagged — no tab switches, no camera drops.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {report.events.map((e, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-secondary-foreground">
                            {EVENT_LABEL[e.kind] ?? e.kind}
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {new Date(e.at).toLocaleTimeString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {report.attempt.device_info && (
                  // The user-agent string is long and nothing-to-read; keep
                  // it tucked away in a <details> so the dialog stays tidy
                  // and teachers who need the fingerprint can open it.
                  <details className="group min-w-0 text-[11px] text-muted-foreground">
                    <summary className="cursor-pointer list-none select-none hover:text-foreground">
                      Device info
                      <span className="ml-1 text-muted-foreground/70 group-open:hidden">
                        · show
                      </span>
                      <span className="ml-1 text-muted-foreground/70 group-open:inline hidden">
                        · hide
                      </span>
                    </summary>
                    <p className="mt-1 break-all">{report.attempt.device_info}</p>
                  </details>
                )}
              </div>

              <DialogFooter className="justify-between gap-2 sm:justify-between">
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={resetAttempt}
                  disabled={resetting}
                >
                  {resetting ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
                  Reset attempt
                </Button>
                <Button variant="outline" onClick={() => setReport(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="flex justify-center py-10">
              <CircleNotchIcon className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── written answers review ───────────────────────────────────────────────────
// AI mode: the suggestion (marks + feedback) is pre-filled, the teacher
// confirms or overrides. Manual mode: empty marks boxes. Either way saving
// is free and updates the attempt, the student's reopened score, and the
// results pipeline in one call.

function WrittenReview({
  testId,
  report,
  onScored,
}: {
  testId: string
  report: Report
  onScored: (score: number, pending: number) => void
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      report.written.map((w) => [w.question_id, w.marks_awarded != null ? String(w.marks_awarded) : ""])
    )
  )
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const save = async (w: WrittenAnswer) => {
    const m = Number(drafts[w.question_id])
    if (!Number.isFinite(m) || m < 0 || m > w.max_marks || savingId) return
    setSavingId(w.question_id)
    try {
      const res = await apiClient.post<{ score: number; pending_review_count: number }>(
        `/api/online-tests/${testId}/attempts/${report.attempt.id}/grade`,
        { question_id: w.question_id, marks: m }
      )
      onScored(res.score, res.pending_review_count)
      setSavedId(w.question_id)
      setTimeout(() => setSavedId((cur) => (cur === w.question_id ? null : cur)), 1500)
    } catch (err) {
      showError(err, "Couldn't save the marks")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Written answers ({report.written.length})
        {report.grading_mode === "ai" && (
          <span className="ml-2 inline-flex items-center gap-1 normal-case">
            <SparkleIcon className="size-3 text-primary" />
            AI suggested — confirm or change
          </span>
        )}
      </p>
      <div className="flex flex-col gap-2">
        {report.written.map((w) => (
          <div key={w.question_id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-secondary-foreground">{w.question_text}</p>
            <p className="rounded-md bg-muted/50 px-2.5 py-2 text-xs whitespace-pre-wrap">
              {w.answer_text?.trim() || <span className="text-muted-foreground italic">Not answered</span>}
            </p>
            {w.ai_feedback && (
              <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <SparkleIcon className="mt-0.5 size-3 shrink-0 text-primary" />
                {w.ai_feedback}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={w.max_marks}
                step={0.5}
                className="h-8 w-20 text-xs"
                value={drafts[w.question_id] ?? ""}
                placeholder="—"
                onChange={(e) =>
                  setDrafts((cur) => ({ ...cur, [w.question_id]: e.target.value }))
                }
                aria-label={`Marks out of ${w.max_marks}`}
              />
              <span className="text-xs text-muted-foreground">/ {w.max_marks}</span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-8"
                disabled={
                  savingId === w.question_id ||
                  drafts[w.question_id] === "" ||
                  Number(drafts[w.question_id]) < 0 ||
                  Number(drafts[w.question_id]) > w.max_marks
                }
                onClick={() => save(w)}
              >
                {savingId === w.question_id ? (
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                ) : savedId === w.question_id ? (
                  <CheckIcon className="size-3.5 text-primary" />
                ) : null}
                {w.marks_awarded != null ? "Update" : "Save marks"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
