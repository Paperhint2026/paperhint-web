// src/modules/student-labels/components/label-chip.tsx
import * as React from "react"
import { XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface LabelChipProps {
  name: string
  color: string
  onRemove?: () => void
  className?: string
  removable?: boolean
}

export function LabelChip({
  name,
  color,
  onRemove,
  className,
  removable = false,
}: LabelChipProps) {
  return (
    <Badge
      className={cn(
        "pl-2 pr-2.5 flex items-center gap-1 cursor-default",
        !!color && "border-none",
        className
      )}
      style={color ? { backgroundColor: color, color: getContrast(color) } : {}}
    >
      {name}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove label ${name}`}
          className="ml-1.5 rounded-full hover:bg-black/10 p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
        >
          <XIcon className="size-4 text-muted-foreground" />
        </button>
      )}
    </Badge>
  )
}

// Color contrast helper: simple calculation for black/white text
function getContrast(bg: string): string {
  // Remove leading # if present
  if (bg.startsWith("#")) bg = bg.slice(1)
  // Expand short hex
  if (bg.length === 3) bg = bg.split("").map((x) => x + x).join("")
  if (bg.length !== 6) return "#1A1A1A" // fallback
  const r = parseInt(bg.slice(0, 2), 16)
  const g = parseInt(bg.slice(2, 4), 16)
  const b = parseInt(bg.slice(4, 6), 16)
  // YIQ relative luminance
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 128 ? "#1A1A1A" : "#fff"
}
