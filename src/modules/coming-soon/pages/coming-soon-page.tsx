import { Link, useParams } from "react-router-dom"

import { PageHeader } from "@/components/layout/page-header"
import { Sticker } from "@/components/shared/sticker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { findSoonItem } from "@/data/nav"

/**
 * Where a not-yet-built module lands. Every module from the Sept 2026 handoff
 * has a row in the nav so the whole application is visible; this page carries
 * the module's own one-paragraph description so the row is never a dead end.
 */
export function ComingSoonPage() {
  const { slug = "" } = useParams()
  const item = findSoonItem(slug)

  if (!item) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <Sticker name="worried" size={88} />
        <p className="text-sm text-muted-foreground">
          There is no module here.
        </p>
        <Button asChild variant="outline">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader icon={item.icon} title={item.title} description={item.group}>
        <Badge variant="secondary" className="rounded-full">
          Coming soon
        </Badge>
      </PageHeader>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
        <Sticker name="idea" size={112} />
        <div className="max-w-md space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {item.code ? `Module ${item.code}` : "Module"}
          </p>
          <p className="text-base leading-relaxed text-foreground">
            {item.blurb}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Not built yet. It is here so the map of the application is complete.
        </p>
      </div>
    </div>
  )
}
