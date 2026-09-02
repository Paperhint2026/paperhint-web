import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { motion, useReducedMotion } from "motion/react"
import { LoadingSwap } from "@/components/shared/loading-swap"
import dayjs from "dayjs"
import {
  ArrowRightIcon,
  BookOpenIcon,
  CaretRightIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExamIcon,
  FileTextIcon,
  ImageIcon,
  ListChecksIcon,
  UploadSimpleIcon,
  UsersIcon,
  WarningCircleIcon,
  type Icon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { timeAgo } from "@/lib/time"
import { tameCaps } from "@/lib/format"
import { useAuth } from "@/lib/auth"
import {
  useTeacherAssignments,
  classLabel,
} from "@/hooks/use-teacher-assignments"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Sticker } from "@/components/shared/sticker"
import { Panel, PanelEmpty, PanelFooter } from "@/components/shared/panel"
import { coverFor } from "@/modules/classes/lib/grade-palette"
import { DocThumb } from "@/components/shared/doc-thumb"

// Shapes reused from the grading exam-cards endpoint — see
// grading.controller.js -> exports.getExamCards.
interface ExamCardLite {
  id: string
  exam_name: string
  total_marks: number
  created_at: string
  questions_count: number
  submissions: {
    total: number
    graded: number
    pending: number
    failed: number
  }
  marks: { average: number | null }
  review: { submissions_needing_review: number }
}

interface ExamCardsResponse {
  totals: {
    students: number
    exams: number
    in_progress: number
    needs_review: number
    done: number
  }
  exams: ExamCardLite[]
}

interface MaterialLite {
  id: string
  title: string
  uploaded_at: string
  file_url?: string
  tags?: string[] | null
  processed?: boolean
  visibility?: "public" | "private"
}

function fileExt(url?: string) {
  const m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url ?? "")
  return m ? m[1].toUpperCase() : undefined
}

function fileIconFor(url?: string) {
  const lower = (url ?? "").toLowerCase()
  if (/\.(jpe?g|png|webp|gif|svg)(?:[?#]|$)/.test(lower)) return ImageIcon
  return FileTextIcon
}

type StepKey = "knowledge" | "exams" | "grading" | "students"

const ENTER = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

/** The page's silhouette while the class loads: hero with its count strip,
 *  the four pipeline cards, then the two panels — each block in the shape of
 *  what replaces it, so nothing shifts when the data lands. */
function ClassHomeSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      {/* Hero */}
      <div className="flex flex-wrap items-center gap-4">
        <Skeleton className="size-14 shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="flex divide-x divide-border rounded-xl border border-border bg-background">
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
      </div>

      {/* Pipeline */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="hidden h-3 w-64 sm:block" />
        </div>
        <div className="grid gap-3 @3xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col rounded-xl border border-border bg-background p-4"
            >
              <Skeleton className="size-10 rounded-lg" />
              <div className="mt-4 flex flex-col gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="mt-4 flex items-baseline gap-1.5">
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="mt-4 border-t border-border pt-3">
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two panels */}
      <div className="grid gap-4 @3xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, p) => (
          <div
            key={p}
            className="flex min-w-0 flex-col rounded-xl border border-border bg-background"
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <Skeleton className="size-10 shrink-0 rounded-lg" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="size-4 shrink-0 rounded-full" />
                </div>
              ))}
            </div>
            <div className="mt-auto flex justify-center border-t border-border px-4 py-2.5">
              <Skeleton className="h-3.5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ClassHomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const { classSubjectId } = useParams<{ classSubjectId: string }>()
  const { assignments } = useTeacherAssignments()

  // Loading is derived: data is stamped with the class-subject it was
  // fetched for, so switching classes shows the skeleton without a
  // synchronous setState in the effect.
  const [data, setData] = useState<{
    csId: string
    cards: ExamCardsResponse | null
    materials: MaterialLite[]
  } | null>(null)
  const isLoading = data?.csId !== classSubjectId

  useEffect(() => {
    if (!classSubjectId) return
    let cancelled = false
    Promise.allSettled([
      apiClient.get<ExamCardsResponse>(
        `/api/grading/class-subject/${classSubjectId}/exam-cards`
      ),
      apiClient.get<{ materials: MaterialLite[] }>(
        `/api/knowledge/materials/${classSubjectId}`
      ),
    ]).then(([cardsRes, materialsRes]) => {
      if (cancelled) return
      setData({
        csId: classSubjectId,
        cards: cardsRes.status === "fulfilled" ? cardsRes.value : null,
        materials:
          materialsRes.status === "fulfilled"
            ? (materialsRes.value.materials ?? [])
            : [],
      })
    })
    return () => {
      cancelled = true
    }
  }, [classSubjectId])

  const cards = data?.cards ?? null
  const materials = useMemo(() => data?.materials ?? [], [data])

  const assignment = assignments.find(
    (a) => a.class_subject_id === classSubjectId
  )

  // Class average % across exams that have at least one graded submission.
  const classAvgPct = useMemo(() => {
    if (!cards) return null
    const pcts = cards.exams
      .filter((e) => e.marks.average != null && e.total_marks > 0)
      .map((e) => (e.marks.average! / e.total_marks) * 100)
    if (pcts.length === 0) return null
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
  }, [cards])

  const recentExams = useMemo(() => {
    if (!cards) return []
    return [...cards.exams]
      .sort(
        (a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
      )
      .slice(0, 5)
  }, [cards])

  const recentMaterials = useMemo(
    () =>
      [...materials]
        .sort(
          (a, b) =>
            dayjs(b.uploaded_at).valueOf() - dayjs(a.uploaded_at).valueOf()
        )
        .slice(0, 5),
    [materials]
  )

  if (!user) return null

  if (!classSubjectId) {
    return (
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-3 p-8">
        <Sticker name="peek" size={72} />
        <p className="text-sm text-muted-foreground">
          Pick a class from the sidebar to open it.
        </p>
      </div>
    )
  }

  const totals = cards?.totals ?? {
    students: 0,
    exams: 0,
    in_progress: 0,
    needs_review: 0,
    done: 0,
  }
  const base = `/class/${classSubjectId}`
  const grade = assignment?.class ? String(assignment.class.grade) : "?"
  const code = assignment?.class
    ? `${assignment.class.grade}${assignment.class.section}`
    : "—"
  const palette = coverFor(grade)
  const sheetsWaiting = totals.in_progress + totals.needs_review

  /* Where the teacher should go next. The first unmet condition wins, so a
     brand-new class points at Knowledge and a busy one at Grading. */
  const currentStep: StepKey =
    materials.length === 0
      ? "knowledge"
      : totals.exams === 0
        ? "exams"
        : sheetsWaiting > 0 || totals.done === 0
          ? "grading"
          : "students"

  const steps: {
    key: StepKey
    icon: Icon
    title: string
    verb: string
    /** Big number on the card. */
    value: string | number
    /** Word after the number. */
    label: string
    hint: string
    tone?: "warning" | "done"
  }[] = [
    {
      key: "knowledge",
      icon: BookOpenIcon,
      title: "Knowledge",
      verb: "Add textbooks and notes",
      value: materials.length,
      label: materials.length === 1 ? "source" : "sources",
      hint: "Hint reads these to write questions and answer you.",
      tone: materials.length > 0 ? "done" : undefined,
    },
    {
      key: "exams",
      icon: ExamIcon,
      title: "Exams",
      verb: "Build a question paper",
      value: totals.exams,
      label: totals.exams === 1 ? "paper" : "papers",
      hint: "Generate from your sources or upload your own.",
      tone: totals.exams > 0 ? "done" : undefined,
    },
    {
      key: "grading",
      icon: ListChecksIcon,
      title: "Grading",
      verb: "Upload answer sheets",
      value: sheetsWaiting > 0 ? sheetsWaiting : totals.done,
      label:
        sheetsWaiting > 0
          ? sheetsWaiting === 1
            ? "sheet waiting"
            : "sheets waiting"
          : totals.done === 1
            ? "sheet graded"
            : "sheets graded",
      hint:
        totals.exams === 0
          ? "Needs a paper first."
          : "Hint grades each sheet; you review the doubtful ones.",
      tone:
        sheetsWaiting > 0 ? "warning" : totals.done > 0 ? "done" : undefined,
    },
    {
      key: "students",
      icon: ChartBarIcon,
      title: "Results",
      verb: "See how the class did",
      value: classAvgPct != null ? `${classAvgPct}%` : totals.students,
      label:
        classAvgPct != null
          ? "class average"
          : totals.students === 1
            ? "student · no marks yet"
            : "students · no marks yet",
      hint: "Marks per student, per exam, in one grid.",
      tone: classAvgPct != null ? "done" : undefined,
    },
  ]

  const stagger = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex min-h-full flex-col gap-6 pb-12"
      )}
    >
      <LoadingSwap loading={isLoading} skeleton={<ClassHomeSkeleton />}>
        <motion.div
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: reduceMotion ? 0 : 0.06 }}
          className="flex flex-col gap-6"
        >
          {/* ── Hero ── */}
          <motion.div
            variants={ENTER}
            transition={stagger}
            className="flex flex-wrap items-center gap-4"
          >
            <div
              className={cn(
                "relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg font-semibold text-white shadow-xs",
                palette.cover
              )}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-1 -bottom-3 text-[3.5rem] leading-none font-bold text-white/15 select-none"
              >
                {grade}
              </span>
              <span className="relative">{code}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                {assignment?.subject?.subject_name ?? "Class"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {assignment
                  ? `Grade ${assignment.class?.grade} · Section ${assignment.class?.section}`
                  : classLabel({
                      class_subject_id: classSubjectId,
                      class: null,
                      subject: null,
                    })}
              </p>
            </div>

            {/* Counts */}
            <div className="flex divide-x divide-border rounded-xl border border-border bg-background">
              {[
                { icon: UsersIcon, value: totals.students, label: "Students" },
                { icon: ExamIcon, value: totals.exams, label: "Exams" },
                {
                  icon: FileTextIcon,
                  value: materials.length,
                  label: "Sources",
                },
                {
                  icon: ChartBarIcon,
                  value: classAvgPct != null ? `${classAvgPct}%` : "—",
                  label: "Average",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex min-w-[5.5rem] flex-col items-center gap-0.5 px-4 py-2.5"
                >
                  <span className="text-lg leading-tight font-semibold text-foreground tabular-nums">
                    {s.value}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <s.icon className="size-3" />
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── The class pipeline ── */}
          <motion.div
            variants={ENTER}
            transition={stagger}
            className="flex flex-col gap-3"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-foreground">
                How this class works
              </h2>
              <span className="text-xs text-muted-foreground">
                Sources feed papers, papers get graded, grades become results.
              </span>
            </div>

            <ol className="grid gap-3 @3xl:grid-cols-4">
              {steps.map((step, i) => {
                const isCurrent = step.key === currentStep
                const isDone = step.tone === "done" && !isCurrent
                const isLast = i === steps.length - 1
                return (
                  <li key={step.key} className="relative">
                    <button
                      type="button"
                      onClick={() => navigate(`${base}/${step.key}`)}
                      className={cn(
                        "group flex h-full w-full flex-col rounded-xl border p-4 text-left transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
                        isCurrent
                          ? "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20"
                          : "border-border bg-background"
                      )}
                    >
                      {/* Icon tile with the step number pinned to its corner */}
                      <div className="flex items-start justify-between">
                        <span className="relative">
                          <span
                            className={cn(
                              "flex size-10 items-center justify-center rounded-lg",
                              isCurrent
                                ? "bg-primary text-primary-foreground"
                                : isDone
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                  : "bg-sidebar text-muted-foreground"
                            )}
                          >
                            <step.icon
                              weight={isCurrent || isDone ? "fill" : "regular"}
                              className="size-5"
                            />
                          </span>
                          <span
                            className={cn(
                              "absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums ring-2 ring-background",
                              isDone
                                ? "bg-emerald-500 text-white"
                                : isCurrent
                                  ? "bg-foreground text-background"
                                  : "bg-muted text-muted-foreground"
                            )}
                          >
                            {isDone ? (
                              <CheckCircleIcon
                                weight="fill"
                                className="size-3.5"
                              />
                            ) : (
                              i + 1
                            )}
                          </span>
                        </span>
                        {isCurrent && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {materials.length === 0 && step.key === "knowledge"
                              ? "Start here"
                              : "Up next"}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">
                          {step.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {step.verb}
                        </span>
                      </div>

                      {/* Headline number */}
                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span
                          className={cn(
                            "text-2xl leading-none font-semibold tracking-tight tabular-nums",
                            step.tone === "warning"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-foreground"
                          )}
                        >
                          {step.value}
                        </span>
                        <span
                          className={cn(
                            "text-xs",
                            step.tone === "warning"
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {step.label}
                        </span>
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                        <span className="truncate text-[11px] text-muted-foreground">
                          {step.hint}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                          Open
                          <ArrowRightIcon className="size-3" />
                        </span>
                      </div>
                    </button>

                    {/* Connector to the next step (wide layout only) */}
                    {!isLast && (
                      <span
                        aria-hidden
                        className="absolute top-9 -right-3 z-10 hidden size-3 items-center justify-center @3xl:flex"
                      >
                        <CaretRightIcon className="size-3 text-muted-foreground/60" />
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </motion.div>

          {/* ── Two panels ── */}
          <motion.div
            variants={ENTER}
            transition={stagger}
            className="grid gap-4 @3xl:grid-cols-2 @3xl:items-stretch"
          >
            <Panel
              icon={ExamIcon}
              title="Recent exams"
              count={recentExams.length || undefined}
            >
              {recentExams.length === 0 ? (
                <PanelEmpty
                  sticker={<Sticker name="idea" size={56} />}
                  title="No papers yet"
                  body={
                    materials.length === 0
                      ? "Add a textbook first, then Hint can draft a paper from it."
                      : "Build your first question paper from the sources you've added."
                  }
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`${base}/exams`)}
                    >
                      {materials.length === 0 ? "Go to Knowledge" : "New exam"}
                    </Button>
                  }
                />
              ) : (
                <div className="divide-y divide-border">
                  {recentExams.map((ex) => {
                    const total = totals.students
                    const graded = ex.submissions.graded
                    const pct =
                      total > 0
                        ? Math.min(100, Math.round((graded / total) * 100))
                        : 0
                    const done =
                      total > 0 &&
                      graded === total &&
                      ex.review.submissions_needing_review === 0
                    const when = dayjs(ex.created_at)
                    return (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => navigate(`${base}/exams?exam=${ex.id}`)}
                        className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
                      >
                        {/* Calendar tile */}
                        <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-sidebar leading-none">
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            {when.format("D")}
                          </span>
                          <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
                            {when.format("MMM")}
                          </span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium text-foreground">
                            {tameCaps(ex.exam_name)}
                          </span>
                          <span className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                            <ListChecksIcon className="size-3 shrink-0" />
                            {ex.questions_count}{" "}
                            {ex.questions_count === 1
                              ? "question"
                              : "questions"}
                            <span className="text-border">·</span>
                            {ex.total_marks} marks
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          {graded === 0 && ex.submissions.total === 0 ? (
                            <span className="flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              <UploadSimpleIcon className="size-3" />
                              No sheets yet
                            </span>
                          ) : done ? (
                            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              <CheckCircleIcon
                                weight="fill"
                                className="size-3"
                              />
                              Graded
                              {ex.marks.average != null && (
                                <span className="font-normal text-muted-foreground">
                                  · avg {ex.marks.average}
                                </span>
                              )}
                            </span>
                          ) : (
                            <>
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 tabular-nums dark:bg-amber-900/40 dark:text-amber-400">
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
              <PanelFooter
                label={`All ${cards?.exams.length ?? 0} ${(cards?.exams.length ?? 0) === 1 ? "exam" : "exams"}`}
                onClick={() => navigate(`${base}/exams`)}
              />
            </Panel>

            <Panel
              icon={BookOpenIcon}
              title="Knowledge sources"
              count={materials.length || undefined}
            >
              {recentMaterials.length === 0 ? (
                <PanelEmpty
                  sticker={<Sticker name="point" size={56} />}
                  title="Nothing for Hint to read yet"
                  body="Upload the textbook or your notes. Every paper and answer for this class starts here."
                  action={
                    <Button
                      size="sm"
                      onClick={() => navigate(`${base}/knowledge`)}
                    >
                      Add a source
                    </Button>
                  }
                />
              ) : (
                <div className="divide-y divide-border">
                  {recentMaterials.map((m) => {
                    const MIcon = fileIconFor(m.file_url)
                    const tags = m.tags ?? []
                    const shown = tags.slice(0, 3)
                    const rest = tags.length - shown.length
                    const open = () =>
                      m.file_url
                        ? window.open(m.file_url, "_blank", "noopener")
                        : navigate(`${base}/knowledge`)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={open}
                        className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
                      >
                        <DocThumb icon={MIcon} ext={fileExt(m.file_url)} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium text-foreground">
                            {tameCaps(m.title)}
                          </span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {shown.length > 0 ? (
                              <>
                                {shown.map((t, i) => (
                                  <span key={t}>
                                    {i > 0 && (
                                      <span className="mx-1 text-border">
                                        ·
                                      </span>
                                    )}
                                    {t}
                                  </span>
                                ))}
                                {rest > 0 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <span className="mx-1 text-border">
                                          ·
                                        </span>
                                        +{rest} more
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {tags.slice(3).join(", ")}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </>
                            ) : (
                              "No tags yet"
                            )}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
                          {m.processed !== undefined && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex">
                                  {m.processed ? (
                                    <CheckCircleIcon
                                      weight="fill"
                                      className="size-4 text-emerald-500"
                                    />
                                  ) : (
                                    <WarningCircleIcon
                                      weight="fill"
                                      className="size-4 text-amber-500"
                                    />
                                  )}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {m.processed
                                  ? "Analyzed — Hint can use this"
                                  : "Not analyzed yet"}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="w-14 text-right tabular-nums">
                                {timeAgo(m.uploaded_at)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {dayjs(m.uploaded_at).format("D MMM YYYY")}
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    )
                  })}
                </div>
              )}
              <PanelFooter
                label={`All ${materials.length} ${materials.length === 1 ? "source" : "sources"}`}
                onClick={() => navigate(`${base}/knowledge`)}
              />
            </Panel>
          </motion.div>
        </motion.div>
      </LoadingSwap>
    </div>
  )
}
