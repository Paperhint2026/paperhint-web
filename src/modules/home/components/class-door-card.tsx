import { useNavigate } from "react-router-dom"
import {
  BookOpenIcon,
  ExamIcon,
  ListChecksIcon,
  UsersIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { classLabel, type Assignment } from "@/hooks/use-teacher-assignments"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { coverFor } from "@/modules/classes/lib/grade-palette"

const CLASS_LINKS = [
  { slug: "knowledge", label: "Knowledge", icon: BookOpenIcon },
  { slug: "exams", label: "Exams", icon: ExamIcon },
  { slug: "grading", label: "Grading", icon: ListChecksIcon },
  { slug: "students", label: "Students", icon: UsersIcon },
] as const

/**
 * A class as a classroom door: the grade's cover gradient with the number
 * ghosted in the corner, and a shortcut tray that slides up from the bottom
 * on hover or focus. Same cover as the Classes grid, so a teacher's home and
 * the admin's grid share one visual language.
 */
export function ClassDoorCard({
  assignment: a,
  students,
  exams,
  waiting,
  index = 0,
}: {
  assignment: Assignment
  students: number
  exams: number
  waiting: number
  /** Position in the row, for the entrance stagger. */
  index?: number
}) {
  const navigate = useNavigate()
  const grade = a.class ? String(a.class.grade) : "?"
  const code = a.class ? `${a.class.grade}${a.class.section}` : "—"
  const palette = coverFor(grade)
  const base = `/class/${a.class_subject_id}`

  return (
    <div
      style={{ animationDelay: `${index * 60}ms` }}
      className={cn(
        "group relative isolate h-48 w-full shrink-0 overflow-hidden rounded-xl shadow-xs ring-1 ring-black/5 transition-[transform,box-shadow] duration-200 [clip-path:inset(0_round_var(--radius-xl))] hover:-translate-y-0.5 hover:shadow-md sm:w-64",
        "animate-in duration-300 fade-in-0 fill-mode-backwards slide-in-from-bottom-2",
        palette.cover
      )}
    >
      {/* Whole card opens the class */}
      <button
        type="button"
        onClick={() => navigate(base)}
        aria-label={`Open ${classLabel(a)}`}
        className="absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset"
      />

      {/* Watermark grade number */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-1 -bottom-7 text-[6.5rem] leading-none font-bold tracking-tighter text-white/15 transition-transform duration-300 select-none group-hover:-translate-y-6 group-hover:scale-105"
      >
        {grade}
      </span>

      {/* Top row: class code + waiting badge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
          {code}
        </span>
        {waiting > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
            {waiting} to grade
          </span>
        )}
      </div>

      {/* Title block — lifts to make room for the tray */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3 transition-transform duration-300 ease-out group-focus-within:-translate-y-11 group-hover:-translate-y-11">
        <span className="truncate text-base font-semibold text-white drop-shadow-sm">
          {a.subject?.subject_name ?? classLabel(a)}
        </span>
        <span className="text-xs text-white/80">
          {students} {students === 1 ? "student" : "students"} · {exams}{" "}
          {exams === 1 ? "exam" : "exams"}
        </span>
      </div>

      {/* Shortcut tray */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex translate-y-full items-stretch divide-x divide-border rounded-b-xl border-t border-border bg-background/95 backdrop-blur transition-transform duration-300 ease-out group-focus-within:translate-y-0 group-hover:translate-y-0">
        {CLASS_LINKS.map((link) => (
          <Tooltip key={link.slug}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => navigate(`${base}/${link.slug}`)}
                aria-label={link.label}
                className="flex flex-1 items-center justify-center py-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:outline-none"
              >
                <link.icon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{link.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
