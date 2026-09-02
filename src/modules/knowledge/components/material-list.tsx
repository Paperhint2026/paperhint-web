import type { Icon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { GroupedList, ListGroup } from "@/components/shared/list-group"
import { tameCaps } from "@/lib/format"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"

/* The container and group heading are the shared grouped-list primitives;
   these names stay so the two library pages read as "materials". */
export { GroupedList as MaterialList, ListGroup as MaterialGroup }

export function MaterialRow({
  icon: RowIcon,
  iconTitle,
  select,
  title,
  subtitle,
  right,
  onOpen,
}: {
  icon: Icon
  iconTitle?: string
  /** When set, hovering the icon swaps it for a checkbox. */
  select?: { checked: boolean; onChange: () => void; label: string }
  title: string
  /** Muted middle column — tags, "+2 classes". Hidden on narrow screens. */
  subtitle?: string
  /** Right cluster: status, visibility, avatar, age, menu. */
  right?: React.ReactNode
  onOpen?: () => void
}) {
  const selected = select?.checked ?? false
  const icon = (
    <span
      className={cn(
        "flex text-muted-foreground transition-opacity",
        select &&
          (selected
            ? "opacity-0"
            : "group-focus-within:opacity-0 group-hover:opacity-0")
      )}
    >
      <RowIcon className="size-4" />
    </span>
  )
  return (
    <div
      data-selected={selected || undefined}
      className="group relative flex h-11 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-muted/50 data-selected:bg-primary/[0.05]"
    >
      {/* Icon slot — becomes the checkbox on hover */}
      <div className="relative flex size-5 shrink-0 items-center justify-center">
        {iconTitle ? (
          <Tooltip>
            <TooltipTrigger asChild>{icon}</TooltipTrigger>
            <TooltipContent>{iconTitle}</TooltipContent>
          </Tooltip>
        ) : (
          icon
        )}
        {select && (
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity",
              selected
                ? "opacity-100"
                : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
            )}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={select.onChange}
              aria-label={select.label}
            />
          </span>
        )}
      </div>

      {/* Title */}
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 truncate text-left text-sm text-foreground underline-offset-4 hover:underline"
        >
          {tameCaps(title)}
        </button>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {tameCaps(title)}
        </span>
      )}

      {/* Subtitle */}
      {subtitle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="hidden w-[34%] shrink-0 truncate text-xs text-muted-foreground lg:block">
              {subtitle}
            </span>
          </TooltipTrigger>
          <TooltipContent>{subtitle}</TooltipContent>
        </Tooltip>
      )}

      {/* Right cluster */}
      {right && (
        <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          {right}
        </div>
      )}
    </div>
  )
}

/* Title widths cycle so the stack reads as real, varied titles, not bars. */
const TITLE_WIDTHS = ["42%", "58%", "31%", "50%", "37%", "64%", "45%", "28%"]

/** The right cluster most rows carry: status, age, then the row menu. Pages
 *  whose rows end differently (an avatar, a pick button) pass their own. */
export function MaterialRowSkeletonRight({
  status = true,
  avatar = false,
  action = "menu",
}: {
  status?: boolean
  avatar?: boolean
  action?: "menu" | "button" | "none"
}) {
  return (
    <>
      {status && (
        <span className="flex w-24 items-center gap-1.5">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </span>
      )}
      {avatar && <Skeleton className="size-5 rounded-full" />}
      <span className="flex w-14 justify-end">
        <Skeleton className="h-3 w-9" />
      </span>
      {action === "menu" && <Skeleton className="-mr-1 size-7 rounded-md" />}
      {action === "button" && <Skeleton className="h-8 w-32 rounded-md" />}
    </>
  )
}

/** One MaterialRow's silhouette — same height, padding and column widths. */
export function MaterialRowSkeleton({
  index = 0,
  right,
}: {
  index?: number
  right?: React.ReactNode
}) {
  return (
    <div className="flex h-11 items-center gap-3 rounded-lg px-3">
      <div className="flex size-5 shrink-0 items-center justify-center">
        <Skeleton className="size-4 rounded" />
      </div>
      <div className="min-w-0 flex-1">
        <Skeleton
          className="h-4"
          style={{ width: TITLE_WIDTHS[index % TITLE_WIDTHS.length] }}
        />
      </div>
      <div className="hidden w-[34%] shrink-0 lg:block">
        <Skeleton
          className="h-3"
          style={{ width: TITLE_WIDTHS[(index + 3) % TITLE_WIDTHS.length] }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {right ?? <MaterialRowSkeletonRight />}
      </div>
    </div>
  )
}

/**
 * The whole list while it loads: the meta line, then either grouped sections
 * with their pill headings (the libraries) or one flat stack (a class's
 * Knowledge page). Mirrors GroupedList / ListGroup / MaterialRow so the page
 * does not reflow when the real rows arrive.
 */
export function MaterialListSkeleton({
  rows = 4,
  groups = 2,
  grouped = true,
  right,
}: {
  /** Rows per group, or total rows when not grouped. */
  rows?: number
  groups?: number
  grouped?: boolean
  /** Right-cluster silhouette for every row; see MaterialRowSkeletonRight. */
  right?: React.ReactNode
}) {
  const stack = (count: number, offset = 0) => (
    <div className="-mx-3 flex flex-col">
      {Array.from({ length: count }).map((_, i) => (
        <MaterialRowSkeleton key={i} index={offset + i} right={right} />
      ))}
    </div>
  )

  return (
    <div aria-hidden className="flex flex-col">
      <div className="mb-3 flex h-6 items-center gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>
      {grouped
        ? Array.from({ length: groups }).map((_, g) => (
            <section
              key={g}
              className="flex flex-col border-t border-border py-5 first-of-type:border-t-0 first-of-type:pt-0"
            >
              <header className="flex items-center pb-2">
                <Skeleton className="h-6 w-28 rounded-full" />
              </header>
              {stack(rows, g * rows)}
            </section>
          ))
        : stack(rows)}
    </div>
  )
}
