import { cn } from "@/lib/utils"

export type StepStatus = "done" | "current" | "upcoming"

export type StepperStep = {
  key: string
  label: string
  hint: string
}

const NOTCH = 22

/**
 * A row of connected, arrow-shaped tab segments — a finished step filled dark
 * solid, the current step tinted, everything ahead plain — each carrying a
 * bold title and a lighter supporting line stacked inside the segment itself
 * (founder's reference, style "01"; not numbered circles — 2026-09-14).
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
    <ol className="flex w-full">
      {steps.map((step, i) => {
        const status: StepStatus =
          i < activeIndex ? "done" : i === activeIndex ? "current" : "upcoming"
        const reachable = i <= activeIndex
        const isFirst = i === 0
        const isLast = i === steps.length - 1

        const clipPath = isLast
          ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${NOTCH}px 50%)`
          : isFirst
            ? `polygon(0 0, calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0 100%)`
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
                "flex h-16 w-full flex-col justify-center gap-0.5 border py-2 pr-6 text-left transition-colors",
                status === "done" &&
                  "border-primary bg-primary text-primary-foreground",
                status === "current" &&
                  "border-primary bg-primary/10 text-foreground",
                status === "upcoming" &&
                  "border-border bg-background text-muted-foreground",
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
