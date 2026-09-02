import type { Icon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

/**
 * A list split into titled groups. Groups are separated by a hairline and a
 * breath of space; the rows inside each group sit as a plain stack. Used by
 * the libraries and the student roster so every grouped list reads the same.
 */
export function GroupedList({
  meta,
  children,
  className,
}: {
  /** One quiet line above the list — counts, sort, select-all. */
  meta?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      {meta && (
        <div className="mb-3 flex h-6 items-center gap-3 text-xs text-muted-foreground">
          {meta}
        </div>
      )}
      {children}
    </div>
  )
}

export function ListGroup({
  icon: GroupIcon,
  label,
  count,
  children,
}: {
  icon: Icon
  label: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col border-t border-border py-5">
      <header className="flex items-center pb-2">
        <h3 className="inline-flex items-center gap-2 rounded-full bg-sidebar px-2.5 py-1 text-xs font-medium text-secondary-foreground ring-1 ring-border/60">
          <GroupIcon className="size-3.5 text-muted-foreground" />
          {label}
          <span className="font-normal text-muted-foreground tabular-nums">
            {count}
          </span>
        </h3>
      </header>
      <div className="-mx-3 flex flex-col">{children}</div>
    </section>
  )
}
