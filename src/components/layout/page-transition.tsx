import type { ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * The page's scroll surface, remounted on every pathname change so the new
 * page fades and rises in from a hair below its resting spot. Making the
 * scroller itself the keyed element also resets scroll to the top for free.
 *
 * Enter-only on purpose: an exit animation would hold the old page on screen
 * after the click, which reads as lag rather than polish. Search-param and
 * hash changes keep the key, so in-page filters and tabs don't re-animate.
 */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const { pathname } = useLocation()
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      key={pathname}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "absolute inset-0 overflow-x-hidden overflow-y-auto",
        className
      )}
    >
      {children}
    </motion.div>
  )
}
