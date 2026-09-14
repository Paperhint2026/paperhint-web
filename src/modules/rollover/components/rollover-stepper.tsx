import { CheckIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

export type StepStatus = "done" | "current" | "upcoming"

export type StepperStep = {
  key: string
  label: string
  hint: string
}

/**
 * A numbered, connected stepper: a filled check for a finished step, a ringed
 * number for the one you're on, a plain number for what's ahead — with the
 * label and its one-line hint under each, and a line running between them
 * that fills in as you go. The wizard's whole shape at a glance.
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
    <ol className="flex items-start">
      {steps.map((step, i) => {
        const status: StepStatus =
          i < activeIndex ? "done" : i === activeIndex ? "current" : "upcoming"
        const reachable = i <= activeIndex
        return (
          <li
            key={step.key}
            className={cn("flex items-start", i < steps.length - 1 && "flex-1")}
          >
            <div className="flex flex-col items-center">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && onSelect(step.key)}
                aria-current={status === "current" ? "step" : undefined}
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-medium transition-colors",
                  status === "done" &&
                    "border-primary bg-primary text-primary-foreground",
                  status === "current" &&
                    "border-primary bg-background text-primary",
                  status === "upcoming" &&
                    "border-border bg-background text-muted-foreground",
                  reachable && status !== "current" && "cursor-pointer"
                )}
              >
                {status === "done" ? (
                  <CheckIcon weight="bold" className="size-4" />
                ) : (
                  i + 1
                )}
              </button>
              <div className="mt-2 flex flex-col items-center text-center">
                <span
                  className={cn(
                    "text-sm",
                    status === "upcoming"
                      ? "text-muted-foreground"
                      : "font-medium text-foreground"
                  )}
                >
                  {step.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {step.hint}
                </span>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                aria-hidden
                className={cn(
                  "mt-4 h-0.5 flex-1 rounded-full",
                  i < activeIndex ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
