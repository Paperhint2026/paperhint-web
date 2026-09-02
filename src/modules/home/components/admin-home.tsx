import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowRightIcon,
  BookOpenTextIcon,
  BooksIcon,
  ChalkboardIcon,
  ChalkboardTeacherIcon,
  CheckCircleIcon,
  CircleIcon,
  EnvelopeSimpleIcon,
  GraduationCapIcon,
  ListChecksIcon,
  UsersIcon,
  WarningCircleIcon,
  type Icon,
} from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { useAppDispatch, useAppSelector } from "@/store"
import { fetchSubjects } from "@/store/subjects-slice"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Sticker } from "@/components/shared/sticker"
import { coverFor } from "@/modules/classes/lib/grade-palette"
import { AskHintPanel } from "@/modules/home/components/ask-hint-panel"
import {
  HomeGreeting,
  StatStrip,
} from "@/modules/home/components/home-greeting"
import {
  HomePanel,
  PanelEmpty,
  PanelFooter,
} from "@/modules/home/components/home-panel"

interface ClassRecord {
  id: string
  grade: string
  section: string
}

interface GroupedClasses {
  classes: Record<string, ClassRecord[]>
  gradeSubjects?: Record<string, { id: string; subject_name: string }[]>
  studentCounts?: Record<string, number>
}

// Shape of GET /api/auth/teachers/overview — see auth.controller.js ->
// exports.getTeachersOverview.
interface TeacherLite {
  id: string
  full_name: string
  designation?: string | null
  profile_url?: string | null
  status?: "invited" | "active" | "inactive" | null
  total_assignments: number
  total_classes: number
  total_subjects: number
  subjects?: { id: string; subject_name: string }[]
}

interface SchoolData {
  grouped: GroupedClasses
  teachers: TeacherLite[]
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/* Doors wrap to the page's own width so collapsing the sidebar frees room
   for another. Same rhythm as the teacher home. */
const DOOR_GRID =
  "grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(12.5rem,1fr))]"

/** One grade as a door in the corridor — cover colour, the number as a
 *  watermark, section chips, and the three counts an admin checks first. */
function GradeDoorCard({
  grade,
  sections,
  subjects,
  students,
  index = 0,
  onOpen,
}: {
  grade: string
  sections: string[]
  subjects: number
  students: number
  index?: number
  onOpen: () => void
}) {
  const palette = coverFor(grade)
  const gaps = [
    subjects === 0 ? "no subjects" : null,
    students === 0 ? "no students" : null,
  ].filter(Boolean)
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open Grade ${grade}`}
      style={{ animationDelay: `${index * 60}ms` }}
      className={cn(
        "group relative isolate h-40 w-full overflow-hidden rounded-xl text-left shadow-xs ring-1 ring-black/5 transition-[transform,box-shadow] duration-200 outline-none [clip-path:inset(0_round_var(--radius-xl))] hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset",
        "animate-in duration-300 fade-in-0 fill-mode-backwards slide-in-from-bottom-2",
        palette.cover
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-1 -bottom-6 text-[6rem] leading-none font-bold tracking-tighter text-white/15 transition-transform duration-300 select-none group-hover:scale-105"
      >
        {grade}
      </span>

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <span className="flex items-center gap-1">
          {sections.map((s) => (
            <span
              key={s}
              className="flex size-5 items-center justify-center rounded-md bg-white/20 text-[11px] font-semibold text-white backdrop-blur-sm"
            >
              {s}
            </span>
          ))}
        </span>
        {gaps.length > 0 && (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
            {gaps.join(" · ")}
          </span>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3">
        <span className="text-base font-semibold text-white drop-shadow-sm">
          Grade {grade}
        </span>
        <span className="text-xs text-white/80 tabular-nums">
          {subjects} {subjects === 1 ? "subject" : "subjects"} · {students}{" "}
          {students === 1 ? "student" : "students"}
        </span>
      </div>
    </button>
  )
}

function GradeDoorSkeleton() {
  return <Skeleton className="h-40 w-full rounded-xl" aria-hidden />
}

function StatStripSkeleton() {
  return (
    <div
      aria-hidden
      className="flex divide-x divide-border rounded-xl border border-border bg-background"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex min-w-[5.5rem] flex-col items-center gap-1.5 px-4 py-3"
        >
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  )
}

/** A row in the "Needs a look" panel. */
interface AttentionItem {
  key: string
  icon: Icon
  title: string
  body: string
  onClick: () => void
}

export function AdminHome({ firstName }: { firstName: string }) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const subjects = useAppSelector((s) => s.subjects.subjects)
  const [data, setData] = useState<SchoolData | null>(null)

  useEffect(() => {
    dispatch(fetchSubjects())
    let cancelled = false
    Promise.allSettled([
      apiClient.get<GroupedClasses>("/api/classes/grouped"),
      apiClient.get<{ teachers: TeacherLite[] }>("/api/auth/teachers/overview"),
    ]).then(([g, t]) => {
      if (cancelled) return
      setData({
        grouped: g.status === "fulfilled" ? g.value : { classes: {} },
        teachers: t.status === "fulfilled" ? (t.value.teachers ?? []) : [],
      })
    })
    return () => {
      cancelled = true
    }
  }, [dispatch])

  const isLoading = data === null

  const view = useMemo(() => {
    const grouped = data?.grouped ?? { classes: {} }
    const grades = Object.keys(grouped.classes).sort(
      (a, b) => Number(a) - Number(b)
    )
    const sections = grades.reduce(
      (n, g) => n + (grouped.classes[g]?.length ?? 0),
      0
    )
    const students = grades.reduce(
      (n, g) => n + (grouped.studentCounts?.[g] ?? 0),
      0
    )
    const teachers = data?.teachers ?? []
    const invited = teachers.filter((t) => t.status === "invited")
    const active = teachers.filter((t) => t.status === "active")
    const unassigned = active.filter((t) => t.total_assignments === 0)
    const gradesWithoutSubjects = grades.filter(
      (g) => (grouped.gradeSubjects?.[g]?.length ?? 0) === 0
    )
    const gradesWithoutStudents = grades.filter(
      (g) => (grouped.studentCounts?.[g] ?? 0) === 0
    )
    // Who carries the most — the staffing panel leads with them.
    const byLoad = [...active].sort(
      (a, b) => b.total_assignments - a.total_assignments
    )
    return {
      grades,
      grouped,
      sections,
      students,
      teachers,
      invited,
      active,
      unassigned,
      gradesWithoutSubjects,
      gradesWithoutStudents,
      byLoad,
    }
  }, [data])

  const checklist = [
    {
      label: "Add subjects",
      done: subjects.length > 0,
      hint:
        subjects.length > 0
          ? `${subjects.length} ${subjects.length === 1 ? "subject" : "subjects"}`
          : "Nothing added yet",
      onClick: () => navigate("/classes"),
    },
    {
      label: "Create classes",
      done: view.grades.length > 0,
      hint:
        view.grades.length > 0
          ? `${view.grades.length} grades · ${view.sections} sections`
          : "No grades yet",
      onClick: () => navigate("/classes"),
    },
    {
      label: "Invite teachers",
      done: view.active.length > 0,
      hint:
        view.teachers.length > 0
          ? `${view.active.length} active · ${view.invited.length} invited`
          : "No teachers yet",
      onClick: () => navigate("/teachers"),
    },
    {
      label: "Enrol students",
      done: view.students > 0,
      hint: view.students > 0 ? `${view.students} enrolled` : "No students yet",
      onClick: () => navigate("/students"),
    },
  ]
  const doneCount = checklist.filter((c) => c.done).length
  const setupDone = doneCount === checklist.length

  const attention: AttentionItem[] = []
  for (const t of view.invited.slice(0, 3)) {
    attention.push({
      key: `inv-${t.id}`,
      icon: EnvelopeSimpleIcon,
      title: `${t.full_name} hasn't accepted the invite`,
      body: "Waiting for them to set a password",
      onClick: () => navigate("/teachers"),
    })
  }
  if (view.invited.length > 3) {
    attention.push({
      key: "inv-more",
      icon: EnvelopeSimpleIcon,
      title: `${view.invited.length - 3} more invites pending`,
      body: "Open Teachers to see who is still waiting",
      onClick: () => navigate("/teachers"),
    })
  }
  for (const g of view.gradesWithoutSubjects) {
    attention.push({
      key: `subj-${g}`,
      icon: BooksIcon,
      title: `Grade ${g} has no subjects`,
      body: "Teachers can't be assigned until subjects exist",
      onClick: () => navigate(`/classes/${g}/overview`),
    })
  }
  for (const g of view.gradesWithoutStudents) {
    attention.push({
      key: `stud-${g}`,
      icon: GraduationCapIcon,
      title: `Grade ${g} has no students`,
      body: "Enrol students so papers can be graded",
      onClick: () => navigate("/students"),
    })
  }
  for (const t of view.unassigned.slice(0, 3)) {
    attention.push({
      key: `free-${t.id}`,
      icon: ChalkboardTeacherIcon,
      title: `${t.full_name} has no classes yet`,
      body: "Assign a class and subject so they can start",
      onClick: () => navigate("/teachers"),
    })
  }

  const summary = isLoading ? (
    <Skeleton className="h-4 w-72" />
  ) : view.grades.length === 0 ? (
    "Your school is a blank page. Start with subjects and classes."
  ) : attention.length > 0 ? (
    <>
      <span className="font-medium text-foreground">{attention.length}</span>{" "}
      {attention.length === 1 ? "thing needs" : "things need"} a look before the
      school runs on its own.
    </>
  ) : (
    "Every grade is staffed and stocked. Nothing needs you right now."
  )

  return (
    <>
      <HomeGreeting
        name={firstName}
        summary={summary}
        aside={
          isLoading || view.grades.length > 0 ? (
            <LoadingSwap loading={isLoading} skeleton={<StatStripSkeleton />}>
              <StatStrip
                items={[
                  { value: view.grades.length, label: "Grades" },
                  {
                    value: view.teachers.length,
                    label: "Teachers",
                    accent: view.invited.length > 0,
                  },
                  { value: view.students, label: "Students" },
                  { value: subjects.length, label: "Subjects" },
                ]}
              />
            </LoadingSwap>
          ) : null
        }
      />

      {/* Setup — only while there is still setup to do */}
      {!isLoading && !setupDone && (
        <HomePanel icon={ListChecksIcon} title="Set up your school">
          <div className="flex items-center gap-3 px-4 pt-4">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${(doneCount / checklist.length) * 100}%` }}
              />
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {doneCount} of {checklist.length}
            </span>
          </div>
          <div className="grid gap-1 p-2 pt-3 sm:grid-cols-2">
            {checklist.map((step) => (
              <button
                key={step.label}
                type="button"
                onClick={step.onClick}
                className="group flex items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/60"
              >
                {step.done ? (
                  <CheckCircleIcon
                    weight="fill"
                    className="size-5 shrink-0 text-primary"
                  />
                ) : (
                  <CircleIcon className="size-5 shrink-0 text-muted-foreground/50" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      "text-sm",
                      step.done
                        ? "text-muted-foreground line-through decoration-border"
                        : "font-medium text-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {step.hint}
                  </span>
                </span>
                {!step.done && (
                  <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </button>
            ))}
          </div>
        </HomePanel>
      )}

      {/* ── Grades: a corridor of doors ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ChalkboardIcon className="size-4 text-muted-foreground" />
          <span className="flex items-baseline gap-1.5">
            <h2 className="text-sm font-medium text-foreground">Grades</h2>
            {!isLoading && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {view.grades.length}
              </span>
            )}
          </span>
          {!isLoading && view.grades.length > 0 && (
            <button
              type="button"
              onClick={() => navigate("/classes")}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              All classes
              <ArrowRightIcon className="size-3" />
            </button>
          )}
        </div>

        <LoadingSwap
          loading={isLoading}
          skeleton={
            <div aria-hidden className={DOOR_GRID}>
              {Array.from({ length: 4 }).map((_, i) => (
                <GradeDoorSkeleton key={i} />
              ))}
            </div>
          }
        >
          {view.grades.length === 0 ? (
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-border px-5 py-6">
              <Sticker name="idea" size={56} />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">
                  No grades yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Add your first class room and it shows up here as a door.
                </p>
              </div>
            </div>
          ) : (
            <div className={DOOR_GRID}>
              {view.grades.map((g, i) => (
                <GradeDoorCard
                  key={g}
                  grade={g}
                  sections={(view.grouped.classes[g] ?? [])
                    .map((c) => c.section)
                    .sort()}
                  subjects={view.grouped.gradeSubjects?.[g]?.length ?? 0}
                  students={view.grouped.studentCounts?.[g] ?? 0}
                  index={i}
                  onOpen={() => navigate(`/classes/${g}/overview`)}
                />
              ))}
            </div>
          )}
        </LoadingSwap>
      </section>

      {/* ── Three equal panels ── */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        {/* Attention */}
        <HomePanel
          icon={WarningCircleIcon}
          title="Needs a look"
          count={isLoading ? undefined : attention.length}
        >
          <LoadingSwap
            loading={isLoading}
            skeleton={
              <div aria-hidden className="divide-y divide-border">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="size-8 shrink-0 rounded-lg" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            }
          >
            {attention.length === 0 ? (
              <PanelEmpty
                sticker={<Sticker name="star" size={64} />}
                title="Everything is in order"
                body="Every teacher is in, every grade has subjects and students."
              />
            ) : (
              <div className="divide-y divide-border">
                {attention.slice(0, 5).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.onClick}
                    className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                      <item.icon className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {item.title}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {item.body}
                      </span>
                    </span>
                    <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}
          </LoadingSwap>
        </HomePanel>

        {/* Staffing */}
        <HomePanel
          icon={UsersIcon}
          title="Staffing"
          count={isLoading ? undefined : view.teachers.length}
        >
          <LoadingSwap
            loading={isLoading}
            skeleton={
              <div aria-hidden className="divide-y divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            }
          >
            {view.teachers.length === 0 ? (
              <PanelEmpty
                sticker={<Sticker name="wave" size={64} />}
                title="No teachers yet"
                body="Invite your first teacher and they'll appear here with their classes."
              />
            ) : (
              <>
                <div className="flex items-center gap-4 border-b border-border px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                  <span>
                    <span className="font-medium text-foreground">
                      {view.active.length}
                    </span>{" "}
                    active
                  </span>
                  {view.invited.length > 0 && (
                    <span>
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {view.invited.length}
                      </span>{" "}
                      invited
                    </span>
                  )}
                  {view.unassigned.length > 0 && (
                    <span>
                      <span className="font-medium text-foreground">
                        {view.unassigned.length}
                      </span>{" "}
                      without classes
                    </span>
                  )}
                </div>
                <div className="divide-y divide-border">
                  {view.byLoad.slice(0, 5).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => navigate("/teachers")}
                      className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
                    >
                      <Avatar className="size-8">
                        {t.profile_url ? (
                          <AvatarImage src={t.profile_url} alt={t.full_name} />
                        ) : null}
                        <AvatarFallback className="text-[10px]">
                          {getInitials(t.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">
                          {t.full_name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {t.subjects && t.subjects.length > 0
                            ? t.subjects.map((s) => s.subject_name).join(", ")
                            : (t.designation ?? "Teacher")}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {t.total_classes}{" "}
                        {t.total_classes === 1 ? "class" : "classes"}
                      </span>
                    </button>
                  ))}
                </div>
                <PanelFooter
                  label={`All ${view.teachers.length} teachers`}
                  onClick={() => navigate("/teachers")}
                />
              </>
            )}
          </LoadingSwap>
        </HomePanel>

        <AskHintPanel />
      </div>

      {/* ── Library shortcuts ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            icon: BookOpenTextIcon,
            label: "Knowledge Library",
            body: "Textbooks and notes teachers draw from",
            to: "/library",
          },
          {
            icon: BooksIcon,
            label: "Shared Library",
            body: "Question banks shared across classes",
            to: "/library/bank",
          },
        ].map((item) => (
          <button
            key={item.to}
            type="button"
            onClick={() => navigate(item.to)}
            className="group flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar ring-1 ring-border/60">
              <item.icon className="size-4 text-muted-foreground" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium text-foreground">
                {item.label}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {item.body}
              </span>
            </span>
            <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </>
  )
}
