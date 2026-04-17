import { useCallback, useEffect, useMemo, useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { differenceInYears } from "date-fns"
import {
  CakeIcon,
  CalendarIcon,
  DropletIcon,
  GraduationCapIcon,
  HashIcon,
  Loader2Icon,
  MapPinIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
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

const GENDER_BADGE: Record<string, string> = {
  Male: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  Female: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-800",
  Other: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        {label}
      </span>
      <span className="text-right text-sm text-secondary-foreground">
        {value ?? <span className="text-muted-foreground/50">—</span>}
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

export function StudentDetailDrawer({
  studentId,
  open,
  onOpenChange,
  onEdit,
  onDeleted,
  canManage = true,
}: StudentDetailDrawerProps) {
  const isMobile = useIsMobile()
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
        `/api/students/${studentId}`,
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

  const hasAddress = !!(student?.street || student?.city || student?.contact_number)
  const hasEmergencyContact = !!(
    student?.emergency_contact_name ||
    student?.emergency_contact_relationship ||
    student?.emergency_contact_phone
  )

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

        {error && !isLoading && !student && (
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {student && !isLoading && (
          <>
            {/* Header with gradient cover */}
            <SheetHeader className="relative shrink-0 gap-0 border-b border-border p-0">
              {/* Top action bar over gradient */}
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

              {/* Identity block — overlapping avatar */}
              <div className="-mt-10 flex flex-col gap-3 px-5 pb-5">
                <div
                  className={`flex size-20 shrink-0 items-center justify-center rounded-2xl border border-border text-xl font-semibold ${getAvatarColor(student.full_name)}`}
                >
                  {getInitials(student.full_name)}
                </div>
                <div className="flex flex-col gap-1.5">
                  <SheetTitle className="truncate text-lg font-semibold text-secondary-foreground">
                    {student.full_name}
                  </SheetTitle>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {cls && (
                      <Badge variant="secondary" className="rounded-full text-xs">
                        <GraduationCapIcon className="size-3" />
                        Grade {cls.grade} · Section {cls.section}
                      </Badge>
                    )}
                    {cls?.academic_year && (
                      <Badge variant="outline" className="rounded-full text-xs font-normal">
                        {cls.academic_year}
                      </Badge>
                    )}
                    {student.admission_number && (
                      <Badge variant="outline" className="rounded-full font-mono text-[10px] font-normal">
                        #{student.admission_number}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* Quick stats */}
            <div className="grid shrink-0 grid-cols-3 divide-x divide-border border-b border-border bg-muted/30">
              <div className="flex flex-col items-center gap-1.5 py-3">
                <span className="text-lg font-semibold text-secondary-foreground">
                  {age != null ? age : "—"}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <CakeIcon className="size-3" />
                  Years
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5 py-3">
                {student.gender ? (
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      GENDER_BADGE[student.gender] ??
                      "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {student.gender}
                  </span>
                ) : (
                  <span className="text-lg font-semibold text-muted-foreground/50">—</span>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <UserIcon className="size-3" />
                  Gender
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5 py-3">
                {student.blood_group ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
                    <DropletIcon className="size-3" />
                    {student.blood_group}
                  </span>
                ) : (
                  <span className="text-lg font-semibold text-muted-foreground/50">—</span>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <DropletIcon className="size-3" />
                  Blood Group
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="no-scrollbar flex-1 overflow-y-auto">
              {/* Personal */}
              <div className="flex flex-col gap-3 p-5">
                <SectionTitle>Personal</SectionTitle>
                <div className="divide-y divide-border rounded-lg border border-border bg-card p-4">
                  <InfoRow icon={CakeIcon} label="Date of Birth" value={formatDate(student.date_of_birth)} />
                  <InfoRow icon={UserIcon} label="Gender" value={student.gender} />
                  <InfoRow icon={DropletIcon} label="Blood Group" value={student.blood_group} />
                </div>
              </div>

              <Separator />

              {/* Academic */}
              <div className="flex flex-col gap-3 p-5">
                <SectionTitle>Academic</SectionTitle>
                <div className="divide-y divide-border rounded-lg border border-border bg-card p-4">
                  <InfoRow icon={HashIcon} label="Admission No." value={student.admission_number} />
                  <InfoRow icon={CalendarIcon} label="Academic Year" value={student.academic_year} />
                  <InfoRow icon={GraduationCapIcon} label="Grade" value={student.grade} />
                  <InfoRow icon={GraduationCapIcon} label="Section" value={student.section} />
                  <InfoRow
                    icon={HashIcon}
                    label="Roll No."
                    value={student.roll_number != null ? String(student.roll_number) : null}
                  />
                  <InfoRow icon={HashIcon} label="Register No." value={student.register_number} />
                </div>
              </div>

              <Separator />

              {/* Address */}
              <div className="flex flex-col gap-3 p-5">
                <SectionTitle>Address & Contact</SectionTitle>
                {hasAddress ? (
                  <div className="divide-y divide-border rounded-lg border border-border bg-card p-4">
                    <InfoRow icon={MapPinIcon} label="Street / House" value={student.street} />
                    <InfoRow icon={MapPinIcon} label="City" value={student.city} />
                    <InfoRow icon={PhoneIcon} label="Phone" value={student.contact_number} />
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    No address recorded
                  </p>
                )}
              </div>

              <Separator />

              {/* Emergency */}
              <div className="flex flex-col gap-3 p-5">
                <SectionTitle>Emergency Contact</SectionTitle>
                {hasEmergencyContact ? (
                  <div className="divide-y divide-border rounded-lg border border-border bg-card p-4">
                    <InfoRow icon={UsersIcon} label="Name" value={student.emergency_contact_name} />
                    <InfoRow icon={UsersIcon} label="Relationship" value={student.emergency_contact_relationship} />
                    <InfoRow icon={PhoneIcon} label="Phone" value={student.emergency_contact_phone} />
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    No emergency contact recorded
                  </p>
                )}
              </div>
            </div>

            <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete student?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove <span className="font-medium text-foreground">{student.full_name}</span> and their associated records. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
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
