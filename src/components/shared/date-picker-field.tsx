import { useState } from "react"
import { CalendarIcon } from "@phosphor-icons/react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * The app's date field — the same Popover + Calendar the student form uses,
 * instead of the browser's native date input. Value is a plain YYYY-MM-DD
 * string (what every API here speaks).
 */
export function DatePickerField({
  value,
  onChange,
  className,
  disableFuture = false,
}: {
  value: string
  onChange: (date: string) => void
  className?: string
  /** For fields like attendance where a future date makes no sense. */
  disableFuture?: boolean
}) {
  const [open, setOpen] = useState(false)
  const date = value ? new Date(value + "T00:00:00") : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="size-4" />
          {date ? format(date, "PPP") : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          disabled={disableFuture ? { after: new Date() } : undefined}
          selected={date}
          onSelect={(d) => {
            if (!d) return
            onChange(format(d, "yyyy-MM-dd"))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
