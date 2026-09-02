import { useMemo, useState } from "react"
import {
  CaretDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function FilterChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <span className="inline-flex animate-in items-center gap-1 rounded-full border border-border bg-muted py-0.5 pr-1 pl-2.5 text-xs text-secondary-foreground duration-150 fade-in-0 zoom-in-95">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
        aria-label={`Remove ${label}`}
      >
        <XIcon className="size-3" />
      </button>
    </span>
  )
}

/** Chips for one filter category, led by its icon and name, so a long row of
 *  active values still reads as "three departments, one status". */
export function FilterChipGroup({
  icon: GroupIcon,
  label,
  children,
}: {
  icon?: Icon
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 pr-0.5 text-[11px] text-muted-foreground">
        {GroupIcon && <GroupIcon className="size-3.5" />}
        {label}
      </span>
      {children}
    </div>
  )
}

/** Section heading inside a filter popover — icon, label, optional clear. */
export function FilterFieldHeader({
  icon: HeaderIcon,
  label,
  count,
  onClear,
}: {
  icon?: Icon
  label: string
  count?: number
  onClear?: () => void
}) {
  return (
    <div className="flex h-5 items-center justify-between">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-secondary-foreground">
        {HeaderIcon && (
          <HeaderIcon className="size-3.5 text-muted-foreground" />
        )}
        {label}
        {count ? (
          <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
            {count}
          </span>
        ) : null}
      </Label>
      {onClear && count ? (
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear
        </button>
      ) : null}
    </div>
  )
}

export function MultiSelectField({
  icon,
  label,
  placeholder,
  options,
  selected,
  onToggle,
  onClear,
  searchable,
}: {
  icon?: Icon
  label: string
  placeholder: string
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
  onClear: () => void
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const visibleOptions = useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const selectedLabels = selected.map(
    (val) => options.find((o) => o.value === val)?.label ?? val
  )

  return (
    <div className="flex flex-col gap-2">
      <FilterFieldHeader
        icon={icon}
        label={label}
        count={selected.length}
        onClear={onClear}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-left text-sm transition-colors hover:bg-muted/50",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              open && "border-ring"
            )}
          >
            {/* One line, always: a summary instead of a chip pile that
                changes the trigger's height. */}
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                selected.length === 0
                  ? "text-muted-foreground"
                  : "text-foreground"
              )}
            >
              {selected.length === 0
                ? placeholder
                : selected.length <= 2
                  ? selectedLabels.join(", ")
                  : `${selectedLabels[0]} +${selected.length - 1} more`}
            </span>
            <CaretDownIcon
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => {
            if (!searchable) e.preventDefault()
          }}
          className="w-(--radix-popover-trigger-width) gap-0 p-0"
        >
          {searchable && (
            <div className="border-b border-border p-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          )}
          <div className="max-h-56 overflow-auto p-1">
            {visibleOptions.length === 0 ? (
              <p className="p-3 text-center text-xs text-muted-foreground">
                Nothing matches
              </p>
            ) : (
              visibleOptions.map((o, i) => {
                const isSelected = selected.includes(o.value)
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={isSelected}
                    onClick={() => onToggle(o.value)}
                    style={{ animationDelay: `${Math.min(i, 8) * 20}ms` }}
                    className="flex w-full animate-in items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm transition-colors duration-200 fade-in-0 fill-mode-backwards slide-in-from-top-1 hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background"
                      )}
                    >
                      {isSelected && (
                        <CheckIcon weight="bold" className="size-3" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "truncate",
                        isSelected
                          ? "text-foreground"
                          : "text-secondary-foreground"
                      )}
                    >
                      {o.label}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function toggleArrayValue(
  setter: React.Dispatch<React.SetStateAction<string[]>>,
  value: string
) {
  setter((prev) =>
    prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
  )
}
