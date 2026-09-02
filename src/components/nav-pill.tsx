import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/** One spring for every sidebar pill, so the whole nav moves as one system. */
const PILL_SPRING = {
  type: "spring" as const,
  stiffness: 480,
  damping: 40,
  mass: 0.8,
}

/**
 * Cancels the fills the sidebar button paints for itself, so the sliding pills
 * are the only highlight on screen. Text weight and colour stay — only the
 * backgrounds, ring and shadow move to the pill.
 */
export const NAV_PILL_BUTTON_RESET =
  "relative z-10 hover:bg-transparent active:bg-transparent data-open:hover:bg-transparent data-active:bg-transparent data-active:ring-0"

/** Same idea for the nested section buttons, which carry no ring or shadow. */
export const NAV_PILL_SUB_BUTTON_RESET =
  "relative z-10 hover:bg-transparent active:bg-transparent"

/**
 * The id every top-level nav group shares, so the pill slides between them —
 * out of the main list, past a heading, and into the class list. Safe because
 * their paths are mutually exclusive: at most one item is ever active across
 * the three. Nested class sections keep their own id, since a section and the
 * class row above it are active at the same time, and two elements claiming
 * one layoutId produce garbage.
 */
export const NAV_GROUP = "nav"

/**
 * The two highlights that sit behind a nav button: a soft one that follows the
 * cursor and a raised one that marks the current page. Both are shared-layout
 * elements, so they slide between the items of a group instead of blinking
 * from one to the next.
 *
 * `groupId` scopes that sliding. Items only hand the pill to each other when
 * they share one — a highlight should never fly across a group heading, or out
 * of the main nav into a class's sections.
 *
 * Render this *before* the button inside a `relative` box. The button carries
 * `overflow-hidden`, so a pill drawn inside it would be clipped while it is
 * still travelling in from the previous item.
 */
export function NavPills({
  groupId,
  isActive,
  isHovered,
}: {
  groupId: string
  isActive: boolean
  isHovered: boolean
}) {
  const reduceMotion = useReducedMotion()
  const transition = reduceMotion ? { duration: 0 } : PILL_SPRING
  // Matches the sidebar button's own radius (Vega: rounded-md).
  const radius = "rounded-md"

  return (
    <>
      {/* Kept mounted under the active pill rather than skipped, so the cursor
          can drag it straight across the current page without it blinking.
          No AnimatePresence — an exiting pill would still be mounted, leaving
          two elements on one layoutId and a mis-placed hand-off. */}
      {isHovered ? (
        <motion.span
          aria-hidden
          layoutId={`${groupId}-hover`}
          transition={transition}
          className={cn(
            "pointer-events-none absolute inset-0 z-0 bg-sidebar-accent",
            radius
          )}
        />
      ) : null}
      {isActive ? (
        <motion.span
          aria-hidden
          layoutId={`${groupId}-active`}
          transition={transition}
          className={cn(
            "pointer-events-none absolute inset-0 z-0 bg-sidebar-active ring-1 ring-sidebar-border",
            radius
          )}
        />
      ) : null}
    </>
  )
}
