import { FolderIcon } from "lucide-react"

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
      className="flex cursor-pointer flex-col gap-5 rounded-xl border bg-background p-6 transition-colors hover:bg-muted/30"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <FolderIcon className="size-5 text-muted-foreground/60" />
        <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-secondary-foreground">
          Current Batch
        </span>
      </div>

      <div>
        <p className="text-xl font-semibold text-secondary-foreground">
          Grade {data.grade}
        </p>
        <p className="text-sm text-muted-foreground">{data.academicYear}</p>
      </div>

      {subjects.length > 0 && (
        <p className="truncate text-xs text-muted-foreground">
          {subjects.map((s) => s.subject_name).join("  ·  ")}
        </p>
      )}

      <div className="flex items-center divide-x text-sm">
        <div className="flex flex-col gap-0.5 pr-6">
          <p className="text-lg font-semibold text-secondary-foreground">
            {subjects.length}
          </p>
          <p className="text-xs text-muted-foreground">Subjects</p>
        </div>
        <div className="flex flex-col gap-0.5 px-6">
          <p className="text-lg font-semibold text-secondary-foreground">
            {data.sections.length}
          </p>
          <p className="text-xs text-muted-foreground">Sections</p>
        </div>
        <div className="flex flex-col gap-0.5 pl-6">
          <p className="text-lg font-semibold text-secondary-foreground">
            {data.studentCount ?? 0}
          </p>
          <p className="text-xs text-muted-foreground">Students</p>
        </div>
      </div>
    </div>
  )
}
