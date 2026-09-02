import { useState, type ComponentType } from "react"
import { motion, useReducedMotion } from "motion/react"
import type { IconProps } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

export type SettingsSectionId = "profile" | "security" | "appearance"

export type SettingsSection = {
  id: SettingsSectionId
  label: string
  hint: string
  icon: ComponentType<IconProps>
}

/** One spring for the pill, matching the sidebar so the two rails agree. */
const PILL_SPRING = {
  type: "spring" as const,
  stiffness: 480,
  damping: 40,
  mass: 0.8,
}

/**
 * The section rail. A column on wide screens and a scrolling row on narrow
 * ones, with one shared-layout pill that slides between items instead of
 * blinking from one to the next.
 */
export function SettingsNav({
  sections,
  active,
  onChange,
}: {
  sections: SettingsSection[]
  active: SettingsSectionId
  onChange: (id: SettingsSectionId) => void
}) {
  const reduceMotion = useReducedMotion()
  const transition = reduceMotion ? { duration: 0 } : PILL_SPRING
  const [hovered, setHovered] = useState<SettingsSectionId | null>(null)

  return (
    <nav
      aria-label="Settings sections"
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
      onMouseLeave={() => setHovered(null)}
    >
      {sections.map((s) => {
        const isActive = s.id === active
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            aria-current={isActive ? "page" : undefined}
            onMouseEnter={() => setHovered(s.id)}
            onFocus={() => setHovered(s.id)}
            className={cn(
              "group relative flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {/* Two shared-layout pills, as in the sidebar: a soft one that
                follows the cursor and a raised one on the open section. The
                hover pill stays mounted under the active one so the cursor
                can pass straight over the current item without it blinking. */}
            {hovered === s.id ? (
              <motion.span
                aria-hidden
                layoutId="settings-nav-hover"
                transition={transition}
                className="absolute inset-0 rounded-lg bg-muted"
              />
            ) : null}
            {isActive ? (
              <motion.span
                aria-hidden
                layoutId="settings-nav-pill"
                transition={transition}
                className="absolute inset-0 rounded-lg bg-background shadow-xs ring-1 ring-border"
              />
            ) : null}
            <s.icon
              weight={isActive ? "fill" : "regular"}
              className={cn(
                "relative z-10 size-4 shrink-0 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            />
            <span className="relative z-10 flex flex-col leading-tight">
              <span className={cn(isActive && "font-medium")}>{s.label}</span>
              <span className="hidden text-[11px] text-muted-foreground lg:block">
                {s.hint}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
