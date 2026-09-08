import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, useReducedMotion } from "motion/react"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"
import dayjs from "dayjs"
import {
  ArrowRightIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CalendarBlankIcon,
  ChalkboardIcon,
  CircleNotchIcon,
  CopyIcon,
  DotsThreeIcon,
  EnvelopeSimpleIcon,
  IdentificationBadgeIcon,
  PencilIcon,
  PhoneIcon,
  TrashIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Sticker } from "@/components/shared/sticker"
import { LoadingSwap } from "@/components/shared/loading-swap"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

interface ClassInfo {
  id: string
  grade: number | string
  section: string
  academic_year?: string
}

interface SubjectInfo {
  id: string
  subject_name: string
}

interface Assignment {
  class_subject_id: string
  class: ClassInfo
  subject: SubjectInfo
}

interface TeacherOverview {
  id: string
  full_name: string
  email: string
  profile_url?: string | null
  status?: string | null
  department_id?: string | null
  department_name?: string | null
  designation?: string | null
  phone_number?: string | null
  date_of_joining?: number | string | null
  total_assignments: number
  total_classes: number
  total_subjects: number
  assignments: Assignment[]
  classes: ClassInfo[]
  subjects: SubjectInfo[]
  custom_duties?: {
    label: string
    class: {
      id: string
      grade: number
      section: string
      academic_year: string
    } | null
    periods_per_week: number
  }[]
  total_custom_periods?: number
}

const STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  active: "Active",
  inactive: "Inactive",
}

const STATUS_DOT: Record<string, string> = {
  invited: "bg-amber-500",
  active: "bg-emerald-500",
  inactive: "bg-slate-400 dark:bg-slate-500",
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

function joinedLabel(joined: TeacherOverview["date_of_joining"]) {
  if (!joined) return null
  const start = dayjs(joined)
  if (!start.isValid()) return null
  const years = dayjs().diff(start, "year")
  const date = start.format("D MMM YYYY")
  if (years < 1) return date
  return `${date} · ${years} ${years === 1 ? "yr" : "yrs"}`
}

/** Icon + small caps label over a value — the same field the card back uses,
 *  so the drawer reads as the card unfolded. */
function Field({
  icon: FieldIcon,
  label,
  value,
  href,
  className,
}: {
  icon: Icon
  label: string
  value?: string | null
  href?: string
  className?: string
}) {
  const body = value ? (
    href ? (
      <a
        href={href}
        className="truncate text-sm text-foreground underline-offset-4 hover:underline"
      >
        {value}
      </a>
    ) : (
      <span className="truncate text-sm text-foreground">{value}</span>
    )
  ) : (
    <span className="truncate text-sm text-muted-foreground">Not set</span>
  )

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        <FieldIcon className="size-3.5" />
        {label}
      </span>
      {body}
    </div>
  )
}

function SectionHeading({
  children,
  hint,
}: {
  children: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-xs font-medium text-secondary-foreground">
        {children}
      </p>
      {hint != null && (
        <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </div>
  )
}

/** Round icon action with a tooltip — the hero's "reach this person" row. */
function QuickAction({
  icon: ActionIcon,
  label,
  href,
  onClick,
  disabled,
}: {
  icon: Icon
  label: string
  href?: string
  onClick?: () => void
  disabled?: boolean
}) {
  const cls = cn(
    "flex size-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors",
    disabled
      ? "cursor-not-allowed opacity-40"
      : "hover:border-foreground/20 hover:bg-muted hover:text-foreground"
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href && !disabled ? (
          <a href={href} aria-label={label} className={cls}>
            <ActionIcon className="size-4" />
          </a>
        ) : (
          <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={cls}
          >
            <ActionIcon className="size-4" />
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

function DrawerSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-6 pt-1 pb-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-24 rounded-2xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="col-span-2 h-10 w-full" />
      </div>
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

const ENTER = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

interface TeacherDetailDrawerProps {
  teacherId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (teacherId: string) => void
  onDeleted?: (teacherId: string) => void
  canManage?: boolean
}

export function TeacherDetailDrawer({
  teacherId,
  open,
  onOpenChange,
  onEdit,
  onDeleted,
  canManage = true,
}: TeacherDetailDrawerProps) {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [teacher, setTeacher] = useState<TeacherOverview | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchOverview = useCallback(async () => {
    if (!teacherId) return
    setIsLoading(true)
    setError("")
    setTeacher(null)
    try {
      const res = await apiClient.get<{ teacher: TeacherOverview }>(
        `/api/auth/teacher/${teacherId}/overview`
      )
      setTeacher(res.teacher)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [teacherId])

  useEffect(() => {
    if (open && teacherId) fetchOverview()
  }, [open, teacherId, fetchOverview])

  /* Grade → sections → subjects. A teacher who takes Tamil for 5A and 5B is
     one line here, not two near-identical cards. */
  const byGrade = useMemo(() => {
    const map = new Map<
      string,
      {
        grade: string
        year?: string
        sections: Set<string>
        subjects: Map<string, string>
      }
    >()
    for (const a of teacher?.assignments ?? []) {
      const key = String(a.class.grade)
      const entry = map.get(key) ?? {
        grade: key,
        year: a.class.academic_year,
        sections: new Set<string>(),
        subjects: new Map<string, string>(),
      }
      entry.sections.add(a.class.section)
      entry.subjects.set(a.subject.id, a.subject.subject_name)
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => Number(a.grade) - Number(b.grade))
  }, [teacher])

  const handleDelete = async () => {
    if (!teacher) return
    setIsDeleting(true)
    try {
      await apiClient.delete(`/api/auth/teacher/${teacher.id}`)
      setConfirmDeleteOpen(false)
      onOpenChange(false)
      onDeleted?.(teacher.id)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const copyEmail = async () => {
    if (!teacher) return
    try {
      await navigator.clipboard.writeText(teacher.email)
      toast.success("Email copied")
    } catch {
      toast.error("Couldn't copy the email")
    }
  }

  const joined = joinedLabel(teacher?.date_of_joining)
  const stagger = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        size={isMobile ? "full" : "xl"}
        showCloseButton={false}
        className="flex h-full w-full flex-col gap-0 p-0"
      >
        {/* Toolbar — always present so the close button never jumps */}
        <div className="flex shrink-0 items-center justify-end gap-1 px-3 pt-3">
          {teacher && canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label="More options"
                >
                  <DotsThreeIcon weight="bold" className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onSelect={() => onEdit?.(teacher.id)}>
                  <PencilIcon className="size-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => {
                    e.preventDefault()
                    setConfirmDeleteOpen(true)
                  }}
                >
                  <TrashIcon className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

        <LoadingSwap
          loading={isLoading}
          skeleton={<DrawerSkeleton />}
          className="min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
        >
          {error && !teacher && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
              <Sticker name="worried" size={80} />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-secondary-foreground">
                  Couldn't load this teacher
                </p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchOverview}>
                Try again
              </Button>
            </div>
          )}

          {teacher && (
            <>
              <div className="no-scrollbar flex-1 overflow-y-auto">
                <motion.div
                  initial="hidden"
                  animate="show"
                  transition={{ staggerChildren: reduceMotion ? 0 : 0.06 }}
                  className="flex flex-col"
                >
                  {/* Hero */}
                  <motion.div variants={ENTER} transition={stagger}>
                    <SheetHeader className="relative shrink-0 gap-0 overflow-hidden px-6 pt-1 pb-5 text-left">
                      {/* Monogram watermark — the same device as the class covers,
                        in ink instead of colour */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -top-6 right-2 text-[7rem] leading-none font-bold tracking-tighter text-foreground/[0.035] select-none"
                      >
                        {getInitials(teacher.full_name)}
                      </span>

                      <div className="relative flex items-start gap-5">
                        <Avatar className="size-24 rounded-2xl shadow-xs after:rounded-2xl">
                          {teacher.profile_url ? (
                            <AvatarImage
                              src={teacher.profile_url}
                              alt={teacher.full_name}
                              className="rounded-2xl"
                            />
                          ) : (
                            <AvatarFallback className="rounded-2xl text-2xl">
                              {getInitials(teacher.full_name)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <SheetTitle className="truncate text-2xl font-semibold tracking-tight text-foreground">
                              {teacher.full_name}
                            </SheetTitle>
                            {teacher.status && (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                                <span
                                  className={cn(
                                    "size-1.5 rounded-full",
                                    STATUS_DOT[teacher.status] ??
                                      "bg-muted-foreground"
                                  )}
                                />
                                {STATUS_LABEL[teacher.status] ?? teacher.status}
                              </span>
                            )}
                          </div>
                          <SheetDescription className="truncate text-sm text-muted-foreground">
                            {teacher.designation ?? "Teacher"}
                            {teacher.department_name && (
                              <>
                                <span className="mx-1.5 text-border">·</span>
                                {teacher.department_name}
                              </>
                            )}
                          </SheetDescription>

                          {/* Reach this person */}
                          <div className="mt-2 flex items-center gap-1.5">
                            <QuickAction
                              icon={EnvelopeSimpleIcon}
                              label="Send email"
                              href={`mailto:${teacher.email}`}
                            />
                            <QuickAction
                              icon={PhoneIcon}
                              label={
                                teacher.phone_number
                                  ? "Call"
                                  : "No phone number"
                              }
                              href={
                                teacher.phone_number
                                  ? `tel:${teacher.phone_number}`
                                  : undefined
                              }
                              disabled={!teacher.phone_number}
                            />
                            <QuickAction
                              icon={CopyIcon}
                              label="Copy email"
                              onClick={copyEmail}
                            />
                          </div>
                        </div>
                      </div>
                    </SheetHeader>
                  </motion.div>

                  {/* Counts — one hairline row */}
                  <motion.div
                    variants={ENTER}
                    transition={stagger}
                    className="mx-6 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-3"
                  >
                    {[
                      {
                        icon: ChalkboardIcon,
                        value: teacher.total_classes,
                        label:
                          teacher.total_classes === 1 ? "Class" : "Classes",
                      },
                      {
                        icon: BookOpenIcon,
                        value: teacher.total_subjects,
                        label:
                          teacher.total_subjects === 1 ? "Subject" : "Subjects",
                      },
                      {
                        icon: BriefcaseIcon,
                        value: teacher.total_assignments,
                        label:
                          teacher.total_assignments === 1
                            ? "Assignment"
                            : "Assignments",
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="flex items-center gap-1.5"
                      >
                        <stat.icon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {stat.value}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {stat.label}
                        </span>
                      </div>
                    ))}
                  </motion.div>

                  {/* Teaching — grouped by grade, each row opens that grade */}
                  <motion.div
                    variants={ENTER}
                    transition={stagger}
                    className="flex flex-col gap-3 px-6 pt-5"
                  >
                    <SectionHeading
                      hint={
                        byGrade.length > 0 ? `${byGrade.length}` : undefined
                      }
                    >
                      Classes & subjects
                    </SectionHeading>

                    {byGrade.length === 0 &&
                    (teacher.custom_duties?.length ?? 0) === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
                        <Sticker name="sleep" size={72} />
                        <div className="flex flex-col gap-0.5">
                          <p className="text-sm font-medium text-secondary-foreground">
                            Nothing on the timetable yet
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {canManage
                              ? "Edit this teacher to assign classes and subjects."
                              : "No classes or subjects have been assigned."}
                          </p>
                        </div>
                        {canManage && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit?.(teacher.id)}
                          >
                            <PencilIcon className="size-3.5" />
                            Assign classes
                          </Button>
                        )}
                      </div>
                    ) : byGrade.length === 0 ? null : (
                      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                        {byGrade.map((row) => {
                          const sections = [...row.sections].sort()
                          const subjects = [...row.subjects.values()].sort()
                          return (
                            <button
                              key={row.grade}
                              type="button"
                              onClick={() => {
                                onOpenChange(false)
                                navigate(`/classes/${row.grade}/overview`)
                              }}
                              className="group flex w-full items-start gap-3.5 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                            >
                              <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-background leading-none">
                                <span className="text-[9px] font-medium tracking-wider text-muted-foreground uppercase">
                                  Gr
                                </span>
                                <span className="text-sm font-semibold text-foreground tabular-nums">
                                  {row.grade}
                                </span>
                              </span>

                              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                                <span className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">
                                    Grade {row.grade}
                                  </span>
                                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    {sections.length === 1
                                      ? "Section"
                                      : "Sections"}
                                    {sections.map((sec) => (
                                      <span
                                        key={sec}
                                        className="flex size-5 items-center justify-center rounded-[5px] border border-border bg-background text-[11px] font-medium text-secondary-foreground"
                                      >
                                        {sec}
                                      </span>
                                    ))}
                                  </span>
                                  {row.year && (
                                    <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                                      {row.year}
                                    </span>
                                  )}
                                </span>
                                <span className="flex flex-wrap gap-1">
                                  {subjects.map((name) => (
                                    <span
                                      key={name}
                                      className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-secondary-foreground"
                                    >
                                      <BookOpenIcon className="size-3 text-muted-foreground" />
                                      {name}
                                    </span>
                                  ))}
                                </span>
                              </span>

                              <ArrowRightIcon className="mt-3 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {(teacher.custom_duties?.length ?? 0) > 0 && (
                      <>
                        <SectionHeading
                          hint={`${teacher.total_custom_periods ?? 0}/wk`}
                        >
                          Timetable duties
                        </SectionHeading>
                        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                          {teacher.custom_duties!.map((d, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 px-4 py-2.5"
                            >
                              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                                {d.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {d.class
                                  ? `Grade ${d.class.grade} - ${d.class.section}`
                                  : "—"}
                              </span>
                              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                                {d.periods_per_week}/wk
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Custom periods (PT, Art, Library…) assigned directly
                          on section timetables.
                        </p>
                      </>
                    )}
                  </motion.div>

                  {/* Details */}
                  <motion.div
                    variants={ENTER}
                    transition={stagger}
                    className="flex flex-col gap-3 px-6 py-5"
                  >
                    <SectionHeading>Details</SectionHeading>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-dashed border-border p-4">
                      <Field
                        icon={IdentificationBadgeIcon}
                        label="Designation"
                        value={teacher.designation}
                      />
                      <Field
                        icon={BriefcaseIcon}
                        label="Department"
                        value={teacher.department_name}
                      />
                      <Field
                        icon={EnvelopeSimpleIcon}
                        label="Email"
                        value={teacher.email}
                        href={`mailto:${teacher.email}`}
                        className="col-span-2"
                      />
                      <Field
                        icon={PhoneIcon}
                        label="Phone"
                        value={teacher.phone_number}
                        href={
                          teacher.phone_number
                            ? `tel:${teacher.phone_number}`
                            : undefined
                        }
                      />
                      <Field
                        icon={CalendarBlankIcon}
                        label="Joined"
                        value={joined}
                      />
                    </div>
                  </motion.div>
                </motion.div>
              </div>

              {canManage && (
                <div className="shrink-0 border-t border-border px-6 py-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => onEdit?.(teacher.id)}
                  >
                    <PencilIcon className="size-3.5" />
                    Edit details
                  </Button>
                </div>
              )}

              <AlertDialog
                open={confirmDeleteOpen}
                onOpenChange={setConfirmDeleteOpen}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete teacher?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove{" "}
                      <span className="font-medium text-foreground">
                        {teacher.full_name}
                      </span>{" "}
                      and all of their assignments. This action cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={(e) => {
                        e.preventDefault()
                        handleDelete()
                      }}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <CircleNotchIcon className="size-3.5 animate-spin" />
                          Deleting…
                        </>
                      ) : (
                        <>
                          <TrashIcon className="size-3.5" />
                          Delete
                        </>
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </LoadingSwap>
      </SheetContent>
    </Sheet>
  )
}
