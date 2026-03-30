import { UsersIcon } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"

export interface ClassItem {
  id: string
  school_id: string
  grade: number
  section: string
  academic_year: string
  created_at?: string
}

interface StudentClassCardProps {
  classItem: ClassItem
  studentCount: number | null
  onClick: () => void
}

export function StudentClassCard({
  classItem,
  studentCount,
  onClick,
}: StudentClassCardProps) {
  return (
    <div
      className="flex cursor-pointer flex-col gap-4 rounded-lg border bg-background p-5 transition-colors hover:bg-muted/30"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
          <UsersIcon className="size-4 text-primary" />
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {classItem.academic_year}
        </span>
      </div>

      <div>
        <p className="text-base font-medium text-secondary-foreground">
          Grade {classItem.grade} – Section {classItem.section}
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {studentCount === null ? (
          <Spinner className="size-3.5" />
        ) : (
          <>
            <span className="font-medium">{studentCount}</span>
            <span className="text-muted-foreground">
              {studentCount === 1 ? "Student" : "Students"}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
