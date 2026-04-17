import dayjs from "dayjs"
import { BriefcaseIcon, CalendarIcon, CheckIcon, GraduationCapIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon, UserRoundIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type TeacherStatus = "invited" | "active" | "inactive"

export interface Teacher {
  id: string
  full_name: string
  email: string
  role: string
  status?: TeacherStatus | null
  department_id?: string | null
  designation?: string | null
  date_of_joining?: number | string | null
  profile_url?: string | null
  school_id?: string
}

const STATUS_LABEL: Record<TeacherStatus, string> = {
  invited: "Invited",
  active: "Active",
  inactive: "Inactive",
}

const STATUS_CLASSES: Record<TeacherStatus, string> = {
  invited: "bg-amber-50 text-amber-700 border-amber-500 dark:bg-amber-950 dark:text-amber-400",
  active: "bg-green-200 text-green-900 border-green-700 dark:bg-green-950 dark:text-green-400",
  inactive: "bg-slate-100 text-slate-600 border-slate-400 dark:bg-slate-800 dark:text-slate-400",
}

interface TeacherCardProps {
  teacher: Teacher
  departmentName?: string
  onView?: (teacherId: string) => void
  onEdit?: (teacherId: string) => void
  onDelete?: (teacherId: string) => void
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function TeacherCard({ teacher, departmentName, onView, onEdit, onDelete }: TeacherCardProps) {
  const showMore = Boolean(onEdit || onDelete)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onView?.(teacher.id)}
      onKeyDown={(e) => e.key === "Enter" && onView?.(teacher.id)}
      className="group relative flex cursor-pointer flex-col gap-5 overflow-hidden rounded-lg border border-border bg-sidebar p-5 transition-colors hover:bg-sidebar-accent"
    >
      {/* Top-right slot: badge always visible, edit button expands in on hover */}
      <div className="absolute right-4 top-4 flex items-center">
        {/* Badge — always visible */}
        {teacher.status && (
          <Badge className={`transition-all duration-200 ${STATUS_CLASSES[teacher.status]}`}>
            {teacher.status === "active" && <CheckIcon />}
            {STATUS_LABEL[teacher.status]}
          </Badge>
        )}

        {/* More button — zero width by default, expands on hover or when menu open */}
        {showMore && (
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-0 overflow-hidden transition-all duration-200 group-hover:ml-1.5 group-hover:w-6 has-[[data-state=open]]:ml-1.5 has-[[data-state=open]]:w-6"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="More options"
                >
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {onEdit && (
                  <DropdownMenuItem onSelect={() => onEdit(teacher.id)}>
                    <PencilIcon className="size-3.5" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onEdit && onDelete && <DropdownMenuSeparator />}
                {onDelete && (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={(e) => {
                      e.preventDefault()
                      onDelete(teacher.id)
                    }}
                  >
                    <Trash2Icon className="size-3.5" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Profile section */}
      <div className="flex flex-col gap-3">
        <Avatar>
          {teacher.profile_url ? (
            <AvatarImage src={teacher.profile_url} alt={teacher.full_name} />
          ) : (
            <AvatarFallback>{getInitials(teacher.full_name)}</AvatarFallback>
          )}
        </Avatar>

        <div className="flex flex-col gap-0">
          <p className="truncate text-base font-medium text-secondary-foreground">
            {teacher.full_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {teacher.designation ?? teacher.email}
          </p>
        </div>
      </div>

      {/* Details section */}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex items-center gap-1.5">
          {departmentName ? (
            <>
              <BriefcaseIcon className="size-3 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs text-foreground">{departmentName}</span>
            </>
          ) : (
            <>
              <UserRoundIcon className="size-3 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs text-muted-foreground">No department</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {teacher.date_of_joining ? (
            <>
              <CalendarIcon className="size-3 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs text-foreground">
                Joined {dayjs(teacher.date_of_joining).format("MMM YYYY")}
              </span>
            </>
          ) : (
            <>
              <GraduationCapIcon className="size-3 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs text-muted-foreground">No join date</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
