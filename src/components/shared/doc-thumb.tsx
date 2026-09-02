import type { Icon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

/**
 * A small paper-page thumbnail for a document: ruled lines standing in for
 * text, a folded corner, and the file type stamped in the corner. Images show
 * themselves instead.
 */
export function DocThumb({
  icon: ThumbIcon,
  ext,
  previewUrl,
  className,
}: {
  icon: Icon
  /** "PDF", "PNG"… */
  ext?: string
  /** Image URL to show as the actual preview. */
  previewUrl?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-sidebar text-muted-foreground",
        className
      )}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <>
          <span
            aria-hidden
            className="absolute inset-x-2 top-2.5 flex flex-col gap-[3px]"
          >
            <span className="h-px w-3/5 bg-border" />
            <span className="h-px w-full bg-border" />
            <span className="h-px w-4/5 bg-border" />
            <span className="h-px w-full bg-border" />
          </span>
          <ThumbIcon className="relative size-4 opacity-0" />
          {ext && (
            <span className="absolute right-0.5 bottom-0.5 rounded-sm bg-background px-1 text-[7px] font-semibold tracking-wider text-muted-foreground uppercase ring-1 ring-border">
              {ext}
            </span>
          )}
          <span
            aria-hidden
            className="absolute -top-px -right-px size-3.5 border-b border-l border-border bg-background [clip-path:polygon(0_0,100%_100%,0_100%)]"
          />
        </>
      )}
    </span>
  )
}
