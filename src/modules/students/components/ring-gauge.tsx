import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { scoreTone, TONE_STROKE } from "../lib/marks"

/** A small ring that fills by percentage — a student's headline average. */
export function RingGauge({
  pct,
  size = 44,
  stroke = 4,
  className,
}: {
  pct: number | null
  size?: number
  stroke?: number
  className?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const filled = pct == null ? 0 : Math.min(100, Math.max(0, pct))
  const big = size >= 60
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn("relative shrink-0", className)}
          style={{ width: size, height: size }}
        >
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              className={cn(
                "stroke-muted",
                pct == null && "stroke-border [stroke-dasharray:2_3]"
              )}
            />
            {pct != null && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c - (c * filled) / 100}
                className={cn(
                  "transition-[stroke-dashoffset] duration-700 ease-out",
                  TONE_STROKE[scoreTone(pct)]
                )}
              />
            )}
          </svg>
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center font-semibold tabular-nums",
              big ? "text-lg" : "text-[11px]",
              pct == null ? "text-muted-foreground/60" : "text-foreground"
            )}
          >
            {pct == null ? "—" : `${Math.round(pct)}`}
            {pct != null && (
              <span
                className={cn(
                  "font-medium text-muted-foreground",
                  big ? "text-xs" : "text-[8px]"
                )}
              >
                %
              </span>
            )}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {pct == null
          ? "No graded papers yet"
          : `Average ${Math.round(pct)}% across graded papers`}
      </TooltipContent>
    </Tooltip>
  )
}
