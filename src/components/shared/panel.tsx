import type { Icon } from "@phosphor-icons/react"
import { ArrowRightIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

/**
 * A titled card. The heading carries an icon, an optional count, and an
 * optional "See all" link on the right. Used on the home page and the class
 * home, so panels read the same everywhere.
 */
export function Panel({
  icon: PanelIcon,
  title,
  count,
  action,
  className,
  children,
}: {
  icon: Icon
  title: string
  count?: number
  action?: { label: string; onClick: () => void }
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-border bg-background",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <PanelIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex items-baseline gap-1.5">
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          {count != null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {count}
            </span>
          )}
        </span>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {action.label}
            <ArrowRightIcon className="size-3" />
          </button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}

/** Sticker + one line, centred in a panel with nothing in it. */
export function PanelEmpty({
  sticker,
  title,
  body,
  action,
}: {
  sticker: React.ReactNode
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      {sticker}
      <div className="flex max-w-[260px] flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  )
}

/** A single action pinned to the bottom of a panel, e.g. "All 14 sources". */
export function PanelFooter({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-auto flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
    >
      {label}
      <ArrowRightIcon className="size-3.5" />
    </button>
  )
}
