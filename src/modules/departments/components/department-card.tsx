import { useNavigate } from "react-router-dom"

import { cn } from "@/lib/utils"
import { lookFor } from "@/modules/departments/lib/department-look"

/**
 * A department as a door, the same shape as a classroom door on the Classes
 * grid: a cover gradient with the mark ghosted in the corner. Students are
 * grouped into grades; teachers are grouped into departments, so the two grids
 * look alike on purpose.
 */
export function DepartmentCard({
  name,
  teacherCount,
  subjectCount,
  headCount,
  onOpen,
  index = 0,
}: {
  name: string
  teacherCount: number
  subjectCount: number
  headCount: number
  onOpen: () => void
  index?: number
}) {
  const { Icon, palette } = lookFor(name)
  const navigate = useNavigate()
  void navigate

  return (
    <div
      style={{ animationDelay: `${index * 60}ms` }}
      className={cn(
        "group relative isolate h-40 w-full shrink-0 overflow-hidden rounded-xl shadow-xs ring-1 ring-black/5 transition-[transform,box-shadow] duration-200 [clip-path:inset(0_round_var(--radius-xl))] hover:-translate-y-0.5 hover:shadow-md",
        "animate-in duration-300 fade-in-0 fill-mode-backwards slide-in-from-bottom-2",
        palette.cover
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${name}`}
        className="absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset"
      />

      {/* The mark, ghosted where a grade card carries its number */}
      <Icon
        aria-hidden
        weight="fill"
        className="pointer-events-none absolute -right-4 -bottom-6 size-32 text-white/15 transition-transform duration-300 select-none group-hover:-translate-y-4 group-hover:scale-105"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <Icon aria-hidden className="size-5 shrink-0 text-white/90" />
        {headCount === 0 && (
          <span className="rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            No head
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3">
        <span className="truncate text-base font-semibold text-white">
          {name}
        </span>
        <span className="text-xs text-white/80">
          {teacherCount} {teacherCount === 1 ? "teacher" : "teachers"}
          {" · "}
          {subjectCount} {subjectCount === 1 ? "subject" : "subjects"}
        </span>
      </div>
    </div>
  )
}
