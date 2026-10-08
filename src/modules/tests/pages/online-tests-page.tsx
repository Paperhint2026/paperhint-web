import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  CircleNotchIcon,
  ClockIcon,
  ListChecksIcon,
  PlusIcon,
  TimerIcon,
} from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { ClassPageHeader } from "@/components/layout/class-page-header"
import { ModuleAction } from "@/components/ui/module-action"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { testStatus, type OnlineTest, type TestStatus } from "@/modules/tests/types"

const STATUS_STYLE: Record<TestStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  live: { label: "Live", cls: "bg-primary/10 text-primary" },
  closed: { label: "Closed", cls: "bg-muted text-muted-foreground" },
}

/** Online tests for one class/batch: the list plus a create dialog. */
export function OnlineTestsPage() {
  const { classSubjectId } = useParams<{ classSubjectId: string }>()
  const navigate = useNavigate()

  const [tests, setTests] = useState<OnlineTest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [duration, setDuration] = useState(30)
  const [creating, setCreating] = useState(false)

  const fetchTests = useCallback(async () => {
    if (!classSubjectId) return
    setIsLoading(true)
    setError("")
    try {
      const res = await apiClient.get<{ tests: OnlineTest[] }>(
        `/api/online-tests?class_subject_id=${classSubjectId}`
      )
      setTests(res.tests ?? [])
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [classSubjectId])

  useEffect(() => {
    fetchTests()
  }, [fetchTests])

  const create = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    try {
      const res = await apiClient.post<{ test: OnlineTest }>("/api/online-tests", {
        class_subject_id: classSubjectId,
        exam_name: name.trim(),
        duration_minutes: duration,
      })
      setCreateOpen(false)
      setName("")
      navigate(`/class/${classSubjectId}/tests/${res.test.id}`)
    } catch (err) {
      showError(err, "Couldn't create the test")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={cn(PAGE_GUTTER, PAGE_TOP, "flex min-h-full flex-col gap-5 pb-12")}>
      <ClassPageHeader
        icon={TimerIcon}
        title="Online Tests"
        count={tests.length}
        description="Timed tests students take on their phone from a link — graded the moment they submit."
        actions={
          <ModuleAction aria-label="New online test" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-3.5" />
            <span className="hidden sm:inline">New test</span>
          </ModuleAction>
        }
      />

      <LoadingSwap
        loading={isLoading}
        className="flex-1"
        skeleton={
          <div aria-hidden className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        }
      >
        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <Sticker name="worried" size={88} />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={fetchTests}>
              Try again
            </Button>
          </div>
        ) : tests.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <Sticker name="point" size={120} />
            <div className="flex max-w-[380px] flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-secondary-foreground">
                No online tests yet
              </p>
              <p className="text-sm text-muted-foreground">
                Build an MCQ / true-false / fill-blank test, set the timer, and
                share one link — students answer on any phone, no app needed.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-3.5" />
              New test
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tests.map((t) => {
              const st = STATUS_STYLE[testStatus(t)]
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => navigate(`/class/${classSubjectId}/tests/${t.id}`)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-medium text-foreground">
                      {t.exam_name}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ListChecksIcon className="size-3.5" />
                        {t.question_count ?? 0} question{t.question_count === 1 ? "" : "s"}
                        {t.total_marks ? ` · ${t.total_marks} marks` : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <ClockIcon className="size-3.5" />
                        {t.duration_minutes} min
                      </span>
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
                      st.cls
                    )}
                  >
                    {st.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </LoadingSwap>

      <Dialog open={createOpen} onOpenChange={(o) => !creating && setCreateOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New online test</DialogTitle>
            <DialogDescription>
              Name it and set the timer — questions come next.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Test name</Label>
              <Input
                autoFocus
                value={name}
                maxLength={160}
                placeholder="e.g. Weekly Physics MCQ — Unit 3"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Duration (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={600}
                className="w-28"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!name.trim() || !(duration >= 1) || creating}>
              {creating ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
