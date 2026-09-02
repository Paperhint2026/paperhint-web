import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { InkRibbon, type RibbonWord } from "@/components/shared/ink-ribbon"
import { PaperhintMark } from "@/components/shared/paperhint-mark"
import { PaperhintWordmark } from "@/components/shared/paperhint-wordmark"

/**
 * Cold-start splash, shown on every full page load (first visit, hard refresh).
 * Client-side navigation never triggers it — that has its own transition.
 *
 * Lifted from the marketing site's boot (paperhint-site `style.css`
 * `.nav-boot` / `.nav-arrive` and the hero band): the ink ribbon draws itself
 * across the ground carrying a running line of what Paperhint does, and a
 * collapsed pill drops in from above the viewport onto it with the rosette
 * spinning inside. Once the app is ready the pill exhales open to reveal the
 * wordmark while the mark takes one decelerating turn, then the whole splash
 * lifts away as the content card underneath comes up to meet it.
 *
 * Readiness = fonts loaded + a minimum hold, so the sequence always plays out
 * fully and never flashes on a warm cache.
 */

/** Never shorter than this: long enough for the ribbon to finish drawing. */
const MIN_HOLD_MS = 1500
/** How long the exhale plays before the splash releases. */
const ARRIVE_MS = 700
/** Fonts can hang on a bad network; don't hold the app hostage. */
const FONTS_TIMEOUT_MS = 2500

type Phase = "boot" | "arrive" | "done"

const DROP = { type: "spring" as const, stiffness: 260, damping: 26, mass: 1 }
const EXHALE = { duration: 0.55, ease: [0.22, 0.9, 0.28, 1] as const }

/**
 * The site's band copy, verbatim, so the app opens on the same sentence. Kept
 * generic on purpose: nothing has loaded yet, so the splash makes no claims
 * about who is signed in or what is waiting for them.
 */
const BAND: RibbonWord[] = [
  "*Teaching*",
  "is",
  "the",
  "*job*",
  "—",
  "Paperhint",
  "drafts",
  "the",
  "*teaching*",
  "*notes,*",
  "sets",
  "the",
  "*question*",
  "*papers,*",
  "keeps",
  "the",
  "*parents*",
  "posted,",
  "and",
  "marks",
  "every",
  "*answer*",
  "*sheet*",
  "·",
]

function waitForFonts() {
  const fonts = document.fonts?.ready ?? Promise.resolve()
  const timeout = new Promise<void>((resolve) =>
    window.setTimeout(resolve, FONTS_TIMEOUT_MS)
  )
  return Promise.race([fonts.then(() => undefined), timeout])
}

export function AppBootSplash() {
  const [phase, setPhase] = useState<Phase>("boot")
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    let cancelled = false
    const hold = new Promise<void>((resolve) =>
      window.setTimeout(resolve, MIN_HOLD_MS)
    )
    Promise.all([hold, waitForFonts()]).then(() => {
      if (cancelled) return
      setPhase("arrive")
      window.setTimeout(() => {
        if (!cancelled) setPhase("done")
      }, ARRIVE_MS)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const arrived = phase !== "boot"

  return (
    <AnimatePresence>
      {phase !== "done" ? (
        <motion.div
          key="boot-splash"
          role="status"
          aria-live="polite"
          aria-label="Loading PaperHint"
          className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-sidebar"
          initial={false}
          // The ground lifts away as it fades, so the card beneath reads as
          // rising up into place rather than simply being uncovered.
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: 0.25 } }
              : {
                  opacity: 0,
                  scale: 1.03,
                  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
                }
          }
        >
          {/* The band sweeps the full width behind the pill, sized to the
              viewport so it reads as one gesture across the whole screen. */}
          <InkRibbon
            words={BAND}
            height={Math.round(
              Math.min(360, Math.max(200, window.innerHeight * 0.32))
            )}
            strokeWidth={42}
            fontSize={18}
            speed={30}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2"
          />

          <motion.div
            className="relative z-10 flex h-12 items-center gap-2.5 overflow-hidden rounded-full border bg-background pr-2 pl-2 shadow-lg shadow-black/10"
            initial={reduceMotion ? { opacity: 0 } : { y: -200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={
              reduceMotion ? { duration: 0.3 } : { ...DROP, delay: 0.25 }
            }
          >
            <span className="grid size-8 shrink-0 place-items-center text-primary">
              {/* Boot: a steady linear spin. Arrive: one decelerating turn on the
                  same clock as the exhale, landing upright. */}
              <motion.span
                key={arrived ? "arrive" : "boot"}
                className="grid size-6 place-items-center"
                animate={{ rotate: 360 }}
                transition={
                  arrived
                    ? { duration: 0.8, ease: [0.3, 0.8, 0.24, 1] }
                    : reduceMotion
                      ? { duration: 0 }
                      : { duration: 1, ease: "linear", repeat: Infinity }
                }
              >
                <PaperhintMark className="size-6" />
              </motion.span>
            </span>

            {/* The exhale: the wordmark's slot grows from nothing to its own
                width, and the letters fade up a beat behind the edge. */}
            <motion.span
              className="flex min-w-0 items-center overflow-hidden"
              initial={{ width: 0, opacity: 0 }}
              animate={
                arrived
                  ? { width: "auto", opacity: 1 }
                  : { width: 0, opacity: 0 }
              }
              transition={{
                ...EXHALE,
                opacity: { duration: 0.3, delay: arrived ? 0.15 : 0 },
              }}
            >
              <PaperhintWordmark className="pr-2 text-[19px] leading-none text-foreground" />
            </motion.span>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
