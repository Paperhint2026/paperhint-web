import {
  CheckIcon,
  MagnifyingGlassIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "@phosphor-icons/react"

import { StickyToolbar } from "@/components/layout/sticky-toolbar"
import { useHeaderActions } from "@/components/layout/header-actions-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/**
 * The list-page toolbar: search on the left, an optional Filters popover, a
 * summary count on the right, and a grouped row of active-filter chips under
 * a dashed rule. It pins to the top of the scroll area via StickyToolbar.
 *
 * The popover body and the chip row are page-specific and come in as
 * children — compose them from MultiSelectField, FilterFieldHeader,
 * FilterPill and FilterChipGroup in filter-controls.
 */
export function PageToolbar({
  search,
  filters,
  summary,
  chips,
  trailing,
  className,
}: {
  search: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }
  filters?: {
    activeCount: number
    onClearAll: () => void
    /** Sections inside the popover. */
    children: React.ReactNode
    /** Footer text beside Done, e.g. "12 of 20 teachers". */
    resultLabel?: React.ReactNode
  }
  /** Right-hand text on the toolbar row, e.g. "26 teachers". */
  summary?: React.ReactNode
  /** FilterChipGroup elements. Rendered only while filters are active. */
  chips?: React.ReactNode
  /** Controls that live on the toolbar's right, e.g. a pager. */
  trailing?: React.ReactNode
  className?: string
}) {
  const activeCount = filters?.activeCount ?? 0
  // The page's primary action lives on the title row. Once that scrolls away
  // the pinned toolbar carries a copy, so "Upload" is never out of reach.
  const { headerActions } = useHeaderActions()

  return (
    <StickyToolbar className={cn("flex flex-col gap-2", className)}>
      {(stuck) => (
        <>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative min-w-0 flex-1 sm:max-w-96">
              <MagnifyingGlassIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={search.placeholder ?? "Search…"}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                className="h-9 pr-8 pl-9"
              />
              {search.value && (
                <button
                  type="button"
                  onClick={() => search.onChange("")}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </div>

            {/* Filters */}
            {filters && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-9 transition-colors",
                      activeCount > 0 &&
                        "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    <SlidersHorizontalIcon className="size-3.5" />
                    Filters
                    {activeCount > 0 && (
                      <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                        {activeCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="w-80 gap-0 p-0"
                >
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
                      Filters
                    </p>
                    {activeCount > 0 ? (
                      <button
                        type="button"
                        onClick={filters.onClearAll}
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Clear all
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        None applied
                      </span>
                    )}
                  </div>
                  <div className="flex max-h-[60vh] flex-col gap-5 overflow-auto p-4">
                    {filters.children}
                  </div>
                  <div className="flex items-center justify-between border-t border-border bg-sidebar px-4 py-2.5 text-xs text-muted-foreground">
                    <span>{filters.resultLabel}</span>
                    <PopoverClose asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                      >
                        Done
                      </Button>
                    </PopoverClose>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <div className="ml-auto flex items-center gap-3">
              {summary != null && (
                <span className="hidden text-xs text-muted-foreground tabular-nums sm:block">
                  {summary}
                </span>
              )}
              {trailing}
              {stuck && headerActions ? (
                <div className="animate-in duration-200 fade-in-0 slide-in-from-right-2 [&>button]:h-9">
                  {headerActions}
                </div>
              ) : null}
            </div>
          </div>

          {filters && activeCount > 0 && chips && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-dashed border-border pt-3">
              {chips}
              <button
                type="button"
                onClick={filters.onClearAll}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <XIcon className="size-3" />
                Clear all
              </button>
            </div>
          )}
        </>
      )}
    </StickyToolbar>
  )
}

/** A toggle pill for short enumerations (status, gender…) inside a filter
 *  popover. Tinted with a check when on, outlined when off. */
export function FilterPill({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all duration-150",
        selected
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-background text-secondary-foreground hover:bg-muted"
      )}
    >
      {selected && <CheckIcon weight="bold" className="size-3" />}
      {label}
    </button>
  )
}

/**
 * The toolbar's silhouette while a list page is still loading: the search
 * field, the Filters button and the summary count, at the same size and in
 * the same slots as PageToolbar, so nothing shifts once the data lands. Sits
 * in the same StickyToolbar wrapper so the vertical rhythm matches too.
 */
export function PageToolbarSkeleton({
  filters = true,
  summary = true,
  className,
}: {
  filters?: boolean
  summary?: boolean
  className?: string
}) {
  return (
    <StickyToolbar className={className}>
      <div aria-hidden className="flex items-center gap-2">
        <Skeleton className="h-9 min-w-0 flex-1 sm:max-w-96" />
        {filters && <Skeleton className="h-9 w-[5.5rem]" />}
        {summary && <Skeleton className="ml-auto hidden h-3.5 w-20 sm:block" />}
      </div>
    </StickyToolbar>
  )
}
