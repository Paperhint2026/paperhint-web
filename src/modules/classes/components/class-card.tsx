import { FolderIcon } from "lucide-react"

export interface ClassRecord {
  id: string
  grade: string
  section: string
  academic_year: string
  school_id: string
  created_at?: string
}

export interface GroupedGrade {
  grade: string
  academicYear: string
  sections: ClassRecord[]
}

interface ClassCardProps {
  data: GroupedGrade
  onClick?: () => void
}

export function ClassCard({ data, onClick }: ClassCardProps) {
  return (
    <div
      className="flex cursor-pointer flex-col gap-4 rounded-lg border bg-background p-5 transition-colors hover:bg-muted/30"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <FolderIcon className="size-4 text-muted-foreground" />
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          Current Batch
        </span>
      </div>

      <div>
        <p className="text-base font-medium text-secondary-foreground">
          Grade {data.grade}
        </p>
        <p className="text-xs text-muted-foreground">{data.academicYear}</p>
      </div>

      <div className="flex items-center gap-0 divide-x text-xs">
        <div className="pr-3">
          <p className="font-medium">{data.sections.length}</p>
          <p className="text-muted-foreground">Sections</p>
        </div>
        <div className="pl-3">
          <p className="font-medium">
            {data.sections.map((s) => s.section).join(", ")}
          </p>
          <p className="text-muted-foreground">Section Names</p>
        </div>
      </div>
    </div>
  )
}
