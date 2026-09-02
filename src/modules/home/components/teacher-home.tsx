import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import dayjs from "dayjs"
import {
  ArrowRightIcon,
  ChalkboardIcon,
  CheckCircleIcon,
  ChecksIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { classLabel, type Assignment } from "@/hooks/use-teacher-assignments"
import { Skeleton } from "@/components/ui/skeleton"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Sticker } from "@/components/shared/sticker"
import { coverFor } from "@/modules/classes/lib/grade-palette"
import { AskHintPanel } from "@/modules/home/components/ask-hint-panel"
import { ClassDoorCard } from "@/modules/home/components/class-door-card"
import {
  HomeGreeting,
  StatStrip,
} from "@/modules/home/components/home-greeting"
import { HomePanel, PanelEmpty } from "@/modules/home/components/home-panel"

// Shapes reused from the grading exam-cards endpoint — see
// grading.controller.js -> exports.getExamCards.
interface ExamCard {
  id: string
  exam_name: string
  total_marks: number
  created_at: string
  submissions: { total: number; graded: number; pending: number }
  marks: { average: number | null }
  review: { submissions_needing_review: number }
}

interface ExamCardsResponse {
  totals: { students: number; exams: number }
  exams: ExamCard[]
}

interface ClassSummary {
  assignment: Assignment
  students: number
  exams: number
  waiting: number
}

interface OpenExam {
  exam: ExamCard
  assignment: Assignment
  waiting: number
}

const EMPTY_CARDS = new Map<string, ExamCardsResponse>()

/* Columns follow the page's own width so collapsing the sidebar frees room
   for another door. */
// Fixed-size doors in a wrapping row, not a fluid grid: when the sidebar
// opens or closes the content width animates, and a column-count grid with
// aspect-ratio cards snapped between layouts mid-transition, every card
// jumping in both width and height. Fixed doors simply reflow.
const DOOR_GRID = "flex flex-wrap gap-4"

/** The count strip beside the greeting, cell for cell. */
function StatStripSkeleton() {
  return (
    <div
      aria-hidden
      className="flex divide-x divide-border rounded-xl border border-border bg-background"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex min-w-[5.5rem] flex-col items-center gap-1.5 px-4 py-2.5"
        >
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  )
}

/** A door-sized placeholder: the class code top-left, the subject and class
 *  line bottom-left, at the fixed size a ClassDoorCard takes in the row. */
function ClassDoorSkeleton() {
  return (
    <div className="relative h-48 w-full shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:w-64">
      <div className="absolute inset-x-0 top-0 p-3">
        <Skeleton className="h-5 w-9 rounded-md bg-background/60" />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-3">
        <Skeleton className="h-4 w-2/3 bg-background/60" />
        <Skeleton className="h-3 w-1/2 bg-background/60" />
      </div>
    </div>
  )
}

export function TeacherHome({
  firstName,
  assignments,
  assignmentsLoading,
}: {
  firstName: string
  assignments: Assignment[]
  assignmentsLoading: boolean
}) {
  const navigate = useNavigate()
  const [fetched, setFetched] = useState<Map<string, ExamCardsResponse> | null>(
    null
  )
  // With no classes there is nothing to fetch, so the empty result is derived
  // rather than written into state from inside the effect.
  const cards =
    !assignmentsLoading && assignments.length === 0 ? EMPTY_CARDS : fetched

  // One exam-cards call per class. There is no cross-class endpoint, so the
  // page fans out and tolerates individual failures rather than losing every
  // panel to one bad class.
  useEffect(() => {
    if (assignmentsLoading || assignments.length === 0) return
    let cancelled = false
    Promise.allSettled(
      assignments.map((a) =>
        apiClient
          .get<ExamCardsResponse>(
            `/api/grading/class-subject/${a.class_subject_id}/exam-cards`
          )
          .then((res) => [a.class_subject_id, res] as const)
      )
    ).then((results) => {
      if (cancelled) return
      const map = new Map<string, ExamCardsResponse>()
      for (const r of results) {
        if (r.status === "fulfilled") map.set(r.value[0], r.value[1])
      }
      setFetched(map)
    })
    return () => {
      cancelled = true
    }
  }, [assignments, assignmentsLoading])

  const isLoading = assignmentsLoading || cards === null

  const { classes, openExams, recentExams, totals } = useMemo(() => {
    const classes: ClassSummary[] = []
    const openExams: OpenExam[] = []
    const all: { exam: ExamCard; assignment: Assignment }[] = []
    let students = 0
    let sheetsWaiting = 0

    for (const a of assignments) {
      const res = cards?.get(a.class_subject_id)
      const exams = res?.exams ?? []
      let waiting = 0
      for (const exam of exams) {
        const w =
          (exam.submissions?.pending ?? 0) +
          (exam.review?.submissions_needing_review ?? 0)
        waiting += w
        if (w > 0) openExams.push({ exam, assignment: a, waiting: w })
        all.push({ exam, assignment: a })
      }
      students += res?.totals.students ?? 0
      sheetsWaiting += waiting
      classes.push({
        assignment: a,
        students: res?.totals.students ?? 0,
        exams: exams.length,
        waiting,
      })
    }
    openExams.sort((a, b) => b.waiting - a.waiting)
    all.sort(
      (a, b) =>
        dayjs(b.exam.created_at).valueOf() - dayjs(a.exam.created_at).valueOf()
    )
    return {
      classes,
      openExams,
      recentExams: all.slice(0, 5),
      totals: { students, sheetsWaiting, exams: all.length },
    }
  }, [assignments, cards])

  const summary = isLoading ? (
    <Skeleton className="h-4 w-72" />
  ) : assignments.length === 0 ? (
    "No classes assigned yet. Your admin will set you up."
  ) : totals.sheetsWaiting > 0 ? (
    <>
      <span className="font-medium text-foreground">
        {totals.sheetsWaiting} {totals.sheetsWaiting === 1 ? "sheet" : "sheets"}
      </span>{" "}
      {totals.sheetsWaiting === 1 ? "is" : "are"} waiting on you across{" "}
      {openExams.length} {openExams.length === 1 ? "exam" : "exams"}.
    </>
  ) : (
    "Nothing is waiting on you. Open a class to build a paper or check results."
  )

  return (
    <>
      <HomeGreeting
        name={firstName}
        summary={summary}
        aside={
          isLoading || assignments.length > 0 ? (
            <LoadingSwap loading={isLoading} skeleton={<StatStripSkeleton />}>
              <StatStrip
                items={[
                  { value: classes.length, label: "Classes" },
                  { value: totals.students, label: "Students" },
                  { value: totals.exams, label: "Exams" },
                  {
                    value: totals.sheetsWaiting,
                    label: "To grade",
                    accent: totals.sheetsWaiting > 0,
                  },
                ]}
              />
            </LoadingSwap>
          ) : null
        }
      />

      {/* ── Classes: a row of doors ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ChalkboardIcon className="size-4 text-muted-foreground" />
          <span className="flex items-baseline gap-1.5">
            <h2 className="text-sm font-medium text-foreground">
              Your classes
            </h2>
            {!isLoading && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {classes.length}
              </span>
            )}
          </span>
        </div>

        <LoadingSwap
          loading={isLoading}
          skeleton={
            <div aria-hidden className={DOOR_GRID}>
              {Array.from({ length: 4 }).map((_, i) => (
                <ClassDoorSkeleton key={i} />
              ))}
            </div>
          }
        >
          {classes.length === 0 ? (
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-border px-5 py-6">
              <Sticker name="peek" size={56} />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">
                  No classes yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Once an admin assigns you a class and subject it shows up
                  here.
                </p>
              </div>
            </div>
          ) : (
            <div className={DOOR_GRID}>
              {classes.map((c, i) => (
                <ClassDoorCard
                  key={c.assignment.class_subject_id}
                  assignment={c.assignment}
                  students={c.students}
                  exams={c.exams}
                  waiting={c.waiting}
                  index={i}
                />
              ))}
            </div>
          )}
        </LoadingSwap>
      </section>

      {/* ── Three equal panels ── */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        <HomePanel
          icon={WarningCircleIcon}
          title="Needs your attention"
          count={isLoading ? undefined : openExams.length}
        >
          <LoadingSwap
            loading={isLoading}
            skeleton={
              <div aria-hidden className="divide-y divide-border">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="size-9 shrink-0 rounded-lg" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            }
          >
            {openExams.length === 0 ? (
              <PanelEmpty
                sticker={<Sticker name="peace" size={56} />}
                title="All caught up"
                body="Every uploaded sheet has been graded and reviewed."
              />
            ) : (
              <div className="divide-y divide-border">
                {openExams.slice(0, 5).map(({ exam, assignment, waiting }) => (
                  <button
                    key={`${assignment.class_subject_id}-${exam.id}`}
                    type="button"
                    onClick={() =>
                      navigate(`/class/${assignment.class_subject_id}/grading`)
                    }
                    className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-sm font-semibold text-amber-700 tabular-nums dark:bg-amber-900/40 dark:text-amber-400">
                      {waiting}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {exam.exam_name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {classLabel(assignment)}
                      </span>
                    </span>
                    <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}
          </LoadingSwap>
        </HomePanel>

        <HomePanel
          icon={ChecksIcon}
          title="Recent exams"
          count={isLoading ? undefined : recentExams.length}
        >
          <LoadingSwap
            loading={isLoading}
            skeleton={
              <div aria-hidden className="divide-y divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex w-9 shrink-0 flex-col items-center gap-1">
                      <Skeleton className="h-4 w-5" />
                      <Skeleton className="h-2.5 w-6" />
                    </div>
                    <span className="h-8 w-px shrink-0 bg-border" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-4 w-3/5" />
                      <Skeleton className="h-3 w-2/5" />
                    </div>
                    <Skeleton className="h-3 w-14 shrink-0" />
                  </div>
                ))}
              </div>
            }
          >
            {recentExams.length === 0 ? (
              <PanelEmpty
                sticker={<Sticker name="idea" size={56} />}
                title="No exams yet"
                body="Open a class and build your first paper."
              />
            ) : (
              <div className="divide-y divide-border">
                {recentExams.map(({ exam, assignment }) => {
                  const total = exam.submissions?.total ?? 0
                  const graded = exam.submissions?.graded ?? 0
                  const pct = total > 0 ? Math.round((graded / total) * 100) : 0
                  const done = total > 0 && graded === total
                  const when = dayjs(exam.created_at)
                  const code = assignment.class
                    ? `${assignment.class.grade}${assignment.class.section}`
                    : "—"
                  const palette = coverFor(
                    assignment.class ? String(assignment.class.grade) : "?"
                  )
                  return (
                    <button
                      key={`${assignment.class_subject_id}-${exam.id}`}
                      type="button"
                      onClick={() =>
                        navigate(
                          `/class/${assignment.class_subject_id}/exams?exam=${exam.id}`
                        )
                      }
                      className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
                    >
                      {/* Date stamp */}
                      <span className="flex w-9 shrink-0 flex-col items-center leading-none">
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {when.format("D")}
                        </span>
                        <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                          {when.format("MMM")}
                        </span>
                      </span>

                      <span className="h-8 w-px shrink-0 bg-border" />

                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {exam.exam_name}
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            className={cn(
                              "rounded px-1 py-px text-[10px] font-semibold tabular-nums",
                              palette.tint,
                              palette.disc
                            )}
                          >
                            {code}
                          </span>
                          <span className="truncate">
                            {assignment.subject?.subject_name ?? ""}
                            {exam.total_marks
                              ? ` · ${exam.total_marks} marks`
                              : ""}
                          </span>
                        </span>
                      </span>

                      {/* Status */}
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {total === 0 ? (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <UploadSimpleIcon className="size-3" />
                            No sheets
                          </span>
                        ) : done ? (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                            <CheckCircleIcon weight="fill" className="size-3" />
                            Graded
                            {exam.marks?.average != null && (
                              <span className="font-normal text-muted-foreground">
                                · avg {exam.marks.average}
                              </span>
                            )}
                          </span>
                        ) : (
                          <>
                            <span className="text-[11px] font-medium text-amber-700 tabular-nums dark:text-amber-400">
                              {graded}/{total} graded
                            </span>
                            <span className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                              <span
                                className="block h-full rounded-full bg-amber-500"
                                style={{ width: `${pct}%` }}
                              />
                            </span>
                          </>
                        )}
                      </span>

                      <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  )
                })}
              </div>
            )}
          </LoadingSwap>
        </HomePanel>

        <AskHintPanel />
      </div>
    </>
  )
}
