import { useMemo, useState } from "react"
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function FilterChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted py-0.5 pl-2.5 pr-1 text-xs text-secondary-foreground">
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

export function MultiSelectField({
  label,
  placeholder,
  options,
  selected,
  onToggle,
  onClear,
  searchable,
}: {
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1 text-left text-sm transition-colors hover:bg-muted/50"
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {selected.length === 0 ? (
                <span className="px-1 text-muted-foreground">
                  {placeholder}
                </span>
              ) : (
                selected.map((val) => {
                  const opt = options.find((o) => o.value === val)
                  return (
                    <span
                      key={val}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted py-0.5 pl-2 pr-1 text-xs text-secondary-foreground"
                    >
                      {opt?.label ?? val}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggle(val)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            e.stopPropagation()
                            onToggle(val)
                          }
                        }}
                        className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                        aria-label={`Remove ${opt?.label ?? val}`}
                      >
                        <XIcon className="size-3" />
                      </span>
                    </span>
                  )
                })
              )}
            </div>
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[--radix-popover-trigger-width] p-0"
        >
          {searchable && (
            <div className="border-b border-border p-2">
              <div className="relative">
                <SearchIcon className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}...`}
                  className="h-8 pl-7 text-xs"
                />
              </div>
            </div>
          )}
          <div className="max-h-56 overflow-auto p-1">
            {visibleOptions.length === 0 ? (
              <p className="p-3 text-center text-xs text-muted-foreground">
                No options
              </p>
            ) : (
              visibleOptions.map((o) => {
                const isSelected = selected.includes(o.value)
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onToggle(o.value)}
                    className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span>{o.label}</span>
                    {isSelected && <CheckIcon className="size-3.5 text-primary" />}
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
  value: string,
) {
  setter((prev) =>
    prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
  )
}
