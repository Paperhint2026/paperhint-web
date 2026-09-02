import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * The marketing site's band (paperhint-site `main.js` `Band()` + `style.css`
 * `.hero-ribbon`), rebuilt for the app: a thick ink stroke on a curve drawn to
 * fit its box, an emerald echo peeking out beneath it like the ribbon's back
 * face, and a line of copy riding the curve as a seamless marquee. Near the
 * cursor each word lifts, tilts and swells on a travelling sine field, done
 * with attributes rather than SVG filters so it holds 60fps.
 *
 * Words are plain strings; wrap one in `*stars*` to set it in the accent
 * colour, the way the site marks its keywords. The band stays decorative:
 * `aria-hidden`, and the copy it carries should also exist as real text.
 */

export type RibbonWord = string

const SVGNS = "http://www.w3.org/2000/svg"
/** Headroom above and below the box so the stroke is never shaved. */
const PAD_Y = 28
/** Reach of the cursor ripple, in band units. */
const RIPPLE_R = 120

type WordNode = {
  el: SVGTSpanElement
  start: number
  w: number
  e: number
  on: boolean
}

/** A gentle S through a short band: enters low left, crests, exits high right. */
function sweepPath(W: number, H: number) {
  const X = (n: number) => (n * W).toFixed(1)
  const Y = (n: number) => (n * H).toFixed(1)
  return (
    `M ${X(-0.04)} ${Y(0.36)}` +
    ` C ${X(0.12)} ${Y(1.02)}, ${X(0.26)} ${Y(1.02)}, ${X(0.42)} ${Y(0.6)}` +
    ` C ${X(0.58)} ${Y(0.18)}, ${X(0.74)} ${Y(-0.02)}, ${X(1.04)} ${Y(0.52)}`
  )
}

/** A single arch from the bottom corners up through the middle. */
function archPath(W: number, H: number) {
  const p = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`
  const apex = Math.max(20, H * 0.18)
  return (
    `M ${p(W * 1.05, H + 20)}` +
    ` C ${p(W * 0.78, H * 0.6)}, ${p(W * 0.72, apex)}, ${p(W * 0.5, apex)}` +
    ` C ${p(W * 0.28, apex)}, ${p(W * 0.22, H * 0.6)}, ${p(W * -0.05, H + 20)}`
  )
}

function parseWord(raw: string): { text: string; accent: boolean } {
  const kw = raw.length > 2 && raw.startsWith("*") && raw.endsWith("*")
  return { text: kw ? raw.slice(1, -1) : raw, accent: kw }
}

export function InkRibbon({
  words,
  shape = "sweep",
  height = 96,
  speed = 22,
  strokeWidth = 30,
  fontSize,
  className,
}: {
  /** The copy that rides the band. `*word*` sets it in the accent colour. */
  words: RibbonWord[]
  shape?: "sweep" | "arch"
  /** Box height in px. The curve is fitted to it. */
  height?: number
  /** Marquee speed, in band units per second. */
  speed?: number
  strokeWidth?: number
  /** Copy size in px; the stylesheet's 13px when omitted. */
  fontSize?: number
  className?: string
}) {
  const id = useId()
  const pathId = `ink-ribbon-${id.replace(/:/g, "")}`
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const guideRef = useRef<SVGPathElement>(null)
  const inkRef = useRef<SVGPathElement>(null)
  const echoRef = useRef<SVGPathElement>(null)
  const textRef = useRef<SVGTextElement>(null)
  const tpRef = useRef<SVGTextPathElement>(null)
  const reduceMotion = useReducedMotion()

  const [width, setWidth] = useState(0)
  const [fontsReady, setFontsReady] = useState(false)

  // Geometry lives in a ref: the frame loop reads it without re-rendering.
  const geom = useRef({
    total: 0,
    unitLen: 0,
    baseSize: 13,
    words: [] as WordNode[],
  })
  const wordsKey = words.join(" ")

  /* ---- measure the box ---- */
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width))
    })
    ro.observe(el)
    setWidth(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])

  /* Text metrics are wrong until the font is in; lay out again once it is. */
  useEffect(() => {
    let cancelled = false
    const ready = document.fonts?.ready ?? Promise.resolve()
    ready.then(() => {
      if (!cancelled) setFontsReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /* ---- draw the curve and fill the marquee ---- */
  useLayoutEffect(() => {
    const svg = svgRef.current
    const guide = guideRef.current
    const ink = inkRef.current
    const echo = echoRef.current
    const text = textRef.current
    const tp = tpRef.current
    if (!svg || !guide || !ink || !echo || !text || !tp || !width) return

    const W = width
    const H = height
    const d = shape === "arch" ? archPath(W, H) : sweepPath(W, H)
    svg.setAttribute("viewBox", `0 ${-PAD_Y} ${W} ${H + PAD_Y * 2}`)
    for (const p of [guide, ink, echo]) p.setAttribute("d", d)

    const g = geom.current
    g.total = guide.getTotalLength()
    for (const p of [ink, echo]) {
      p.style.setProperty("--len", String(Math.ceil(p.getTotalLength()) + 4))
    }
    g.baseSize = parseFloat(getComputedStyle(text).fontSize) || 13

    // One unit of copy, repeated until it covers the curve plus one spare so
    // the loop is seamless at any offset.
    const unit = () => {
      const frag = document.createDocumentFragment()
      for (const raw of words) {
        const { text: t, accent } = parseWord(raw)
        const span = document.createElementNS(SVGNS, "tspan")
        if (accent) span.setAttribute("class", "ink-ribbon-kw")
        span.textContent = `${t} `
        frag.appendChild(span)
      }
      return frag
    }
    tp.textContent = ""
    tp.appendChild(unit())
    g.unitLen = tp.getComputedTextLength()
    if (!g.unitLen) {
      g.words = []
      return
    }
    const reps = Math.ceil((g.total + g.unitLen) / g.unitLen) + 1
    for (let r = 1; r < reps; r++) tp.appendChild(unit())

    let chars = 0
    g.words = Array.from(tp.querySelectorAll("tspan")).map((el) => {
      const node: WordNode = {
        el,
        start: tp.getSubStringLength(0, chars),
        w: el.getComputedTextLength(),
        e: 0,
        on: false,
      }
      chars += el.textContent?.length ?? 0
      return node
    })
    // `words` is covered by `wordsKey`; listing it too would relayout on every
    // parent render when callers build the array inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, shape, wordsKey, fontsReady, fontSize])

  /* ---- the frame loop: marquee + cursor ripple ---- */
  useEffect(() => {
    const svg = svgRef.current
    const guide = guideRef.current
    const tp = tpRef.current
    if (!svg || !guide || !tp) return

    const canWarp =
      !reduceMotion &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches

    let cur: { x: number; y: number } | null = null
    let live = false

    const onMove = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect()
      if (!r.width) {
        cur = null
        return
      }
      const near =
        e.clientX > r.left - 40 &&
        e.clientX < r.right + 40 &&
        e.clientY > r.top - 40 &&
        e.clientY < r.bottom + 40
      if (!near) {
        cur = null
        return
      }
      const vb = svg.viewBox.baseVal
      cur = {
        x: (e.clientX - r.left) * (vb.width / r.width),
        y: (e.clientY - r.top) * (vb.height / r.height) + vb.y,
      }
      live = true
    }
    const onLeave = () => {
      cur = null
    }
    if (canWarp) {
      window.addEventListener("pointermove", onMove, { passive: true })
      document.documentElement.addEventListener("mouseleave", onLeave)
    }

    let raf = 0
    let t0: number | null = null
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      const g = geom.current
      if (!g.unitLen) return
      if (t0 === null) t0 = t
      const el = (t - t0) / 1000
      const offset = reduceMotion ? 0 : -((el * speed) % g.unitLen)
      tp.setAttribute("startOffset", offset.toFixed(1))

      if (!canWarp || (!cur && !live)) return
      let prev = 0
      let anyOn = false
      for (const w of g.words) {
        let target = 0
        const arc = w.start + offset + w.w / 2
        if (cur && arc >= 0 && arc <= g.total) {
          const pt = guide.getPointAtLength(arc)
          const dist = Math.hypot(pt.x - cur.x, pt.y - cur.y)
          if (dist < RIPPLE_R) {
            const k = 1 - dist / RIPPLE_R
            target = k * k * (3 - 2 * k)
          }
        }
        // Energy rises fast and ebbs slowly: the wake behind the cursor.
        w.e = target > w.e ? w.e + (target - w.e) * 0.34 : w.e * 0.94
        if (w.e < 0.004) w.e = 0

        if (w.e) {
          anyOn = true
          const ph = arc * 0.055 + el * 3.4
          const lift = -7 * w.e * (0.55 + 0.45 * Math.sin(ph))
          const spin = 8 * w.e * Math.sin(ph * 0.8 + 1.1)
          // dy inside a textPath is cumulative: write the delta from the
          // previous word so the baseline self-corrects.
          w.el.setAttribute("dy", (lift - prev).toFixed(2))
          prev = lift
          w.el.setAttribute("rotate", spin.toFixed(1))
          w.el.setAttribute(
            "font-size",
            (g.baseSize * (1 + 0.22 * w.e)).toFixed(2)
          )
          w.el.style.fill =
            w.e > 0.5
              ? "var(--ink-ribbon-kw)"
              : w.e > 0.1
                ? "var(--primary)"
                : ""
          w.on = true
        } else if (w.on) {
          w.el.setAttribute("dy", (0 - prev).toFixed(2))
          prev = 0
          w.el.removeAttribute("rotate")
          w.el.removeAttribute("font-size")
          w.el.style.fill = ""
          w.on = false
        }
      }
      if (!anyOn && !cur) live = false
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      if (canWarp) {
        window.removeEventListener("pointermove", onMove)
        document.documentElement.removeEventListener("mouseleave", onLeave)
      }
    }
  }, [speed, reduceMotion])

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={cn(
        "ink-ribbon pointer-events-none relative w-full overflow-hidden select-none",
        className
      )}
      style={{ height }}
    >
      <svg
        ref={svgRef}
        focusable="false"
        preserveAspectRatio="none"
        className="absolute inset-x-0 block w-full"
        style={{ top: -PAD_Y, height: height + PAD_Y * 2 }}
      >
        <path
          ref={echoRef}
          className="ink-ribbon-echo"
          strokeWidth={strokeWidth}
        />
        <path
          ref={inkRef}
          className="ink-ribbon-ink"
          strokeWidth={strokeWidth}
        />
        <path ref={guideRef} id={pathId} fill="none" stroke="none" />
        <text
          ref={textRef}
          className="ink-ribbon-text"
          style={fontSize ? { fontSize } : undefined}
        >
          <textPath ref={tpRef} href={`#${pathId}`} />
        </text>
      </svg>
    </div>
  )
}
