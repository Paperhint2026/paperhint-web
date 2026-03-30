import dayjs from "dayjs"
import { BriefcaseIcon, CalendarIcon, MailIcon, BadgeCheckIcon, PencilIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"

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

const STATUS_STYLES: Record<TeacherStatus, string> = {
  invited: "bg-amber-500 text-white",
  active: "bg-emerald-500 text-white",
  inactive: "bg-slate-500 text-white",
}

interface TeacherCardProps {
  teacher: Teacher
  departmentName?: string
  onEdit?: (teacherId: string) => void
}

const GRADIENTS = [
  "from-indigo-900 to-slate-900",
  "from-sky-900 to-slate-900",
  "from-emerald-900 to-slate-900",
  "from-teal-900 to-slate-900",
  "from-blue-900 to-slate-900",
  "from-cyan-900 to-slate-900",
  "from-violet-900 to-slate-900",
  "from-slate-800 to-slate-900",
]

function hashStringToIndex(str: string, max: number): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % max
}

function getGradient(departmentId?: string | null): string {
  if (!departmentId) return GRADIENTS[0]
  return GRADIENTS[hashStringToIndex(departmentId, GRADIENTS.length)]
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function TeacherCard({ teacher, departmentName, onEdit }: TeacherCardProps) {
  const gradient = getGradient(teacher.department_id)
  const navigate = useNavigate()

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-lg border bg-background transition-colors hover:bg-muted/30"
      onClick={() => navigate(`/teachers/${teacher.id}/overview`)}
    >
      {/* Gradient banner with dot pattern */}
      <div className={`relative h-20 bg-gradient-to-r ${gradient}`}>
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "8px 8px",
          }}
        />
        <div className="absolute right-3 top-3 flex items-center gap-2">
          {onEdit && (
            <button
              className="flex size-7 items-center justify-center rounded-md bg-white/10 text-white/70 opacity-0 backdrop-blur-sm transition-opacity hover:bg-white/20 hover:text-white group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(teacher.id)
              }}
            >
              <PencilIcon className="size-3.5" />
            </button>
          )}
          {teacher.status && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLES[teacher.status]}`}
            >
              {teacher.status === "inactive" ? "In-Active" : teacher.status}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="-mt-6 flex items-start gap-4 px-4 pb-4">
        <Avatar size="lg" className="ring-2 ring-background">
          {teacher.profile_url ? (
            <img
              src={teacher.profile_url}
              alt={teacher.full_name}
              className="aspect-square size-full rounded-full object-cover"
            />
          ) : (
            <AvatarFallback>{getInitials(teacher.full_name)}</AvatarFallback>
          )}
        </Avatar>

        <div className="flex flex-1 flex-col gap-1 overflow-hidden pt-7">
          <p className="truncate text-sm font-medium text-secondary-foreground">
            {teacher.full_name}
          </p>
          <p className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MailIcon className="size-3 shrink-0 text-foreground" />
            {teacher.email}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            {departmentName && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <BriefcaseIcon className="size-3 shrink-0 text-foreground" />
                {departmentName}
              </span>
            )}
            {teacher.designation && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <BadgeCheckIcon className="size-3 shrink-0 text-foreground" />
                {teacher.designation}
              </span>
            )}
            {teacher.date_of_joining && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarIcon className="size-3 shrink-0 text-foreground" />
                {dayjs(teacher.date_of_joining).format("MMM DD, YYYY")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
