import { useMemo, useState } from "react"
import {
  CaretDownIcon,
  ChalkboardIcon,
  CheckIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  XIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ClassSubjectOption {
  class_subject_id: string
  label: string
  hint?: string
}

interface ClassSubjectMultiSelectProps {
  options: ClassSubjectOption[]
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  /** Always-on entries, shown checked and locked. */
  disabledIds?: Set<string>
  /** Small tag on a locked entry, e.g. "Uploaded here". */
  lockedLabel?: string
  /** Small tag on the first selected entry, e.g. "Primary". */
  firstLabel?: string
  placeholder?: string
  emptyLabel?: string
}

/**
 * Class picker used by the upload flow and the share dialog. A dropdown
 * field: the trigger shows what is chosen as removable chips, the popover
 * holds a search box and a checkbox list, so it reads the same with three
 * classes or thirty.
 */
export function ClassSubjectMultiSelect({
  options,
  value,
  onChange,
  disabled,
  disabledIds,
  lockedLabel = "Locked",
  firstLabel,
  placeholder = "Choose classes…",
  emptyLabel = "No other classes to link.",
}: ClassSubjectMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const byId = useMemo(
    () => new Map(options.map((o) => [o.class_subject_id, o])),
    [options]
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const locked = options.filter((o) => disabledIds?.has(o.class_subject_id))
  const chosen = value
    .map((id) => byId.get(id))
    .filter((o): o is ClassSubjectOption => Boolean(o))

  const toggle = (id: string) => {
    if (disabled || disabledIds?.has(id)) return
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
    )
  }

  if (options.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
        {emptyLabel}
      </p>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex min-h-10 w-full items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/40",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            open && "border-ring",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {locked.map((o) => (
              <span
                key={o.class_subject_id}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                <LockSimpleIcon className="size-3" />
                {o.label}
              </span>
            ))}
            {chosen.length === 0 && locked.length === 0 ? (
              <span className="px-0.5 text-muted-foreground">
                {placeholder}
              </span>
            ) : (
              chosen.map((o, i) => (
                <span
                  key={o.class_subject_id}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 py-0.5 pr-1 pl-1.5 text-xs text-foreground"
                >
                  {o.label}
                  {i === 0 && firstLabel && (
                    <span className="rounded-full bg-primary/10 px-1 text-[10px] font-medium text-primary">
                      {firstLabel}
                    </span>
                  )}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${o.label}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggle(o.class_subject_id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        e.stopPropagation()
                        toggle(o.class_subject_id)
                      }
                    }}
                    className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                  >
                    <XIcon className="size-3" />
                  </span>
                </span>
              ))
            )}
          </div>
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
        className="w-(--radix-popover-trigger-width) gap-0 p-0"
      >
        <div className="border-b border-border p-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${options.length} classes…`}
              aria-label="Search classes"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto p-1">
          {visible.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">
              No class matches "{query.trim()}"
            </p>
          ) : (
            visible.map((opt, i) => {
              const isLocked = disabledIds?.has(opt.class_subject_id) ?? false
              const selected = isLocked || value.includes(opt.class_subject_id)
              const isFirst = !isLocked && value[0] === opt.class_subject_id
              const row = (
                <button
                  key={opt.class_subject_id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={selected}
                  disabled={isLocked}
                  onClick={() => toggle(opt.class_subject_id)}
                  style={{ animationDelay: `${Math.min(i, 8) * 20}ms` }}
                  className={cn(
                    "flex w-full animate-in items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-200 fade-in-0 fill-mode-backwards slide-in-from-top-1",
                    isLocked ? "cursor-default" : "hover:bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background"
                    )}
                  >
                    {selected && <CheckIcon weight="bold" className="size-3" />}
                  </span>
                  <ChalkboardIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      selected ? "text-foreground" : "text-secondary-foreground"
                    )}
                  >
                    {opt.label}
                  </span>
                  {isLocked ? (
                    <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                      <LockSimpleIcon className="size-3" />
                      {lockedLabel}
                    </span>
                  ) : isFirst && firstLabel ? (
                    <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">
                      {firstLabel}
                    </span>
                  ) : null}
                </button>
              )
              if (!opt.hint) return row
              return (
                <Tooltip key={opt.class_subject_id}>
                  <TooltipTrigger asChild>{row}</TooltipTrigger>
                  <TooltipContent side="right">{opt.hint}</TooltipContent>
                </Tooltip>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-sidebar px-3 py-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {locked.length + chosen.length} of {options.length} selected
          </span>
          {chosen.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="transition-colors hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
