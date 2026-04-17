import { CheckIcon, FolderIcon } from "lucide-react"

export interface ClassRecord {
  id: string
  grade: string
  section: string
  academic_year: string
  school_id: string
  created_at?: string
}

export interface SubjectInfo {
  id: string
  subject_name: string
}

export interface GroupedGrade {
  grade: string
  academicYear: string
  sections: ClassRecord[]
  subjects?: SubjectInfo[]
  studentCount?: number
}

interface ClassCardProps {
  data: GroupedGrade
  onClick?: () => void
}

export function ClassCard({ data, onClick }: ClassCardProps) {
  const subjects = data.subjects ?? []

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className="flex cursor-pointer flex-col gap-5 overflow-hidden rounded-lg border border-border bg-sidebar p-5 transition-colors hover:bg-sidebar-accent"
    >
      {/* Top row: folder icon + badge */}
      <div className="flex items-center justify-between">
        <FolderIcon className="size-4 text-muted-foreground" />
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
          <CheckIcon className="size-3 text-muted-foreground" />
          Current Batch
        </span>
      </div>

      {/* Grade + academic year */}
      <div className="flex flex-col gap-0">
        <p className="truncate text-base font-medium text-secondary-foreground">
          Grade {data.grade}
        </p>
        <p className="text-xs text-muted-foreground">{data.academicYear}</p>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-xs font-medium leading-none text-foreground">
            {subjects.length}
          </p>
          <p className="text-xs leading-none text-muted-foreground">Subjects</p>
        </div>

        <div className="h-5 w-px shrink-0 bg-border" />

        <div className="flex flex-1 flex-col gap-1">
          <p className="text-xs font-medium leading-none text-foreground">
            {data.sections.length}
          </p>
          <p className="text-xs leading-none text-muted-foreground">Sections</p>
        </div>

        <div className="h-5 w-px shrink-0 bg-border" />

        <div className="flex flex-1 flex-col gap-1">
          <p className="text-xs font-medium leading-none text-foreground">
            {data.studentCount ?? 0}
          </p>
          <p className="text-xs leading-none text-muted-foreground">Students</p>
        </div>
      </div>
    </div>
  )
}
