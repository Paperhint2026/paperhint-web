import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, useReducedMotion } from "motion/react"
import dayjs from "dayjs"
import {
  ArrowRightIcon,
  CircleNotchIcon,
  EyeIcon,
  IdentificationBadgeIcon,
  TrophyIcon,
  UploadIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { tameCaps } from "@/lib/format"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Sticker } from "@/components/shared/sticker"
import { RingGauge } from "./ring-gauge"
import { StudentDetailDrawer } from "./student-detail-drawer"
import {
  cellPct,
  getInitials,
  isGrading,
  scoreTone,
  TONE_BAR,
  TONE_TEXT,
  type ExamCol,
  type MarkCell,
  type StudentRow,
} from "../lib/marks"

const ENTER = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
}

/**
 * A quick look at one student's marks in this class — opened from their card.
 * Every paper is a row with the score, a meter and the way into its answer
 * sheet; the full personal profile is one tap further.
 */
export function StudentMarksPreview({
  student,
  exams,
  cells,
  averagePct,
  classSubjectId,
  open,
  onOpenChange,
}: {
  student: StudentRow | null
  exams: ExamCol[]
  cells: Record<string, MarkCell> | undefined
  averagePct: number | undefined
  classSubjectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const reduceMotion = useReducedMotion()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)

  // Newest paper first — the one a teacher most likely came to check.
  const ordered = useMemo(
    () =>
      [...exams].sort(
        (a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
      ),
    [exams]
  )

  const gradedCount = exams.filter(
    (ex) => cells?.[ex.id]?.status === "graded"
  ).length
  const pendingCount = exams.filter((ex) => isGrading(cells?.[ex.id])).length
  const missingCount = exams.filter((ex) => !cells?.[ex.id]).length

  let best: { exam: ExamCol; pct: number } | null = null
  for (const ex of exams) {
    const pct = cellPct(ex, cells?.[ex.id])
    if (pct != null && (!best || pct > best.pct)) best = { exam: ex, pct }
  }

  const go = (to: string) => {
    onOpenChange(false)
    navigate(to)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          size={isMobile ? "full" : "xl"}
          showCloseButton={false}
          className="flex h-full w-full flex-col gap-0 p-0"
        >
          {/* Toolbar */}
          <div className="flex shrink-0 items-center justify-end gap-1 px-3 pt-3">
            {student && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setProfileOpen(true)}
              >
                <IdentificationBadgeIcon className="size-4" />
                Full profile
              </Button>
            )}
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label="Close"
              >
                <XIcon className="size-4" />
              </Button>
            </SheetClose>
          </div>

          {student && (
            <div className="no-scrollbar flex-1 overflow-y-auto">
              <motion.div
                initial="hidden"
                animate="show"
                transition={{ staggerChildren: reduceMotion ? 0 : 0.06 }}
                className="flex flex-col"
              >
                {/* Hero */}
                <motion.div variants={ENTER}>
                  <SheetHeader className="relative shrink-0 gap-0 overflow-hidden px-6 pt-1 pb-5 text-left">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -top-6 right-2 text-[7rem] leading-none font-bold tracking-tighter text-foreground/[0.035] select-none"
                    >
                      {String(student.roll_number).padStart(2, "0")}
                    </span>
                    <div className="relative flex items-center gap-5">
                      <Avatar className="size-16 rounded-2xl shadow-xs after:rounded-2xl">
                        <AvatarFallback className="rounded-2xl text-xl">
                          {getInitials(student.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <SheetTitle className="truncate text-2xl font-semibold tracking-tight text-foreground">
                          {student.full_name}
                        </SheetTitle>
                        <SheetDescription className="truncate text-sm text-muted-foreground">
                          Roll {student.roll_number}
                          {student.register_number && (
                            <>
                              <span className="mx-1.5 text-border">·</span>
                              {student.register_number}
                            </>
                          )}
                        </SheetDescription>
                      </div>
                      <RingGauge
                        pct={averagePct ?? null}
                        size={64}
                        stroke={5}
                      />
                    </div>
                  </SheetHeader>
                </motion.div>

                {/* Counts on a hairline */}
                <motion.div
                  variants={ENTER}
                  className="mx-6 flex flex-wrap items-center gap-x-5 gap-y-1 border-y border-border py-3 text-xs text-muted-foreground tabular-nums"
                >
                  <span>
                    <span className="font-semibold text-foreground">
                      {gradedCount}
                    </span>{" "}
                    of {exams.length} {exams.length === 1 ? "paper" : "papers"}{" "}
                    graded
                  </span>
                  {pendingCount > 0 && (
                    <span className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                      <CircleNotchIcon className="size-3 animate-spin" />
                      {pendingCount} with Hint
                    </span>
                  )}
                  {missingCount > 0 && (
                    <span>
                      {missingCount} {missingCount === 1 ? "sheet" : "sheets"}{" "}
                      not uploaded
                    </span>
                  )}
                  {best && (
                    <span className="ml-auto flex min-w-0 items-center gap-1.5">
                      <TrophyIcon className="size-3.5 shrink-0" />
                      <span className="truncate">
                        Best in {tameCaps(best.exam.exam_name)}
                      </span>
                    </span>
                  )}
                </motion.div>

                {/* Papers */}
                <div className="flex flex-col gap-3 px-6 py-5">
                  {ordered.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <Sticker name="sleep" size={96} />
                      <p className="text-sm text-muted-foreground">
                        No papers in this class yet.
                      </p>
                    </div>
                  ) : (
                    ordered.map((ex) => {
                      const cell = cells?.[ex.id]
                      const pct = cellPct(ex, cell)
                      const grading = isGrading(cell)
                      const failed = !!cell && !grading && pct == null
                      const when = dayjs(ex.created_at)
                      return (
                        <motion.div
                          key={ex.id}
                          variants={ENTER}
                          className="flex flex-col gap-3 rounded-xl border border-border p-4"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-sidebar leading-none">
                              <span className="text-sm font-semibold text-foreground tabular-nums">
                                {when.format("D")}
                              </span>
                              <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
                                {when.format("MMM")}
                              </span>
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <p className="truncate text-sm font-medium text-foreground">
                                {tameCaps(ex.exam_name)}
                              </p>
                              <p className="text-[11px] text-muted-foreground tabular-nums">
                                {ex.total_marks} marks
                              </p>
                            </div>

                            {pct != null ? (
                              <span className="flex items-baseline gap-1.5">
                                <span
                                  className={cn(
                                    "text-lg font-semibold tabular-nums",
                                    TONE_TEXT[scoreTone(pct)]
                                  )}
                                >
                                  {cell?.final ?? 0}
                                </span>
                                <span className="text-sm text-muted-foreground tabular-nums">
                                  / {ex.total_marks}
                                </span>
                              </span>
                            ) : grading ? (
                              <span className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400">
                                <CircleNotchIcon className="size-3.5 animate-spin" />
                                Hint is grading
                              </span>
                            ) : failed ? (
                              <span className="flex items-center gap-1.5 text-xs text-destructive">
                                <WarningIcon
                                  weight="fill"
                                  className="size-3.5"
                                />
                                Grading failed
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/70">
                                No sheet yet
                              </span>
                            )}
                          </div>

                          {pct != null && (
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-[width] duration-700 ease-out",
                                  TONE_BAR[scoreTone(pct)]
                                )}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                go(
                                  `/class/${classSubjectId}/exams?exam=${ex.id}`
                                )
                              }
                              className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                            >
                              Open paper
                            </button>
                            {cell?.submission_id && pct != null ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() =>
                                  go(
                                    `/class/${classSubjectId}/grading/${cell.submission_id}/review`
                                  )
                                }
                              >
                                <EyeIcon className="size-3.5" />
                                Review sheet
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-muted-foreground"
                                onClick={() =>
                                  go(
                                    `/class/${classSubjectId}/grading?exam=${ex.id}`
                                  )
                                }
                              >
                                {cell ? (
                                  <ArrowRightIcon className="size-3.5" />
                                ) : (
                                  <UploadIcon className="size-3.5" />
                                )}
                                {cell ? "Go to grading" : "Upload sheet"}
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      )
                    })
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <StudentDetailDrawer
        studentId={profileOpen ? (student?.id ?? null) : null}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        canManage={false}
      />
    </>
  )
}
