import { useEffect, useMemo, useState } from "react"
import { ClockIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * The app's one time picker — Material-style hour | minute | AM/PM columns in
 * a popover. Extracted from the calendar's event dialog so every surface
 * (calendar events, bell schedule, …) shows the same UI instead of the
 * browser's native control.
 */

export function formatTimeLabel(t: string) {
  const [h, m] = t.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i))
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => i * 5)

/** One scrollable column of the time picker. */
function TimeColumn<T extends string | number>({
  options,
  value,
  onSelect,
  render = (v: T) => String(v),
}: {
  options: T[]
  value: T | null
  onSelect: (v: T) => void
  render?: (v: T) => string
}) {
  return (
    <div
      className="flex max-h-56 flex-col gap-0.5 overflow-y-auto overscroll-contain p-1"
      onWheel={(e) => {
        // The dialog's scroll lock can swallow wheel events in a portalled
        // popover — drive the column's own scroll directly so each column
        // always scrolls independently.
        e.currentTarget.scrollTop += e.deltaY
        e.stopPropagation()
      }}
    >
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          onClick={() => onSelect(o)}
          aria-pressed={value === o}
          className={cn(
            "min-w-12 rounded-md px-2.5 py-1.5 text-center text-sm transition-colors tabular-nums",
            value === o
              ? "bg-primary font-medium text-primary-foreground"
              : "text-secondary-foreground hover:bg-muted"
          )}
        >
          {render(o)}
        </button>
      ))}
    </div>
  )
}

/** Empty value = unset ("all-day" in the calendar); Clear returns to it when
 *  `clearable` (required fields like the bell schedule pass false). */
export function TimeSelectField({
  value,
  onChange,
  placeholder,
  disabled = false,
  minTime,
  clearable = true,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  disabled?: boolean
  minTime?: string
  clearable?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [hour, setHour] = useState<number | null>(null)
  const [minute, setMinute] = useState<number | null>(null)
  const [meridiem, setMeridiem] = useState<"AM" | "PM" | null>(null)

  // seed the columns from the current value (or a sensible default) on open
  useEffect(() => {
    if (!open) return
    if (value) {
      const [h, m] = value.split(":").map(Number)
      setHour(h % 12 === 0 ? 12 : h % 12)
      setMinute(m)
      setMeridiem(h >= 12 ? "PM" : "AM")
    } else {
      setHour(9)
      setMinute(0)
      setMeridiem("AM")
    }
  }, [open, value])

  const composed = useMemo(() => {
    if (hour == null || minute == null || meridiem == null) return null
    let h24 = hour % 12
    if (meridiem === "PM") h24 += 12
    return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  }, [hour, minute, meridiem])

  const tooEarly = composed != null && minTime != null && composed <= minTime

  // a stored value at a non-5-minute mark (hand-edited row) still shows as a
  // selectable option instead of an unmatchable one
  const minuteOptions = useMemo(() => {
    if (minute == null || MINUTES_5.includes(minute)) return MINUTES_5
    return [...MINUTES_5, minute].sort((a, b) => a - b)
  }, [minute])

  const apply = () => {
    if (!composed || tooEarly) return
    onChange(composed)
    setOpen(false)
  }

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          data-empty={!value}
          className={cn(
            "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          <ClockIcon className="size-4 shrink-0" />
          {value ? formatTimeLabel(value) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex divide-x divide-border">
          <TimeColumn
            options={HOURS_12}
            value={hour}
            onSelect={setHour}
            render={(h) => String(h).padStart(2, "0")}
          />
          <TimeColumn
            options={minuteOptions}
            value={minute}
            onSelect={setMinute}
            render={(m) => String(m).padStart(2, "0")}
          />
          <TimeColumn
            options={["AM", "PM"] as const}
            value={meridiem}
            onSelect={setMeridiem}
          />
        </div>
        {tooEarly && (
          <p className="border-t border-border px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
            Must be after {formatTimeLabel(minTime!)}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
          {clearable ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => {
                onChange("")
                setOpen(false)
              }}
            >
              Clear
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={apply}
              disabled={!composed || tooEarly}
            >
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
