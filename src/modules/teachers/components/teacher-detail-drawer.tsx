import { useCallback, useEffect, useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import dayjs from "dayjs"
import {
  BookOpenIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  GraduationCapIcon,
  Loader2Icon,
  MailIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { apiClient } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Sheet,
  SheetClose,
  SheetContent,
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
}

const STATUS_CLASSES: Record<string, string> = {
  invited: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  active: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  inactive: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
}

const STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  active: "Active",
  inactive: "Inactive",
}

const AVATAR_COLORS = [
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "bg-pink-500/15 text-pink-700 dark:text-pink-300",
]

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function getAvatarColor(name: string) {
  const sum = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        {label}
      </span>
      <span className="text-right text-sm text-secondary-foreground">
        {value || <span className="text-muted-foreground/50">—</span>}
      </span>
    </div>
  )
}

function SectionTitle({
  children,
  count,
}: {
  children: React.ReactNode
  count?: number
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </p>
      {count != null && (
        <Badge variant="outline" className="rounded-full text-[10px] font-normal">
          {count}
        </Badge>
      )}
    </div>
  )
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
        `/api/auth/teacher/${teacherId}/overview`,
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

  const assignmentsByClass =
    teacher?.assignments.reduce<
      Record<string, { classInfo: ClassInfo; subjects: SubjectInfo[] }>
    >((acc, a) => {
      const key = a.class.id
      if (!acc[key]) acc[key] = { classInfo: a.class, subjects: [] }
      acc[key].subjects.push(a.subject)
      return acc
    }, {}) ?? {}

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        size={isMobile ? "full" : "xl"}
        showCloseButton={false}
        className="flex h-full w-full flex-col gap-0 p-0"
      >
        {isLoading && (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        )}

        {error && !isLoading && !teacher && (
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {teacher && !isLoading && (
          <>
            {/* Header with gradient cover */}
            <SheetHeader className="relative shrink-0 gap-0 border-b border-border p-0">
              <div className="relative h-24 w-full bg-gradient-to-br from-primary/15 via-primary/5 to-background">
                <div className="absolute right-3 top-3 flex items-center gap-1">
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-full bg-background/60 backdrop-blur hover:bg-background"
                          aria-label="More options"
                        >
                          <MoreHorizontalIcon className="size-4" />
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
                          <Trash2Icon className="size-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full bg-background/60 backdrop-blur hover:bg-background"
                      aria-label="Close"
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </SheetClose>
                </div>
              </div>

              {/* Identity block — avatar overlaps cover */}
              <div className="-mt-10 flex flex-col gap-3 px-5 pb-5">
                <div
                  className={`flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border text-xl font-semibold ${getAvatarColor(teacher.full_name)}`}
                >
                  {teacher.profile_url ? (
                    <img
                      src={teacher.profile_url}
                      alt={teacher.full_name}
                      className="size-full object-cover"
                    />
                  ) : (
                    getInitials(teacher.full_name)
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <SheetTitle className="truncate text-lg font-semibold text-secondary-foreground">
                      {teacher.full_name}
                    </SheetTitle>
                    {teacher.status && (
                      <Badge
                        className={`rounded-full border text-[10px] font-medium ${
                          STATUS_CLASSES[teacher.status] ??
                          "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {STATUS_LABEL[teacher.status] ?? teacher.status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {teacher.designation && (
                      <Badge
                        variant="secondary"
                        className="rounded-full text-xs font-normal"
                      >
                        <BriefcaseIcon className="size-3" />
                        {teacher.designation}
                      </Badge>
                    )}
                    {teacher.department_name && (
                      <Badge
                        variant="outline"
                        className="rounded-full text-xs font-normal"
                      >
                        <BuildingIcon className="size-3" />
                        {teacher.department_name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* Quick stats */}
            <div className="grid shrink-0 grid-cols-3 divide-x divide-border border-b border-border bg-muted/30">
              <div className="flex flex-col items-center gap-1 py-3">
                <span className="text-lg font-semibold text-secondary-foreground">
                  {teacher.total_classes}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <GraduationCapIcon className="size-3" />
                  Classes
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 py-3">
                <span className="text-lg font-semibold text-secondary-foreground">
                  {teacher.total_subjects}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <BookOpenIcon className="size-3" />
                  Subjects
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 py-3">
                <span className="text-lg font-semibold text-secondary-foreground">
                  {teacher.total_assignments}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <BriefcaseIcon className="size-3" />
                  Assignments
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="no-scrollbar flex-1 overflow-y-auto">
              {/* Contact */}
              <div className="flex flex-col gap-3 p-5">
                <SectionTitle>Contact</SectionTitle>
                <div className="divide-y divide-border rounded-lg border border-border bg-card p-4">
                  <InfoRow icon={MailIcon} label="Email" value={teacher.email} />
                  <InfoRow
                    icon={PhoneIcon}
                    label="Phone"
                    value={teacher.phone_number}
                  />
                  <InfoRow
                    icon={CalendarIcon}
                    label="Joined"
                    value={
                      teacher.date_of_joining
                        ? dayjs(teacher.date_of_joining).format("MMM DD, YYYY")
                        : null
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* Assignments grouped by class */}
              <div className="flex flex-col gap-3 p-5">
                <SectionTitle count={Object.keys(assignmentsByClass).length}>
                  Assignments
                </SectionTitle>

                {Object.keys(assignmentsByClass).length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-10">
                    <BriefcaseIcon className="size-5 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      No assignments yet
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {Object.values(assignmentsByClass).map(
                      ({ classInfo, subjects }) => (
                        <div
                          key={classInfo.id}
                          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                                <GraduationCapIcon className="size-4" />
                              </div>
                              <div className="flex flex-col">
                                <p className="text-sm font-medium text-secondary-foreground">
                                  Grade {classInfo.grade} · Section{" "}
                                  {classInfo.section}
                                </p>
                                {classInfo.academic_year && (
                                  <p className="text-[11px] text-muted-foreground">
                                    {classInfo.academic_year}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Badge
                              variant="secondary"
                              className="rounded-full text-[10px]"
                            >
                              {subjects.length}{" "}
                              {subjects.length === 1 ? "subject" : "subjects"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {subjects.map((sub) => (
                              <span
                                key={sub.id}
                                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-secondary-foreground"
                              >
                                <BookOpenIcon className="size-3 text-muted-foreground" />
                                {sub.subject_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>

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
                    and all of their assignments. This action cannot be undone.
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
                        <Loader2Icon className="size-3.5 animate-spin" />
                        Deleting…
                      </>
                    ) : (
                      <>
                        <Trash2Icon className="size-3.5" />
                        Delete
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
