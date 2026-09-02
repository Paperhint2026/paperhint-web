import { useEffect, useRef } from "react"
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react"

import { cn } from "@/lib/utils"
import { Sticker, type StickerName } from "@/components/shared/sticker"
import { PaperhintMark } from "@/components/shared/paperhint-mark"

/* The site's grain, as a data URI so the panel can carry it without a
   stylesheet of its own. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

/* Words the product actually does — the same loop-true vocabulary the site's
   band uses. Serif ones are the accents. */
const RIBBON: { text: string; serif?: boolean }[] = [
  { text: "question papers" },
  { text: "graded by", serif: true },
  { text: "hint" },
  { text: "knowledge library" },
  { text: "every", serif: true },
  { text: "answer sheet" },
  { text: "results" },
  { text: "in", serif: true },
  { text: "one place" },
]

/* Die-cuts floating over the panel: position, size, drift phase and how far
   they slide with the cursor (deeper ones move less). */
const FLOATERS: {
  name: StickerName
  x: string
  y: string
  size: number
  depth: number
  tilt: number
  delay: number
}[] = [
  { name: "star", x: "12%", y: "16%", size: 84, depth: 1, tilt: -8, delay: 0 },
  {
    name: "idea",
    x: "74%",
    y: "12%",
    size: 96,
    depth: 0.6,
    tilt: 6,
    delay: 0.8,
  },
  {
    name: "hint",
    x: "82%",
    y: "46%",
    size: 72,
    depth: 1.2,
    tilt: -4,
    delay: 1.6,
  },
  {
    name: "peace",
    x: "8%",
    y: "56%",
    size: 80,
    depth: 0.8,
    tilt: 10,
    delay: 0.4,
  },
  {
    name: "cloud",
    x: "56%",
    y: "30%",
    size: 64,
    depth: 0.4,
    tilt: 0,
    delay: 2.2,
  },
]

/**
 * The right-hand half of the login page: the marketing site's mood — near-white
 * ground, blurred brand blobs under grain, the H1 with its italic h, a looping
 * ribbon of what Paperhint does, and die-cut mascots that drift and lean
 * toward the cursor. The classroom gang sits along the bottom edge.
 */
export function LoginScene({ celebrating }: { celebrating: boolean }) {
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 60, damping: 20 })
  const sy = useSpring(my, { stiffness: 60, damping: 20 })

  useEffect(() => {
    const el = ref.current
    if (!el || reduceMotion) return
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      mx.set((e.clientX - r.left) / r.width - 0.5)
      my.set((e.clientY - r.top) / r.height - 0.5)
    }
    const onLeave = () => {
      mx.set(0)
      my.set(0)
    }
    el.addEventListener("mousemove", onMove)
    el.addEventListener("mouseleave", onLeave)
    return () => {
      el.removeEventListener("mousemove", onMove)
      el.removeEventListener("mouseleave", onLeave)
    }
  }, [mx, my, reduceMotion])

  return (
    <div
      ref={ref}
      className="relative isolate h-full w-full overflow-hidden bg-[#FCFBF8] dark:bg-[#0A0F0C]"
    >
      {/* Blurred brand blobs — the site's gradient map, kept quiet */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 overflow-hidden"
      >
        <span className="absolute -top-24 -left-20 size-[28rem] rounded-full bg-emerald-400/30 blur-3xl dark:bg-emerald-500/20" />
        <span className="absolute top-1/3 -right-24 size-[24rem] rounded-full bg-amber-300/35 blur-3xl dark:bg-amber-400/15" />
        <span className="absolute right-1/4 -bottom-32 size-[26rem] rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-500/15" />
        <span className="absolute bottom-1/4 -left-10 size-[18rem] rounded-full bg-orange-300/30 blur-3xl dark:bg-orange-400/10" />
      </div>
      {/* Grain over everything, click-through */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 opacity-[0.07] mix-blend-overlay dark:opacity-[0.11]"
        style={{ backgroundImage: GRAIN }}
      />

      {/* Floating die-cuts */}
      {FLOATERS.map((f) => (
        <Floater
          key={f.name}
          {...f}
          sx={sx}
          sy={sy}
          celebrating={celebrating}
        />
      ))}

      {/* The lockup */}
      <div className="absolute inset-x-0 top-[22%] flex flex-col items-center gap-5 px-10 text-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.6, rotate: -90 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="grid size-12 place-items-center"
        >
          <PaperhintMark className="size-12 text-primary" />
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="max-w-md text-[2.6rem] leading-[1.05] font-medium tracking-[-0.04em] text-balance text-[#10201A] dark:text-[#F2EEE3]"
        >
          Every teacher deserves a second pair of{" "}
          <em className="font-serif font-medium tracking-normal text-primary italic">
            h
          </em>
          ands.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="max-w-sm text-sm text-[#3D4F47] dark:text-[#C4CCC2]"
        >
          Build the paper, upload the sheets, let Hint do the first pass. You
          keep the judgement.
        </motion.p>
      </div>

      {/* Ribbon — the band's marquee, straightened */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-[60%] z-10 -rotate-3 overflow-hidden border-y border-primary/20 bg-primary py-2.5 text-primary-foreground shadow-[0_10px_30px_-12px_rgba(11,138,92,.5)]"
      >
        <div
          className={cn(
            "flex w-max whitespace-nowrap",
            !reduceMotion && "[animation:login-marquee_28s_linear_infinite]"
          )}
        >
          {[0, 1].map((copy) => (
            <span key={copy} className="flex items-center">
              {RIBBON.map((w, i) => (
                <span
                  key={`${copy}-${i}`}
                  className={cn(
                    "px-3 text-[15px] tracking-[0.02em]",
                    w.serif
                      ? "font-serif text-[16px] tracking-normal italic"
                      : "font-medium"
                  )}
                >
                  {w.text}
                  {!w.serif && (
                    <span className="ml-6 inline-block size-1 -translate-y-0.5 rounded-full bg-primary-foreground/60 align-middle" />
                  )}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* The gang along the floor */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="pointer-events-none absolute inset-x-0 -bottom-4 z-20 flex justify-center"
      >
        <Sticker
          name="classroom"
          size={620}
          className="max-w-[92%] drop-shadow-[0_12px_24px_rgba(16,32,26,.18)]"
        />
      </motion.div>
    </div>
  )
}

function Floater({
  name,
  x,
  y,
  size,
  depth,
  tilt,
  delay,
  sx,
  sy,
  celebrating,
}: (typeof FLOATERS)[number] & {
  sx: ReturnType<typeof useSpring>
  sy: ReturnType<typeof useSpring>
  celebrating: boolean
}) {
  const reduceMotion = useReducedMotion()
  const tx = useTransform(sx, (v) => v * 40 * depth)
  const ty = useTransform(sy, (v) => v * 30 * depth)
  return (
    <motion.div
      style={{ left: x, top: y, x: tx, y: ty }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={
        celebrating
          ? { opacity: 1, scale: [1, 1.25, 1], rotate: [0, -12, 12, 0] }
          : { opacity: 1, scale: 1 }
      }
      transition={
        celebrating
          ? { duration: 0.7, delay: delay * 0.1 }
          : {
              delay: 0.5 + delay * 0.25,
              type: "spring",
              stiffness: 200,
              damping: 16,
            }
      }
      className="absolute z-10 select-none"
    >
      <div
        style={
          {
            "--tilt": `${tilt}deg`,
            animationDelay: `${delay}s`,
          } as React.CSSProperties
        }
        className={cn(
          "drop-shadow-[0_8px_16px_rgba(16,32,26,.16)]",
          !reduceMotion && "[animation:login-float_5.5s_ease-in-out_infinite]"
        )}
      >
        <Sticker name={name} size={size} />
      </div>
    </motion.div>
  )
}
