import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon, type Icon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useTeacherAssignments } from "@/hooks/use-teacher-assignments"
import { Button } from "@/components/ui/button"
import { coverFor } from "@/modules/classes/lib/grade-palette"

/**
 * The title block for a class section page (Knowledge, Exams, Grading,
 * Students). A back arrow returns to the class home; the class code sits in
 * its grade colour so the page always says which room you are in; the section
 * name and count lead; the page's primary actions sit on the right.
 */
export function ClassPageHeader({
  icon: SectionIcon,
  title,
  count,
  description,
  actions,
}: {
  icon: Icon
  title: string
  count?: number
  description?: string
  actions?: React.ReactNode
}) {
  const navigate = useNavigate()
  const { classSubjectId } = useParams<{ classSubjectId: string }>()
  const { assignments } = useTeacherAssignments()
  const assignment = assignments.find(
    (a) => a.class_subject_id === classSubjectId
  )
  const grade = assignment?.class ? String(assignment.class.grade) : "?"
  const code = assignment?.class
    ? `${assignment.class.grade}${assignment.class.section}`
    : "—"
  const palette = coverFor(grade)

  return (
    <div className="flex flex-col gap-3">
      {/* Where you are: back, then the class as a small pill */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back to class"
          onClick={() => navigate(`/class/${classSubjectId}`)}
          className="-ml-1.5 rounded-full text-muted-foreground"
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <button
          type="button"
          onClick={() => navigate(`/class/${classSubjectId}`)}
          className="group inline-flex items-center gap-2 rounded-full border border-border bg-background py-0.5 pr-2.5 pl-0.5 text-xs text-secondary-foreground transition-colors hover:bg-muted"
        >
          <span
            className={cn(
              "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold text-white",
              palette.cover
            )}
          >
            {code}
          </span>
          {assignment?.subject?.subject_name ?? "Class"}
          {assignment?.class && (
            <span className="text-muted-foreground">
              · Grade {assignment.class.grade}, Section{" "}
              {assignment.class.section}
            </span>
          )}
        </button>
      </div>

      {/* The page itself */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-foreground">
            <SectionIcon
              aria-hidden
              className="size-6 shrink-0 text-muted-foreground"
            />
            <span className="truncate">{title}</span>
            {count != null && (
              <span className="text-base font-normal text-muted-foreground tabular-nums">
                {count}
              </span>
            )}
          </h1>
          {description && (
            <p className="max-w-xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  )
}
