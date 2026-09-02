import type { Icon } from "@phosphor-icons/react"

import { PageTitle } from "@/components/layout/page-title"

/**
 * The top of a list page: the title block, then whatever toolbar the page
 * passes as children (normally a PageToolbar). Rendered as siblings, not a
 * wrapper, so the page's own flex gap spaces them and the toolbar's sticky
 * positioning and gutter bleed keep working.
 */
export function PageHeader({
  icon,
  title,
  description,
  children,
}: {
  icon?: Icon
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <>
      <PageTitle icon={icon} title={title} description={description} />
      {children}
    </>
  )
}
