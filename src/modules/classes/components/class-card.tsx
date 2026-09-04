import {
  ArrowRightIcon,
  BookOpenTextIcon,
  ChalkboardTeacherIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"

import { coverFor } from "@/modules/classes/lib/grade-palette"

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
  /** The school's active academic year — decides the Current/Previous badge.
   *  Null hides the badge (year not set yet). */
  activeAcademicYear?: string | null
}

export function ClassCard({ data, onClick, activeAcademicYear }: ClassCardProps) {
  const isCurrent =
    activeAcademicYear != null && data.academicYear === activeAcademicYear
  const subjects = data.subjects ?? []
  const palette = coverFor(data.grade)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* Cover — the classroom-door thumbnail */}
      <div
        className={`relative h-28 shrink-0 overflow-hidden ${palette.cover}`}
      >
        {/* Giant watermark grade number, clipped by the cover */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-2 -bottom-9 text-[7rem] leading-none font-bold tracking-tighter text-white/15 transition-transform duration-300 select-none group-hover:scale-105"
        >
          {data.grade}
        </span>

        <div className="relative flex h-full flex-col justify-between p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              {data.academicYear}
            </span>
            {activeAcademicYear != null && (
              <span
                className={
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm " +
                  (isCurrent
                    ? "bg-white/20 text-white"
                    : "bg-black/25 text-white/90")
                }
              >
                <span
                  className={
                    "size-1.5 rounded-full " +
                    (isCurrent ? "bg-white" : "bg-amber-300")
                  }
                />
                {isCurrent ? "Current batch" : "Previous batch"}
              </span>
            )}
          </div>

          <p className="text-xl font-semibold tracking-tight text-white drop-shadow-sm">
            Grade {data.grade}
          </p>
        </div>
      </div>

      {/* Icon disc straddling the cover edge, Classroom-style */}
      <div className="relative h-0">
        <div className="absolute -top-6 right-4 flex size-12 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
          <ChalkboardTeacherIcon
            weight="duotone"
            className={`size-6 ${palette.disc}`}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-4">
        {/* Sections — single letters, never truncate */}
        <div className="flex items-center gap-1.5 pr-14">
          <span className="text-xs text-muted-foreground">Sections</span>
          {data.sections.length > 0 ? (
            data.sections.map((section) => (
              <span
                key={section.id}
                className="flex size-6 items-center justify-center rounded-md border border-border bg-background text-xs font-semibold text-secondary-foreground"
              >
                {section.section}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">None yet</span>
          )}
        </div>

        {/* Subjects — full names on one line; the line ellipsis is honest,
            unlike per-pill truncation which chopped words mid-way. */}
        <div className="flex items-center gap-2">
          <BookOpenTextIcon className="size-4 shrink-0 text-muted-foreground" />
          {subjects.length > 0 ? (
            <p className="min-w-0 truncate text-xs text-secondary-foreground">
              <span className="font-medium">{subjects.length} subjects</span>
              <span className="text-muted-foreground">
                {" · "}
                {subjects.map((s) => s.subject_name).join(", ")}
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No subjects assigned
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <UsersThreeIcon className="size-4 shrink-0" />
            <span>
              <span className="font-semibold text-foreground">
                {data.studentCount ?? 0}
              </span>{" "}
              students
            </span>
          </span>
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Open
            <ArrowRightIcon className="size-3.5" />
          </span>
        </div>
      </div>
    </div>
  )
}
