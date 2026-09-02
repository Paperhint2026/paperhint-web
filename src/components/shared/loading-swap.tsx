import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * Crossfades a page body from its skeleton to the loaded content. Both sit in
 * the same grid cell, so the skeleton fades out over the arriving content
 * instead of popping away; the content itself rises in from a hair below,
 * matching PageTransition's entrance so the two motions feel like one system.
 *
 * `loading` decides which side is showing. Pass the skeleton as `skeleton`
 * and the real body as children; error and empty states go in children too,
 * since they also replace the skeleton.
 */
export function LoadingSwap({
  loading,
  skeleton,
  children,
  className,
}: {
  loading: boolean
  skeleton: ReactNode
  children: ReactNode
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const ease = [0.22, 1, 0.36, 1] as const

  return (
    <div className={cn("grid [&>*]:col-start-1 [&>*]:row-start-1", className)}>
      <AnimatePresence initial={false}>
        {loading ? (
          <motion.div
            key="skeleton"
            aria-hidden
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="pointer-events-none min-h-0 min-w-0"
          >
            {skeleton}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease }}
            className="flex min-h-0 min-w-0 flex-col"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
