import dayjs from "dayjs"
import {
  BriefcaseIcon,
  CalendarBlankIcon,
  DotsThreeIcon,
  EnvelopeSimpleIcon,
  PencilIcon,
  TrashIcon,
  type Icon,
} from "@phosphor-icons/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

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

const STATUS_DOT: Record<TeacherStatus, string> = {
  invited: "bg-amber-500",
  active: "bg-emerald-500",
  inactive: "bg-slate-400 dark:bg-slate-500",
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

function joinedLabel(joined: Teacher["date_of_joining"]) {
  if (!joined) return null
  const start = dayjs(joined)
  if (!start.isValid()) return null
  const years = dayjs().diff(start, "year")
  const date = start.format("MMM YYYY")
  if (years < 1) return date
  return `${date} · ${years} ${years === 1 ? "yr" : "yrs"}`
}

/** One record row on the card back — the same shape as the student desk
 *  card: icon and label on the left, value on the right, 11px throughout. */
function Field({
  icon: FieldIcon,
  label,
  value,
  muted,
}: {
  icon: Icon
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <FieldIcon className="size-3.5" />
        {label}
      </dt>
      <dd
        className={cn(
          "truncate",
          muted ? "text-muted-foreground" : "text-secondary-foreground"
        )}
      >
        {value}
      </dd>
    </div>
  )
}

export function TeacherCard({
  teacher,
  departmentName,
  onView,
  onEdit,
  onDelete,
}: TeacherCardProps) {
  const showMore = Boolean(onEdit || onDelete)
  const joined = joinedLabel(teacher.date_of_joining)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onView?.(teacher.id)}
      onKeyDown={(e) => e.key === "Enter" && onView?.(teacher.id)}
      className="group relative flex cursor-pointer flex-col rounded-xl border border-border bg-background transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* Top-right: status badge always visible, more menu slides in on hover */}
      <div className="absolute top-2.5 right-2.5 flex items-center">
        {teacher.status && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "size-1.5 rounded-full",
                STATUS_DOT[teacher.status]
              )}
            />
            {STATUS_LABEL[teacher.status]}
          </span>
        )}
        {showMore && (
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-0 overflow-hidden transition-all duration-200 group-hover:ml-1 group-hover:w-6 focus-within:ml-1 focus-within:w-6 has-[[data-state=open]]:ml-1 has-[[data-state=open]]:w-6"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="More options"
                >
                  <DotsThreeIcon weight="bold" />
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
                    <TrashIcon className="size-3.5" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Front — photo beside identity */}
      <div className="flex items-center gap-3.5 px-4 py-4">
        <Avatar className="size-12 rounded-lg after:rounded-lg">
          {teacher.profile_url ? (
            <AvatarImage
              src={teacher.profile_url}
              alt={teacher.full_name}
              className="rounded-lg"
            />
          ) : (
            <AvatarFallback className="rounded-lg text-sm">
              {getInitials(teacher.full_name)}
            </AvatarFallback>
          )}
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-16">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
            {teacher.full_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {teacher.designation ?? "Teacher"}
          </p>
        </div>
      </div>

      {/* Back — record rows under a dashed rule, like the student card */}
      <dl className="flex flex-col gap-1.5 border-t border-dashed border-border px-4 py-3 text-[11px]">
        <Field
          icon={BriefcaseIcon}
          label="Department"
          value={departmentName ?? "—"}
          muted={!departmentName}
        />
        <Field
          icon={CalendarBlankIcon}
          label="Joined"
          value={joined ?? "—"}
          muted={!joined}
        />
        <Field icon={EnvelopeSimpleIcon} label="Email" value={teacher.email} />
      </dl>
    </div>
  )
}
