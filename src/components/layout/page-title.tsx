import type { Icon } from "@phosphor-icons/react"

import { useHeaderActions } from "@/components/layout/header-actions-context"

/**
 * The title block a page opens with. The shell renders no chrome bar, so this
 * is what names the page — keep it as the first child of the page container.
 */
export function PageTitle({
  icon: IconComponent,
  title,
  description,
}: {
  icon?: Icon
  title: string
  description?: string
}) {
  // The page's primary action sits on the title line. Pages still publish it
  // through useHeaderActions(); this is just where it lands.
  const { headerActions } = useHeaderActions()

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2.5">
          {IconComponent ? (
            <IconComponent
              aria-hidden
              className="size-6 shrink-0 text-muted-foreground"
            />
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
        </div>
        {description ? (
          <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {headerActions ? (
        <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
      ) : null}
    </div>
  )
}
