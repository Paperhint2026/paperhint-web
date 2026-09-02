import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowRightIcon,
  ArrowsSplitIcon,
  CaretRightIcon,
  BooksIcon,
  ChalkboardIcon,
  ChalkboardTeacherIcon,
  MagnifyingGlassIcon,
  BookOpenIcon,
  UsersIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react"

import { useIsMobile } from "@/hooks/use-mobile"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { tameCaps } from "@/lib/format"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Sticker } from "@/components/shared/sticker"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { coverFor } from "@/modules/classes/lib/grade-palette"
import { StudentDetailDrawer } from "@/modules/students/components/student-detail-drawer"
import { TeacherDetailDrawer } from "@/modules/teachers/components/teacher-detail-drawer"

interface Teacher {
  id: string
  full_name: string
  email: string
  designation?: string
  profile_url?: string
  subjects?: Subject[]
}

interface Subject {
  id: string
  subject_name: string
  teachers?: Teacher[]
  subject_type?: "core" | "elective"
  elective_group_id?: string | null
  elective_group_name?: string | null
}

interface ElectiveGroupData {
  elective_group_id: string
  elective_group_name: string
  subjects: Subject[]
}

interface Student {
  id: string
  full_name: string
  roll_number?: string
  class_id: string
}

interface Section {
  id: string
  grade: string
  section: string
  academic_year: string
  student_count: number
  students: Student[]
  subjects: (Subject & { class_subject_id: string })[]
  teachers: Teacher[]
}

interface GradeOverview {
  grade: string
  academic_year: string
  total_subjects: number
  total_sections: number
  total_students: number
  total_teachers: number
  subjects: Subject[]
  core_subjects?: Subject[]
  elective_groups?: ElectiveGroupData[]
  sections: Section[]
  teachers: Teacher[]
  created_by: string
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

const ENTER = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
}

/** Round pill heading used for every block in the sheet. */
function BlockHeading({
  icon: HeadIcon,
  label,
  count,
  trailing,
}: {
  icon: Icon
  label: string
  count?: number
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sidebar px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border/60">
        <HeadIcon className="size-3.5 text-muted-foreground" />
        {label}
        {count !== undefined && (
          <span className="text-muted-foreground tabular-nums">{count}</span>
        )}
      </span>
      <span className="h-px flex-1 bg-border" />
      {trailing}
    </div>
  )
}

function TeacherAvatars({ teachers }: { teachers: Teacher[] }) {
  if (teachers.length === 0) {
    return (
      <span className="text-[11px] text-muted-foreground italic">
        Unassigned
      </span>
    )
  }
  return (
    <AvatarGroup className="shrink-0">
      {teachers.slice(0, 3).map((t) => (
        <Avatar key={t.id} size="sm">
          {t.profile_url ? (
            <AvatarImage src={t.profile_url} alt={t.full_name} />
          ) : null}
          <AvatarFallback>{getInitials(t.full_name)}</AvatarFallback>
        </Avatar>
      ))}
    </AvatarGroup>
  )
}

/** A subject as a chip — the name, and who teaches it hanging off the end. */
function SubjectChip({ subject }: { subject: Subject }) {
  const teachers = subject.teachers ?? []
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background py-1 pr-1 pl-3 text-sm text-secondary-foreground">
          <span className="truncate">{tameCaps(subject.subject_name)}</span>
          {teachers.length > 0 ? (
            <TeacherAvatars teachers={teachers} />
          ) : (
            <span className="flex size-6 items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground">
              ?
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {teachers.length
          ? `${subject.subject_name} · ${teachers.map((t) => t.full_name).join(", ")}`
          : `${subject.subject_name} · no teacher yet`}
      </TooltipContent>
    </Tooltip>
  )
}

function SheetSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-6 pb-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-2xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-44" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-6 w-28 rounded-full" />
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-32 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-6 w-40 rounded-full" />
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

/**
 * Everything about one grade in a side sheet — its cover, counts, subjects
 * with who teaches them, and each section's roster — so the Classes grid
 * stays underneath and a teacher can flick between grades without leaving.
 */
export function GradeOverviewSheet({
  grade,
  open,
  onOpenChange,
}: {
  grade: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const reduceMotion = useReducedMotion()
  const navigate = useNavigate()

  const [data, setData] = useState<GradeOverview | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [tab, setTab] = useState<"subjects" | "students" | "teachers">(
    "subjects"
  )
  const [query, setQuery] = useState("")
  // A person opened from the roster — shown in a second sheet stacked on
  // this one, so closing it lands back on the grade rather than the grid.
  const [person, setPerson] = useState<{
    kind: "student" | "teacher"
    id: string
  } | null>(null)
  const personOpen = person !== null

  const fetchOverview = useCallback(async () => {
    if (!grade) return
    setIsLoading(true)
    setError("")
    try {
      const res = await apiClient.get<GradeOverview>(
        `/api/classes/grade/${grade}/overview`
      )
      setData(res)
      setSectionId(res.sections[0]?.id ?? null)
      setTab("subjects")
      setQuery("")
      setPerson(null)
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized")
        setError(err.message)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [grade])

  useEffect(() => {
    if (open && grade) fetchOverview()
  }, [open, grade, fetchOverview])

  const section = useMemo(
    () => data?.sections.find((s) => s.id === sectionId) ?? null,
    [data, sectionId]
  )

  const people = useMemo(() => {
    if (!section) return []
    const q = query.trim().toLowerCase()
    if (tab === "subjects") return []
    const list: (Student | Teacher)[] =
      tab === "students" ? section.students : (section.teachers ?? [])
    if (!q) return list
    return list.filter((p) => p.full_name.toLowerCase().includes(q))
  }, [section, tab, query])

  // Each section carries its own copy of an elective group, so the grade view
  // would otherwise list "Second language" once per section. Merge by name.
  const electiveGroups = useMemo(() => {
    const byName = new Map<string, ElectiveGroupData>()
    for (const g of data?.elective_groups ?? []) {
      const key = g.elective_group_name.trim().toLowerCase()
      const existing = byName.get(key)
      if (!existing) {
        byName.set(key, { ...g, subjects: [...g.subjects] })
        continue
      }
      for (const subj of g.subjects) {
        const dup = existing.subjects.find(
          (x) =>
            x.subject_name.trim().toLowerCase() ===
            subj.subject_name.trim().toLowerCase()
        )
        if (!dup) existing.subjects.push(subj)
        else if (subj.teachers?.length) {
          const ids = new Set((dup.teachers ?? []).map((t) => t.id))
          dup.teachers = [
            ...(dup.teachers ?? []),
            ...subj.teachers.filter((t) => !ids.has(t.id)),
          ]
        }
      }
    }
    return [...byName.values()]
  }, [data])

  const palette = coverFor(grade ?? "0")
  const stats = data
    ? [
        { icon: BooksIcon, value: data.total_subjects, label: "subjects" },
        {
          icon: ArrowsSplitIcon,
          value: data.total_sections,
          label: "sections",
        },
        { icon: UsersIcon, value: data.total_students, label: "students" },
        {
          icon: ChalkboardTeacherIcon,
          value: data.total_teachers,
          label: "teachers",
        },
      ]
    : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        size={isMobile ? "full" : "2xl"}
        showCloseButton={false}
        className={cn(
          "flex h-full w-full flex-col gap-0 p-0",
          personOpen &&
            "data-[side=right]:-translate-x-6 data-[side=right]:scale-[0.98] data-[side=right]:opacity-90"
        )}
      >
        {/* Toolbar */}
        <div className="flex shrink-0 items-center justify-end gap-1 px-3 pt-3">
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

        <LoadingSwap
          loading={isLoading}
          skeleton={<SheetSkeleton />}
          className="min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
        >
          {error && !data && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
              <Sticker name="worried" size={80} />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-secondary-foreground">
                  Couldn't load this grade
                </p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchOverview}>
                Try again
              </Button>
            </div>
          )}

          {data && (
            <div className="no-scrollbar flex-1 overflow-y-auto">
              <motion.div
                initial="hidden"
                animate="show"
                transition={{ staggerChildren: reduceMotion ? 0 : 0.05 }}
                className="flex flex-col gap-8 pb-10"
              >
                {/* Hero — the grade's cover, name and year */}
                <motion.div variants={ENTER}>
                  <SheetHeader className="relative gap-0 overflow-hidden px-6 pt-2 pb-0 text-left">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -top-8 right-2 text-[8rem] leading-none font-bold tracking-tighter text-foreground/[0.035] select-none"
                    >
                      {data.grade}
                    </span>
                    <div className="relative flex items-center gap-4">
                      <span
                        className={cn(
                          "flex size-16 shrink-0 items-center justify-center rounded-2xl text-3xl font-semibold text-white shadow-xs",
                          palette.cover
                        )}
                      >
                        {data.grade}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <SheetTitle className="text-2xl font-semibold tracking-tight text-foreground">
                          Grade {data.grade}
                        </SheetTitle>
                        <SheetDescription className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          {data.academic_year}
                          <span className="text-border">·</span>
                          <span className="flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-primary" />
                            Current batch
                          </span>
                        </SheetDescription>
                      </div>
                    </div>
                  </SheetHeader>
                </motion.div>

                {/* Counts on a hairline */}
                <motion.div
                  variants={ENTER}
                  className="mx-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-3.5"
                >
                  {stats.map((s) => (
                    <span
                      key={s.label}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <s.icon className="size-3.5" />
                      <span className="font-semibold text-foreground tabular-nums">
                        {s.value}
                      </span>
                      {s.label}
                    </span>
                  ))}
                  {data.created_by && (
                    <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Avatar className="size-5">
                        <AvatarFallback className="text-[9px]">
                          {getInitials(data.created_by)}
                        </AvatarFallback>
                      </Avatar>
                      Set up by {data.created_by}
                    </span>
                  )}
                </motion.div>

                {/* Sections — doors along a corridor; pick one and the tabs
                  below show who is inside */}
                <motion.div
                  variants={ENTER}
                  className="flex flex-col gap-4 px-6"
                >
                  <BlockHeading
                    icon={ChalkboardIcon}
                    label="Sections"
                    count={data.sections.length}
                  />
                  <div className="flex flex-wrap gap-2">
                    {data.sections.map((s) => {
                      const on = s.id === sectionId
                      return (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            setSectionId(s.id)
                            setQuery("")
                          }}
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl border py-1.5 pr-4 pl-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            on
                              ? "border-foreground/30 bg-sidebar"
                              : "border-border bg-background hover:bg-muted/50"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-8 items-center justify-center rounded-lg text-sm font-semibold text-foreground ring-1 ring-border/60",
                              on ? "bg-background shadow-xs" : "bg-sidebar"
                            )}
                          >
                            {s.section}
                          </span>
                          <span className="flex flex-col leading-tight">
                            <span
                              className={cn(
                                "text-sm",
                                on
                                  ? "font-medium text-foreground"
                                  : "text-secondary-foreground"
                              )}
                            >
                              Section {s.section}
                            </span>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {s.student_count}{" "}
                              {s.student_count === 1 ? "student" : "students"}
                            </span>
                          </span>
                          {(s.teachers ?? []).length > 0 && (
                            <span className="ml-2">
                              <TeacherAvatars teachers={s.teachers ?? []} />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>

                {/* Tabs — what is taught, and who is in the picked section */}
                <motion.div
                  variants={ENTER}
                  className="flex flex-col gap-5 px-6"
                >
                  <div className="flex items-center gap-1 border-b border-border">
                    {(
                      [
                        {
                          key: "subjects",
                          label: "Subjects",
                          icon: BookOpenIcon,
                          count: data.total_subjects,
                        },
                        {
                          key: "students",
                          label: "Students",
                          icon: UsersIcon,
                          count: section?.students.length ?? 0,
                        },
                        {
                          key: "teachers",
                          label: "Teachers",
                          icon: ChalkboardTeacherIcon,
                          count: (section?.teachers ?? []).length,
                        },
                      ] as const
                    ).map((t) => {
                      const on = tab === t.key
                      return (
                        <button
                          key={t.key}
                          type="button"
                          role="tab"
                          aria-selected={on}
                          onClick={() => {
                            setTab(t.key)
                            setQuery("")
                          }}
                          className={cn(
                            "relative flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors outline-none focus-visible:text-foreground",
                            on
                              ? "font-medium text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <t.icon className="size-4" />
                          {t.label}
                          <span
                            className={cn(
                              "text-xs tabular-nums",
                              on
                                ? "text-foreground/70"
                                : "text-muted-foreground"
                            )}
                          >
                            {t.count}
                          </span>
                          {on && (
                            <motion.span
                              layoutId="grade-sheet-tab"
                              transition={
                                reduceMotion
                                  ? { duration: 0 }
                                  : {
                                      type: "spring",
                                      stiffness: 480,
                                      damping: 40,
                                      mass: 0.8,
                                    }
                              }
                              className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-foreground"
                            />
                          )}
                        </button>
                      )
                    })}
                    {section && tab !== "subjects" && (
                      <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
                        Section {section.section}
                      </span>
                    )}
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={`${tab}-${section?.id ?? "none"}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: reduceMotion ? 0 : 0.18 }}
                      className="flex flex-col gap-5"
                    >
                      {tab === "subjects" ? (
                        <>
                          <div className="flex flex-col gap-3">
                            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                              Core
                            </p>
                            <div className="flex flex-wrap gap-2.5">
                              {(data.core_subjects ?? data.subjects).map(
                                (s) => (
                                  <SubjectChip key={s.id} subject={s} />
                                )
                              )}
                            </div>
                          </div>
                          {electiveGroups.map((group) => (
                            <div
                              key={group.elective_group_id}
                              className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4"
                            >
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <ArrowsSplitIcon className="size-3.5" />
                                <span className="font-medium tracking-wide uppercase">
                                  {group.elective_group_name}
                                </span>
                                <span className="ml-auto">
                                  students choose one
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2.5">
                                {group.subjects.map((s) => (
                                  <SubjectChip key={s.id} subject={s} />
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : !section ? (
                        <div className="flex flex-col items-center gap-3 py-10 text-center">
                          <Sticker name="sleep" size={100} />
                          <p className="text-sm text-muted-foreground">
                            No sections in this grade yet.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              placeholder={`Search ${tab} in Section ${section.section}…`}
                              className="h-9 pl-9"
                              aria-label={`Search ${tab}`}
                            />
                          </div>

                          {people.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-10 text-center">
                              <Sticker
                                name={query ? "lost" : "friends"}
                                size={query ? 80 : 120}
                              />
                              <p className="text-sm text-muted-foreground">
                                {query
                                  ? `Nobody called "${query.trim()}" here.`
                                  : `No ${tab} in this section yet.`}
                              </p>
                            </div>
                          ) : tab === "students" ? (
                            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                              {(people as Student[]).map((st) => (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() =>
                                    setPerson({ kind: "student", id: st.id })
                                  }
                                  className="group flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <span className="w-6 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                                    {st.roll_number ?? "—"}
                                  </span>
                                  <Avatar size="sm">
                                    <AvatarFallback>
                                      {getInitials(st.full_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="min-w-0 flex-1 truncate text-sm text-secondary-foreground">
                                    {st.full_name}
                                  </span>
                                  <CaretRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {(people as Teacher[]).map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() =>
                                    setPerson({ kind: "teacher", id: t.id })
                                  }
                                  className="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <Avatar className="size-9">
                                    {t.profile_url ? (
                                      <AvatarImage
                                        src={t.profile_url}
                                        alt={t.full_name}
                                      />
                                    ) : null}
                                    <AvatarFallback className="text-[10px]">
                                      {getInitials(t.full_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="truncate text-sm font-medium text-foreground">
                                      {t.full_name}
                                    </span>
                                    <span className="truncate text-[11px] text-muted-foreground">
                                      {t.designation ?? "Teacher"}
                                    </span>
                                  </div>
                                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                                    {(t.subjects ?? []).slice(0, 3).map((s) => (
                                      <span
                                        key={s.id}
                                        className="rounded-full bg-sidebar px-2 py-0.5 text-[11px] text-secondary-foreground ring-1 ring-border/60"
                                      >
                                        {tameCaps(s.subject_name)}
                                      </span>
                                    ))}
                                  </div>
                                  <CaretRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            </div>
          )}

          {/* Footer — where to go to change things */}
          {data && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-6 py-3">
              <span className="text-xs text-muted-foreground">
                Enrolment and staffing live on their own pages.
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    navigate("/students")
                  }}
                >
                  Students
                  <ArrowRightIcon className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    navigate("/teachers")
                  }}
                >
                  Teachers
                  <ArrowRightIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </LoadingSwap>
      </SheetContent>

      {/* Stacked person sheets — the grade sheet eases back while one is open */}
      <StudentDetailDrawer
        studentId={person?.kind === "student" ? person.id : null}
        open={person?.kind === "student"}
        onOpenChange={(o) => !o && setPerson(null)}
        canManage={false}
      />
      <TeacherDetailDrawer
        teacherId={person?.kind === "teacher" ? person.id : null}
        open={person?.kind === "teacher"}
        onOpenChange={(o) => !o && setPerson(null)}
        canManage={false}
      />
    </Sheet>
  )
}
