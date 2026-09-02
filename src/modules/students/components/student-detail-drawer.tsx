import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { differenceInYears } from "date-fns"
import dayjs from "dayjs"
import {
  CakeIcon,
  CalendarBlankIcon,
  ChalkboardIcon,
  CircleNotchIcon,
  DotsThreeIcon,
  DropIcon,
  GenderIntersexIcon,
  HashIcon,
  IdentificationBadgeIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  TrashIcon,
  UsersIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react"

import { useIsMobile } from "@/hooks/use-mobile"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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

interface StudentDetail {
  id: string
  class_id: string
  full_name: string
  date_of_birth?: string | null
  gender?: string | null
  blood_group?: string | null
  admission_number?: string | null
  academic_year?: string | null
  grade?: string | null
  section?: string | null
  roll_number?: number | null
  register_number?: string | null
  street?: string | null
  city?: string | null
  contact_number?: string | null
  emergency_contact_name?: string | null
  emergency_contact_relationship?: string | null
  emergency_contact_phone?: string | null
  created_at?: string
  classes?: {
    id: string
    grade: number
    section: string
    academic_year?: string
  } | null
}

interface StudentDetailDrawerProps {
  studentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (student: StudentDetail) => void
  onDeleted?: (studentId: string) => void
  canManage?: boolean
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

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return null
  const d = dayjs(dateStr)
  return d.isValid() ? d.format("D MMM YYYY") : dateStr
}

/** Icon + small caps label over a value — the same field the teacher drawer
 *  and the cards use, so every profile in the app reads alike. */
function Field({
  icon: FieldIcon,
  label,
  value,
  href,
  className,
}: {
  icon: Icon
  label: string
  value?: string | number | null
  href?: string
  className?: string
}) {
  const text = value == null || value === "" ? null : String(value)
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        <FieldIcon className="size-3.5" />
        {label}
      </span>
      {text ? (
        href ? (
          <a
            href={href}
            className="truncate text-sm text-foreground underline-offset-4 hover:underline"
          >
            {text}
          </a>
        ) : (
          <span className="truncate text-sm text-foreground">{text}</span>
        )
      ) : (
        <span className="truncate text-sm text-muted-foreground">Not set</span>
      )}
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-secondary-foreground">{children}</p>
  )
}

function QuickAction({
  icon: ActionIcon,
  label,
  href,
  disabled,
}: {
  icon: Icon
  label: string
  href?: string
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
          <button type="button" aria-label={label} disabled className={cls}>
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
        <Skeleton className="size-20 rounded-2xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

const ENTER = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

export function StudentDetailDrawer({
  studentId,
  open,
  onOpenChange,
  onEdit,
  onDeleted,
  canManage = true,
}: StudentDetailDrawerProps) {
  const isMobile = useIsMobile()
  const reduceMotion = useReducedMotion()
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchStudent = useCallback(async () => {
    if (!studentId) return
    setIsLoading(true)
    setError("")
    setStudent(null)
    try {
      const res = await apiClient.get<{ student: StudentDetail }>(
        `/api/students/${studentId}`
      )
      setStudent(res.student)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    if (open && studentId) fetchStudent()
  }, [open, studentId, fetchStudent])

  const cls = student?.classes

  const age = useMemo(() => {
    if (!student?.date_of_birth) return null
    const d = new Date(student.date_of_birth + "T00:00:00")
    if (isNaN(d.getTime())) return null
    return differenceInYears(new Date(), d)
  }, [student?.date_of_birth])

  const handleDelete = async () => {
    if (!student) return
    setIsDeleting(true)
    try {
      await apiClient.delete(`/api/students/${student.id}`)
      setConfirmDeleteOpen(false)
      onOpenChange(false)
      onDeleted?.(student.id)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const stagger = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }

  const address = [student?.street, student?.city].filter(Boolean).join(", ")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        size={isMobile ? "full" : "xl"}
        showCloseButton={false}
        className="flex h-full w-full flex-col gap-0 p-0"
      >
        {/* Toolbar */}
        <div className="flex shrink-0 items-center justify-end gap-1 px-3 pt-3">
          {student && canManage && (
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
                <DropdownMenuItem onSelect={() => onEdit?.(student)}>
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
          {error && !student && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
              <Sticker name="worried" size={80} />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-secondary-foreground">
                  Couldn't load this student
                </p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchStudent}>
                Try again
              </Button>
            </div>
          )}

          {student && (
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
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -top-6 right-2 text-[7rem] leading-none font-bold tracking-tighter text-foreground/[0.035] select-none"
                      >
                        {student.roll_number ?? getInitials(student.full_name)}
                      </span>

                      <div className="relative flex items-start gap-5">
                        <Avatar className="size-20 rounded-2xl shadow-xs after:rounded-2xl">
                          <AvatarFallback className="rounded-2xl text-2xl">
                            {getInitials(student.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
                          <SheetTitle className="truncate text-2xl font-semibold tracking-tight text-foreground">
                            {student.full_name}
                          </SheetTitle>
                          <SheetDescription className="truncate text-sm text-muted-foreground">
                            {cls
                              ? `Grade ${cls.grade} · Section ${cls.section}`
                              : "No class"}
                            {cls?.academic_year && (
                              <>
                                <span className="mx-1.5 text-border">·</span>
                                {cls.academic_year}
                              </>
                            )}
                          </SheetDescription>

                          <div className="mt-2 flex items-center gap-1.5">
                            <QuickAction
                              icon={PhoneIcon}
                              label={
                                student.contact_number
                                  ? "Call student"
                                  : "No contact number"
                              }
                              href={
                                student.contact_number
                                  ? `tel:${student.contact_number}`
                                  : undefined
                              }
                              disabled={!student.contact_number}
                            />
                            <QuickAction
                              icon={UsersIcon}
                              label={
                                student.emergency_contact_phone
                                  ? `Call ${student.emergency_contact_name ?? "emergency contact"}`
                                  : "No emergency contact"
                              }
                              href={
                                student.emergency_contact_phone
                                  ? `tel:${student.emergency_contact_phone}`
                                  : undefined
                              }
                              disabled={!student.emergency_contact_phone}
                            />
                          </div>
                        </div>
                      </div>
                    </SheetHeader>
                  </motion.div>

                  {/* At a glance */}
                  <motion.div
                    variants={ENTER}
                    transition={stagger}
                    className="mx-6 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-3"
                  >
                    {[
                      {
                        icon: HashIcon,
                        value: student.roll_number ?? "—",
                        label: "Roll no.",
                      },
                      {
                        icon: CakeIcon,
                        value: age ?? "—",
                        label: age === 1 ? "year old" : "years old",
                      },
                      {
                        icon: DropIcon,
                        value: student.blood_group ?? "—",
                        label: "Blood group",
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

                  {/* Personal */}
                  <motion.div
                    variants={ENTER}
                    transition={stagger}
                    className="flex flex-col gap-3 px-6 pt-5"
                  >
                    <SectionHeading>Personal</SectionHeading>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-dashed border-border p-4">
                      <Field
                        icon={CakeIcon}
                        label="Date of birth"
                        value={formatDate(student.date_of_birth)}
                      />
                      <Field
                        icon={GenderIntersexIcon}
                        label="Gender"
                        value={student.gender}
                      />
                      <Field
                        icon={DropIcon}
                        label="Blood group"
                        value={student.blood_group}
                      />
                      <Field
                        icon={PhoneIcon}
                        label="Phone"
                        value={student.contact_number}
                        href={
                          student.contact_number
                            ? `tel:${student.contact_number}`
                            : undefined
                        }
                      />
                      <Field
                        icon={MapPinIcon}
                        label="Address"
                        value={address || null}
                        className="col-span-2"
                      />
                    </div>
                  </motion.div>

                  {/* Academic */}
                  <motion.div
                    variants={ENTER}
                    transition={stagger}
                    className="flex flex-col gap-3 px-6 pt-5"
                  >
                    <SectionHeading>Academic</SectionHeading>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-dashed border-border p-4">
                      <Field
                        icon={ChalkboardIcon}
                        label="Class"
                        value={
                          cls
                            ? `Grade ${cls.grade} · Section ${cls.section}`
                            : null
                        }
                      />
                      <Field
                        icon={CalendarBlankIcon}
                        label="Academic year"
                        value={cls?.academic_year ?? student.academic_year}
                      />
                      <Field
                        icon={IdentificationBadgeIcon}
                        label="Admission no."
                        value={student.admission_number}
                      />
                      <Field
                        icon={HashIcon}
                        label="Register no."
                        value={student.register_number}
                      />
                    </div>
                  </motion.div>

                  {/* Emergency contact */}
                  <motion.div
                    variants={ENTER}
                    transition={stagger}
                    className="flex flex-col gap-3 px-6 py-5"
                  >
                    <SectionHeading>Emergency contact</SectionHeading>
                    {student.emergency_contact_name ||
                    student.emergency_contact_phone ? (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-dashed border-border p-4">
                        <Field
                          icon={UsersIcon}
                          label="Name"
                          value={student.emergency_contact_name}
                        />
                        <Field
                          icon={IdentificationBadgeIcon}
                          label="Relationship"
                          value={student.emergency_contact_relationship}
                        />
                        <Field
                          icon={PhoneIcon}
                          label="Phone"
                          value={student.emergency_contact_phone}
                          href={
                            student.emergency_contact_phone
                              ? `tel:${student.emergency_contact_phone}`
                              : undefined
                          }
                          className="col-span-2"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-4">
                        <Sticker name="peek" size={40} />
                        <div className="flex flex-col gap-0.5">
                          <p className="text-sm font-medium text-secondary-foreground">
                            No emergency contact yet
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {canManage
                              ? "Add one so the school can reach a guardian quickly."
                              : "None has been recorded for this student."}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              </div>

              {canManage && (
                <div className="shrink-0 border-t border-border px-6 py-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => onEdit?.(student)}
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
                    <AlertDialogTitle>Delete student?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove{" "}
                      <span className="font-medium text-foreground">
                        {student.full_name}
                      </span>{" "}
                      and their associated records. This action cannot be
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
