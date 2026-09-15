import { cn } from "@/lib/utils"

export type StepStatus = "done" | "current" | "upcoming"

export type StepperStep = {
  key: string
  label: string
  hint: string
}

const NOTCH = 22
const H = 64 // must match the button's h-16
const R = 12 // must match the row's rounded-xl

/** Points along a quarter-circle arc, for a clip-path corner that actually
 * curves instead of leaving the outer rounded-xl to crop a sharp one. */
function arc(cx: number, cy: number, fromDeg: number, toDeg: number) {
  const steps = 8
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i <= steps; i++) {
    const deg = fromDeg + ((toDeg - fromDeg) * i) / steps
    const rad = (deg * Math.PI) / 180
    pts.push({ x: cx + R * Math.cos(rad), y: cy + R * Math.sin(rad) })
  }
  return pts
}

// Left corners in plain px (they sit near the fixed left edge); right
// corners as an offset from 100%, so the curve holds at any row width.
const topLeftArc = arc(R, R, 180, 270).map((p) => `${p.x}px ${p.y}px`)
const bottomLeftArc = arc(R, H - R, 90, 180).map((p) => `${p.x}px ${p.y}px`)
const topRightArc = arc(0, R, 270, 360).map(
  (p) => `calc(100% - ${R - p.x}px) ${p.y}px`
)
const bottomRightArc = arc(0, H - R, 0, 90).map(
  (p) => `calc(100% - ${R - p.x}px) ${p.y}px`
)

/**
 * A row of connected, arrow-shaped tab segments — a finished step filled dark
 * solid, the current step tinted, everything ahead plain — each carrying a
 * bold title and a lighter supporting line stacked inside the segment itself
 * (founder's reference, style "01"; not numbered circles — 2026-09-14).
 *
 * The row's own overflow-hidden rounds the strip's outer corners, but each
 * segment's clip-path polygon has straight corners of its own — cropped
 * against a rounded edge that isn't there, it leaves a visible notch out of
 * the ring. The first and last segment's outer corners are drawn as real
 * arcs instead, so the ring follows the same curve the row clips to.
 */
export function RolloverStepper({
  steps,
  activeKey,
  onSelect,
}: {
  steps: StepperStep[]
  activeKey: string
  onSelect: (key: string) => void
}) {
  const activeIndex = steps.findIndex((s) => s.key === activeKey)

  return (
    <ol className="flex w-full overflow-hidden rounded-xl">
      {steps.map((step, i) => {
        const status: StepStatus =
          i < activeIndex ? "done" : i === activeIndex ? "current" : "upcoming"
        const reachable = i <= activeIndex
        const isFirst = i === 0
        const isLast = i === steps.length - 1

        const clipPath = isLast
          ? `polygon(0 0, ${topRightArc.join(", ")}, ${bottomRightArc.join(", ")}, 0 100%, ${NOTCH}px 50%)`
          : isFirst
            ? `polygon(${topLeftArc.join(", ")}, calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%, ${bottomLeftArc.join(", ")})`
            : `polygon(0 0, calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0 100%, ${NOTCH}px 50%)`

        return (
          <li
            key={step.key}
            className="flex-1"
            style={{ marginLeft: isFirst ? 0 : -NOTCH }}
          >
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onSelect(step.key)}
              aria-current={status === "current" ? "step" : undefined}
              style={{ clipPath, paddingLeft: isFirst ? 16 : NOTCH + 10 }}
              className={cn(
                "flex h-16 w-full flex-col justify-center gap-0.5 py-2 pr-6 text-left ring-1 transition-colors ring-inset",
                status === "done" &&
                  "bg-gradient-to-br from-primary via-primary to-emerald-600 text-primary-foreground ring-transparent",
                status === "current" &&
                  "bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-foreground ring-primary/30",
                status === "upcoming" &&
                  "bg-muted/40 text-muted-foreground ring-border/60",
                reachable && status !== "current" && "cursor-pointer"
              )}
            >
              <span className="truncate text-sm font-semibold">
                {step.label}
              </span>
              <span
                className={cn(
                  "truncate text-xs",
                  status === "done"
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground"
                )}
              >
                {step.hint}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
