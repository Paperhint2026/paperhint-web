import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * Building blocks every settings section shares, so the page reads as one
 * system: a titled card, and rows that put the label and its explanation on
 * the left with the control on the right (the Plain / StackAI pattern).
 */

export function SettingsCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  /** Optional bar under the rows — actions, or a note about the card. */
  footer?: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-background",
        className
      )}
    >
      <header className="flex flex-col gap-0.5 px-5 pt-5 pb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className="flex flex-col divide-y divide-border border-t border-border">
        {children}
      </div>
      {footer ? (
        <footer className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-3">
          {footer}
        </footer>
      ) : null}
    </section>
  )
}

export function SettingsRow({
  label,
  hint,
  htmlFor,
  children,
  align = "center",
}: {
  label: string
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
  /** `start` for tall controls so the label stays at the top. */
  align?: "center" | "start"
}) {
  return (
    <div
      className={cn(
        "grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-8",
        align === "center" ? "sm:items-center" : "sm:items-start"
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
        {hint ? (
          <span className="text-xs leading-relaxed text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </div>
  )
}

/** The rise-in every section plays as it becomes the visible one. */
export function SectionMotion({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-5"
    >
      {children}
    </motion.div>
  )
}
