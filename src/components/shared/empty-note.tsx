import type { Icon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

/**
 * The empty state inside a widget: a muted mark, one line saying what is
 * missing, and one more saying what fills it. Sized to sit in a card without
 * changing its height, so a grid of widgets stays level whether they are full
 * or empty.
 */
export function EmptyNote({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon: Icon
  title: string
  hint?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 px-4 py-6 text-center",
        className
      )}
    >
      <Icon aria-hidden className="size-6 text-muted-foreground/50" />
      <p className="text-sm text-secondary-foreground">{title}</p>
      {hint && <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
