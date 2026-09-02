import { useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  ArrowUpIcon,
  BookOpenIcon,
  ChartLineIcon,
  DatabaseIcon,
  FileTextIcon,
  GraduationCapIcon,
  QuestionIcon,
  CircleNotchIcon,
  SidebarSimpleIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  type Icon,
} from "@phosphor-icons/react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { Sticker } from "@/components/shared/sticker"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth"
import { PaperhintMark } from "@/components/shared/paperhint-mark"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Chat {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  query_type?: "sql" | "rag" | "general" | "clarify" | null
  metadata?: Record<string, unknown>
  created_at: string
}

type Stage = "routing" | "querying" | "searching" | "thinking" | "done"

const STAGE_LABELS: Record<Stage, string> = {
  routing: "Understanding your question…",
  querying: "Querying the database…",
  searching: "Searching knowledge base…",
  thinking: "Writing response…",
  done: "",
}

const isMobile = () => window.innerWidth < 768

/* ------------------------------------------------------------------ */
/*  Typewriter                                                         */
/* ------------------------------------------------------------------ */

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("")
  const idx = useRef(0)

  useEffect(() => {
    idx.current = 0
    setDisplayed("")
    const speed = Math.max(3, Math.min(10, 1800 / text.length))
    const timer = setInterval(() => {
      idx.current += 1
      if (idx.current >= text.length) {
        setDisplayed(text)
        clearInterval(timer)
      } else {
        setDisplayed(text.slice(0, idx.current))
      }
    }, speed)
    return () => clearInterval(timer)
  }, [text])

  return <MarkdownBody content={displayed} />
}

/* ------------------------------------------------------------------ */
/*  Shared markdown renderer                                           */
/* ------------------------------------------------------------------ */

function MarkdownBody({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children, ...props }) => (
          <div className="my-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-[13px]" {...props}>
              {children}
            </table>
          </div>
        ),
        th: ({ children, ...props }) => (
          <th
            className="bg-muted/50 px-3 py-2 text-left text-xs font-semibold"
            {...props}
          >
            {children}
          </th>
        ),
        td: ({ children, ...props }) => (
          <td className="border-t px-3 py-2 text-[13px]" {...props}>
            {children}
          </td>
        ),
        p: ({ children, ...props }) => (
          <p className="mb-3 last:mb-0" {...props}>
            {children}
          </p>
        ),
        ul: ({ children, ...props }) => (
          <ul className="mb-3 list-disc pl-5 last:mb-0" {...props}>
            {children}
          </ul>
        ),
        ol: ({ children, ...props }) => (
          <ol className="mb-3 list-decimal pl-5 last:mb-0" {...props}>
            {children}
          </ol>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

/* ------------------------------------------------------------------ */
/*  Stage indicator                                                    */
/* ------------------------------------------------------------------ */

function StageIndicator({ stage }: { stage: Stage }) {
  if (stage === "done") return null
  return (
    // Laid out as an assistant turn — same mark, same gap, same text column —
    // so the wait reads as Hint starting to reply rather than a status chip.
    <div className="flex gap-3">
      <PaperhintMark className="mt-0.5 size-5 shrink-0 animate-spin text-primary [animation-duration:1.8s] motion-reduce:animate-none" />
      <span className="[animation:text-shimmer_2.2s_linear_infinite] bg-[linear-gradient(90deg,var(--color-muted-foreground)_0%,var(--color-foreground)_50%,var(--color-muted-foreground)_100%)] bg-[length:200%_auto] bg-clip-text text-sm leading-relaxed text-transparent motion-reduce:[animation:none]">
        {STAGE_LABELS[stage]}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Suggestions                                                        */
/* ------------------------------------------------------------------ */

/** Short chip labels; the prompt is what actually lands in the composer. */
const SUGGESTIONS: { icon: Icon; label: string; prompt: string }[] = [
  {
    icon: FileTextIcon,
    label: "Draft a test",
    prompt:
      "Draft a 25-mark unit test for Grade 8 Science on the last chapter.",
  },
  {
    icon: ChartLineIcon,
    label: "Explain results",
    prompt:
      "Summarise how the last exam went — the average, and where the class struggled.",
  },
  {
    icon: BookOpenIcon,
    label: "Explain a concept",
    prompt: "Explain photosynthesis in terms a Grade 6 student would follow.",
  },
  {
    icon: GraduationCapIcon,
    label: "Who needs help",
    prompt: "Which students are falling behind, and in which subjects?",
  },
]

/**
 * Fades a chat title out over its last 2rem instead of clipping it, so a long
 * name trails off under the delete button rather than colliding with it.
 * A fixed tail via calc, not a percentage — the fade should be the same width
 * on every row regardless of how long the title is.
 */
const TITLE_FADE = {
  maskImage: "linear-gradient(to right, black calc(100% - 2rem), transparent)",
  WebkitMaskImage:
    "linear-gradient(to right, black calc(100% - 2rem), transparent)",
}

/** Resting gap between the anchored prompt and the top of the scroll area. */
const ANCHOR_TOP_GAP = 16

/**
 * Self-driven smooth scroll to a fixed target. Deliberately not
 * `scrollTo({ behavior: "smooth" })`: the reply lands right after and changes
 * the scroll height, which cancels a native smooth scroll mid-flight so it
 * never arrives. A manual tween to a fixed target is immune — the reply grows
 * *below* the target, which does not move it.
 */
function tweenScrollTop(
  el: HTMLElement,
  target: number,
  rafRef: React.RefObject<number | null>
) {
  if (rafRef.current) cancelAnimationFrame(rafRef.current)
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    el.scrollTop = target
    return
  }
  const start = el.scrollTop
  const dist = target - start
  if (Math.abs(dist) < 1) {
    el.scrollTop = target
    return
  }
  const t0 = performance.now()
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
  const tick = (now: number) => {
    const t = Math.min(1, (now - t0) / 320)
    el.scrollTop = start + dist * easeOutCubic(t)
    rafRef.current = t < 1 ? requestAnimationFrame(tick) : null
  }
  rafRef.current = requestAnimationFrame(tick)
}

/** Cycled through the composer's placeholder, one every few seconds. */
const PLACEHOLDERS = [
  "Draft a 20-mark test on the water cycle…",
  "Which students slipped in the last exam?",
  "Explain refraction for a Grade 7 class…",
  "Summarise Chapter 4 into revision notes…",
  "How did 9A do in the last Science test?",
  "Who has not submitted their answer sheet?",
]

/**
 * The composer's placeholder. A native `placeholder` cannot animate, so the
 * hint is drawn as its own layer and the textarea's own placeholder is left
 * empty; `aria-label` on the textarea carries the accessible name instead.
 *
 * Sits behind the textarea in DOM order and is pointer-events-none, so clicks
 * still land on the field.
 */
function RotatingPlaceholder({ visible }: { visible: boolean }) {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!visible || reduceMotion) return
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % PLACEHOLDERS.length),
      3600
    )
    return () => clearInterval(timer)
  }, [visible, reduceMotion])

  if (!visible) return null

  return (
    <div className="pointer-events-none absolute top-3.5 left-4 h-6 overflow-hidden text-sm leading-6 text-muted-foreground/60">
      {reduceMotion ? (
        <span>{PLACEHOLDERS[0]}</span>
      ) : (
        // mode="wait" so the outgoing line clears before the next slides in,
        // rather than the two crossing over each other.
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={index}
            className="block whitespace-nowrap"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.4, 0, 0.2, 1] }}
          >
            {PLACEHOLDERS[index]}
          </motion.span>
        </AnimatePresence>
      )}
    </div>
  )
}

/**
 * Graph paper, lifted from the marketing site's own note-paper styles
 * (paperhint-site, style.css `.np-grid.np-alt`) — repeating boxes in the brand
 * green. On a product called PaperHint, squared notebook paper says more than
 * an abstract dot grid.
 */
const GRID = (alpha: number) =>
  [
    `repeating-linear-gradient(0deg, transparent 0 29px, color-mix(in oklch, var(--color-primary) ${alpha}%, transparent) 29px 30px)`,
    `repeating-linear-gradient(90deg, transparent 0 29px, color-mix(in oklch, var(--color-primary) ${alpha}%, transparent) 29px 30px)`,
  ].join(", ")

/**
 * Margin scribbles hidden in the paper — only readable inside the cursor
 * spotlight, like pencil notes catching the light. Positions are percentages
 * of the band; each note leans a little, the way real annotations do.
 */
const EASTER_EGGS: { text: string; x: string; y: string; tilt: number }[] = [
  { text: "marking day ☕", x: "6%", y: "22%", tilt: -3 },
  { text: "a² + b² = c²", x: "22%", y: "58%", tilt: 2 },
  { text: "silence, exam in progress…", x: "38%", y: "18%", tilt: -1.5 },
  { text: "photosynthesis ≠ magic. almost.", x: "55%", y: "70%", tilt: 2.5 },
  { text: "re-check Q7, everyone slipped", x: "68%", y: "30%", tilt: -2 },
  { text: "E = mc²", x: "84%", y: "56%", tilt: 3 },
  { text: "the hint is in the margins ✏️", x: "44%", y: "44%", tilt: 1 },
]

/**
 * Fades the paper down into the page and off at both sides — the same
 * three-edge treatment as the bottom band, so the two decorations belong to
 * one system rather than looking like separate ideas.
 */
const PATTERN_MASK = [
  "linear-gradient(to bottom, black 0%, black 30%, transparent 92%)",
  "linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)",
].join(", ")

/**
 * The paper backdrop, plus a hidden layer — brighter boxes and the margin
 * notes — revealed in a soft circle around the cursor. The pointer position is written straight to CSS custom
 * properties on the element — putting it in React state would re-render the
 * whole panel on every mousemove.
 */
function PaperPattern({
  ref,
}: {
  ref: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[45%] overflow-hidden"
      style={
        {
          maskImage: PATTERN_MASK,
          WebkitMaskImage: PATTERN_MASK,
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        } as React.CSSProperties
      }
    >
      <div
        className="absolute inset-0"
        style={{ backgroundImage: GRID(17), backgroundSize: "30px 30px" }}
      />
      {/* Everything below only exists inside the cursor spotlight: brighter
          boxes plus the hidden margin notes. One shared mask, so the notes
          surface exactly as the paper brightens. */}
      <div
        className="absolute inset-0 opacity-[calc(var(--spot,0)*0.95)] transition-opacity duration-300 motion-reduce:hidden"
        style={
          {
            maskImage:
              "radial-gradient(260px circle at var(--mx, 50%) var(--my, 0px), black 0%, black 32%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(260px circle at var(--mx, 50%) var(--my, 0px), black 0%, black 32%, transparent 80%)",
          } as React.CSSProperties
        }
      >
        <div
          className="absolute inset-0"
          style={{ backgroundImage: GRID(50), backgroundSize: "30px 30px" }}
        />
        {EASTER_EGGS.map((egg) => (
          <span
            key={egg.text}
            className="absolute font-serif text-sm whitespace-nowrap text-muted-foreground italic select-none"
            style={{
              left: egg.x,
              top: egg.y,
              transform: `rotate(${egg.tilt}deg)`,
            }}
          >
            {egg.text}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Fades the decorative band into the page on three edges — see its usage. */
const MASK = [
  "linear-gradient(to top, black 55%, transparent 100%)",
  "linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)",
].join(", ")

/** How an answer was produced. Neutral by design — it is a footnote, not a
 *  status to be colour-coded. */
function SourceNote({
  icon: IconComponent,
  label,
  detail,
}: {
  icon: Icon
  label: string
  detail?: string
}) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <IconComponent aria-hidden className="size-3" />
      <span>{label}</span>
      {detail ? (
        <span className="rounded bg-muted px-1.5 py-0.5 tabular-nums">
          {detail}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Stand-in rows while the chat list loads. Row height and inset match the real
 * rows exactly so the list settles in place rather than jumping. Widths vary
 * the way real titles do, and taper off so the list reads as ending.
 */
const SKELETON_WIDTHS = ["82%", "64%", "74%", "56%", "70%", "48%"]

function ChatListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      {SKELETON_WIDTHS.map((width, i) => (
        <div key={i} className="mx-2 mb-px flex h-8 items-center pr-2 pl-2.5">
          <Skeleton className="h-3 rounded" style={{ width }} />
        </div>
      ))}
    </div>
  )
}

/** Same spring as the sidebar nav, so both rails move at one speed. */
const PILL_SPRING = {
  type: "spring" as const,
  stiffness: 480,
  damping: 40,
  mass: 0.8,
}

/**
 * Sliding highlights behind a chat row. Drawn as siblings of the row rather
 * than inside it, so a pill travelling between rows is not clipped by the one
 * it is leaving.
 */
function ChatPills({
  isActive,
  isHovered,
}: {
  isActive: boolean
  isHovered: boolean
}) {
  const reduceMotion = useReducedMotion()
  const transition = reduceMotion ? { duration: 0 } : PILL_SPRING

  return (
    <>
      {/* No AnimatePresence: an exiting pill stays mounted through its exit,
          so for a few frames two elements would claim one layoutId and the
          hand-off lands in the wrong place. Unmounting immediately lets
          Motion treat it as one element moving. */}
      {isHovered ? (
        <motion.span
          aria-hidden
          layoutId="chat-rail-hover"
          transition={transition}
          className="pointer-events-none absolute inset-0 z-0 rounded-md bg-foreground/5"
        />
      ) : null}
      {isActive ? (
        <motion.span
          aria-hidden
          layoutId="chat-rail-active"
          transition={transition}
          className="pointer-events-none absolute inset-0 z-0 rounded-md bg-foreground/10"
        />
      ) : null}
    </>
  )
}

/**
 * The prompt box. It sits centred under the greeting on an empty chat and
 * docks to the bottom once the conversation starts — same component either
 * way, so the two never drift apart.
 */
function Composer({
  inputRef,
  value,
  onChange,
  onKeyDown,
  onSend,
  isAsking,
  autoFocus,
  rotatePlaceholder,
  placeholder,
  glow,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  isAsking: boolean
  autoFocus?: boolean
  /** Cycle through suggestions — for the landing state only. */
  rotatePlaceholder?: boolean
  /** Static hint, used when not rotating. */
  placeholder?: string
  /** Orbiting green highlight — landing state only. */
  glow?: boolean
}) {
  const canSend = Boolean(value.trim()) && !isAsking

  return (
    // The border is painted by the wrapper, not by a `border` on the card: a
    // green arc orbits it, so the edge has to be a layer the arc can sit in.
    // overflow-hidden clips the spinning square back to the rounded rect.
    <div className="group/composer relative w-full overflow-hidden rounded-xl bg-foreground/15 p-px shadow-sm">
      {glow ? (
        <div
          aria-hidden
          // A conic gradient on a square wider than the box, spun by rotating
          // the element itself — no @property needed, so it works everywhere.
          className="absolute top-1/2 left-1/2 aspect-square w-[140%] -translate-x-1/2 -translate-y-1/2 animate-spin opacity-70 [animation-duration:5s] motion-reduce:hidden"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0%, var(--color-primary) 12%, transparent 28%)",
          }}
        />
      ) : null}
      <div // Inner radius must be the wrapper's minus the 1px border, or the card
        // overshoots the clip at 45° and swallows the ring at each corner.
        // rounded-xl is --radius * 1.4, so that is what this tracks.
        className="relative flex w-full flex-col rounded-[calc(var(--radius)*1.4-1px)] bg-card"
      >
        <div className="relative">
          {rotatePlaceholder ? (
            <RotatingPlaceholder visible={value.length === 0} />
          ) : null}
          <textarea
            ref={inputRef}
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => {
              onChange(e.target.value)
              const el = e.target
              el.style.height = "auto"
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`
            }}
            onKeyDown={onKeyDown}
            // The rotating variant draws its own hint layer, so the native
            // placeholder stays empty there and aria-label carries the name.
            placeholder={rotatePlaceholder ? undefined : placeholder}
            aria-label="Ask Hint about your classes"
            rows={1}
            className="relative max-h-40 min-h-[46px] w-full resize-none overflow-y-auto bg-transparent px-4 pt-3.5 text-sm leading-6 outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="flex items-center justify-end px-2.5 pb-2.5">
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
              canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground/40"
            )}
          >
            {isAsking ? (
              <CircleNotchIcon className="size-4 animate-spin" />
            ) : (
              <ArrowUpIcon className="size-4" weight="bold" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                         */
/* ------------------------------------------------------------------ */

export function CopilotPanel({
  initialChatId,
  initialPrompt = null,
}: {
  /** Thread to open, from /ask/c/:chatId. null = the landing page. */
  initialChatId: string | null
  /** Pre-fills the composer — the home page hands suggested prompts in here. */
  initialPrompt?: string | null
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const firstName = user?.full_name?.split(" ")[0] ?? "there"
  const [chats, setChats] = useState<Chat[]>([])
  const [chatsLoading, setChatsLoading] = useState(true)
  const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState(initialPrompt ?? "")
  const [isAsking, setIsAsking] = useState(false)
  const [stage, setStage] = useState<Stage>("done")
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile())
  const [latestAnswer, setLatestAnswer] = useState<string | null>(null)

  const [hoveredChat, setHoveredChat] = useState<string | null>(null)
  const reduceMotion = useReducedMotion()

  // Cursor spotlight over the paper backdrop. Positions are written straight
  // to CSS custom properties on the node — a mousemove handler that went
  // through React state would re-render the whole panel on every pixel.
  const patternRef = useRef<HTMLDivElement>(null)
  const spot = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    tx: 0,
    ty: 0,
    /** Timestamp of the last real mouse move; the cursor leads while recent. */
    manual: 0,
    lastEgg: -1,
    raf: 0,
  })

  const trackPointer = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = patternRef.current
    if (!el) return
    const box = el.getBoundingClientRect()
    const sp = spot.current
    sp.manual = Date.now()
    sp.tx = e.clientX - box.left
    sp.ty = e.clientY - box.top
  }

  // An untouched chat shows the centred greeting instead of a transcript.
  const isEmpty = messages.length === 0 && stage === "done"

  /**
   * One continuously running loop. The light never settles: with no cursor it
   * steers between the margin notes at a steady speed, so it reads exactly
   * like someone slowly dragging the pointer around rather than hopping from
   * stop to stop. A plain lerp toward a target was the earlier mistake — it
   * decelerates on approach, which is what made it look like stepping.
   */
  useEffect(() => {
    if (!isEmpty) return
    const el = patternRef.current
    if (!el) return
    const sp = spot.current
    const first = el.getBoundingClientRect()

    const aimAtNote = (box: DOMRect) => {
      let i = Math.floor(Math.random() * EASTER_EGGS.length)
      if (i === sp.lastEgg) i = (i + 1) % EASTER_EGGS.length
      sp.lastEgg = i
      const egg = EASTER_EGGS[i]
      // x/y anchor the note's top-left; aim near the middle of the phrase,
      // with jitter so repeat visits never land identically.
      sp.tx =
        (parseFloat(egg.x) / 100) * box.width + 70 + (Math.random() - 0.5) * 70
      sp.ty =
        (parseFloat(egg.y) / 100) * box.height + 8 + (Math.random() - 0.5) * 44
    }

    sp.x = first.width * 0.5
    sp.y = first.height * 0.45
    aimAtNote(first)
    el.style.setProperty("--spot", "1")

    const frame = () => {
      const node = patternRef.current
      if (!node) return
      const box = node.getBoundingClientRect()
      const led = Date.now() - sp.manual < 2500

      if (led) {
        // Following a real cursor: ease in, which feels like a trailing light.
        sp.x += (sp.tx - sp.x) * 0.16
        sp.y += (sp.ty - sp.y) * 0.16
        sp.vx = 0
        sp.vy = 0
      } else {
        const dx = sp.tx - sp.x
        const dy = sp.ty - sp.y
        const dist = Math.hypot(dx, dy) || 1
        // Re-aim well before arriving, so speed never drops to zero.
        if (dist < 120) aimAtNote(box)
        // Steer toward the target rather than snapping heading: the direction
        // change eases in, which curves the path instead of kinking it.
        const speed = 1.15
        sp.vx += ((dx / dist) * speed - sp.vx) * 0.035
        sp.vy += ((dy / dist) * speed - sp.vy) * 0.035
        sp.x += sp.vx
        sp.y += sp.vy
      }

      node.style.setProperty("--mx", `${sp.x}px`)
      node.style.setProperty("--my", `${sp.y}px`)
      sp.raf = requestAnimationFrame(frame)
    }

    sp.raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(sp.raf)
  }, [isEmpty])

  const initRef = useRef(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const convScrollRef = useRef<HTMLDivElement>(null)
  // Anchor-to-top: on send, the user's prompt is pinned near the top so the
  // reply renders in full view beneath it, instead of both being shoved up
  // from the bottom. The tail spacer gives the prompt somewhere to scroll to
  // while the reply is still short.
  const tailSpacerRef = useRef<HTMLDivElement>(null)
  const anchorKeyRef = useRef<string | null>(null)
  const anchorPendingRef = useRef(false)
  const anchorTweenRef = useRef<number | null>(null)
  const atBottomRef = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Runs before paint and writes scrollTop directly — scrollIntoView ran after
  // paint (a one-frame jerk) and could nudge ancestor scrollers too.
  useLayoutEffect(() => {
    const el = convScrollRef.current
    if (!el) return
    if (isEmpty) {
      // Nothing to follow on the landing screen, and any scrollTop here would
      // fight the centred greeting.
      el.scrollTop = 0
      return
    }
    const spacer = tailSpacerRef.current
    if (!spacer) return
    const anchorKey = anchorKeyRef.current

    const anchorEl = anchorKey
      ? el.querySelector<HTMLElement>(`[data-msg-key="${anchorKey}"]`)
      : null
    // A set key whose node is gone means the transcript changed under us —
    // drop the anchor and fall through to follow-bottom instead of freezing.
    if (anchorKey && !anchorEl) anchorKeyRef.current = null

    if (anchorEl) {
      // Measure against the spacer's CURRENT height — collapsing it first
      // makes the browser clamp scrollTop while the content is briefly
      // shorter, and restoring the height does not restore the position.
      const curSpacer = spacer.offsetHeight
      const anchorTopNow = () =>
        el.scrollTop +
        (anchorEl.getBoundingClientRect().top - el.getBoundingClientRect().top)

      let anchorTop = anchorTopNow()
      let sp = Math.max(
        0,
        el.clientHeight - (el.scrollHeight - curSpacer - anchorTop)
      )
      spacer.style.height = `${sp}px`
      // Second pass off the settled layout: writing the spacer can compress
      // the content above it, which would leave the first estimate short and
      // stop the prompt reaching the top.
      anchorTop = anchorTopNow()
      sp = Math.max(
        0,
        el.clientHeight - (el.scrollHeight - spacer.offsetHeight - anchorTop)
      )
      spacer.style.height = `${sp}px`

      if (anchorPendingRef.current) {
        anchorPendingRef.current = false
        const maxScroll = el.scrollHeight - el.clientHeight
        tweenScrollTop(
          el,
          Math.min(maxScroll, Math.max(0, anchorTop - ANCHOR_TOP_GAP)),
          anchorTweenRef
        )
      }
      atBottomRef.current =
        el.scrollHeight - sp - el.scrollTop - el.clientHeight < 120
      return
    }

    // Default: follow the bottom (thread opened, or the user scrolled down).
    spacer.style.height = "0px"
    if (atBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages, stage, isEmpty])

  // Streaming/typewriter changes content without firing scroll events, so this
  // only tracks real user scrolling; the layout effect recomputes the rest.
  useEffect(() => {
    const el = convScrollRef.current
    if (!el) return
    const onScroll = () => {
      const spacerH = tailSpacerRef.current?.offsetHeight ?? 0
      atBottomRef.current =
        el.scrollHeight - spacerH - el.scrollTop - el.clientHeight < 120
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [isEmpty])

  useEffect(() => {
    setSidebarOpen(!isMobile())

    const init = async () => {
      if (initRef.current) return
      initRef.current = true

      try {
        // /ask is always a fresh chat; /ask/c/:id opens that thread. The rail
        // list loads either way.
        if (initialChatId) await fetchMessages(initialChatId)
        const res = await apiClient.get<{ chats: Chat[] }>("/api/copilot/chats")
        setChats(res.chats ?? [])
      } catch {
        /* ignore — an empty rail is a reasonable failure state here */
      } finally {
        setChatsLoading(false)
      }

      setTimeout(() => inputRef.current?.focus(), 300)
    }

    init()
  }, [initialChatId])

  /* ---- API helpers ---- */

  const fetchChats = async () => {
    try {
      const res = await apiClient.get<{ chats: Chat[] }>("/api/copilot/chats")
      setChats(res.chats ?? [])
    } catch {
      /* ignore */
    }
  }

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await apiClient.get<{ messages: Message[] }>(
        `/api/copilot/chats/${chatId}/messages`
      )
      setMessages(res.messages ?? [])
    } catch {
      /* ignore */
    }
  }

  const createNewChat = async () => {
    try {
      const res = await apiClient.post<{ chat: Chat }>("/api/copilot/chats")
      setChats((prev) => [res.chat, ...prev])
      setActiveChatId(res.chat.id)
      setMessages([])
      setLatestAnswer(null)
      return res.chat.id
    } catch {
      return null
    }
  }

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await apiClient.delete(`/api/copilot/chats/${chatId}`)
      const remaining = chats.filter((c) => c.id !== chatId)
      setChats(remaining)

      if (activeChatId === chatId) {
        if (remaining.length > 0) {
          setActiveChatId(remaining[0].id)
          await fetchMessages(remaining[0].id)
        } else {
          setActiveChatId(null)
          setMessages([])
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Landing and thread are separate PAGES. Opening either navigates, and the
  // page keys this panel on location.key — a full remount, so no scroll,
  // anchor, spacer or stage state can leak from one view into the other.
  const selectChat = (chat: Chat) => {
    navigate(`/ask/c/${chat.id}`)
  }

  const handleNewChat = () => {
    navigate("/ask")
  }

  /* ---- Send ---- */

  const handleSend = async () => {
    const q = input.trim()
    if (!q || isAsking) return

    let chatId = activeChatId
    if (!chatId) {
      chatId = await createNewChat()
      if (!chatId) return
    }

    setInput("")
    setLatestAnswer(null)

    const userKey = `temp-${Date.now()}`
    // Pin this prompt near the top so the reply renders below it in full view.
    // The one-time scroll happens in the layout effect, once it is in the DOM.
    anchorKeyRef.current = userKey
    anchorPendingRef.current = true
    atBottomRef.current = false
    const userMsg: Message = {
      id: userKey,
      role: "user",
      content: q,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setIsAsking(true)
    setStage("routing")

    const fallbackTimer = setTimeout(() => setStage("thinking"), 2000)

    try {
      const res = await apiClient.post<{
        answer: string
        query_type: string
        metadata: Record<string, unknown>
      }>(`/api/copilot/chats/${chatId}/ask`, { query: q })

      clearTimeout(fallbackTimer)

      if (res.query_type === "sql") {
        setStage("querying")
        await new Promise((r) => setTimeout(r, 500))
      } else if (res.query_type === "rag") {
        setStage("searching")
        await new Promise((r) => setTimeout(r, 500))
      }
      setStage("thinking")
      await new Promise((r) => setTimeout(r, 300))

      const assistantMsg: Message = {
        id: `temp-a-${Date.now()}`,
        role: "assistant",
        content: res.answer,
        query_type: res.query_type as Message["query_type"],
        metadata: res.metadata,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      setLatestAnswer(res.answer)
      setStage("done")
      fetchChats()
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `temp-err-${Date.now()}`,
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          created_at: new Date().toISOString(),
        },
      ])
      setStage("done")
      clearTimeout(fallbackTimer)
    } finally {
      setIsAsking(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /* ---- Render ---- */

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-10 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      {/* Always present, so the page keeps one shape whether the list is
          loading, empty or full. Each of those states fills the same column. */}
      <div
        className={cn(
          "flex shrink-0 flex-col border-r bg-background transition-transform duration-300",
          "absolute inset-y-0 left-0 z-20 w-72",
          "md:relative md:inset-auto md:z-auto md:w-64 md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* px-2 + the label's px-2.5 puts "Chats" on the same 18px text
            origin as the rows below, which sit at mx-2 + pl-2.5. */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b px-2">
          <span className="px-2.5 text-xs font-medium text-muted-foreground">
            Chats
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleNewChat}
                aria-label="New chat"
                className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <PlusIcon aria-hidden className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>
        </div>

        <div
          className="flex-1 overflow-y-auto py-2"
          onMouseLeave={() => setHoveredChat(null)}
        >
          <LoadingSwap loading={chatsLoading} skeleton={<ChatListSkeleton />}>
            {chats.length === 0 ? (
              <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
                <Sticker name="greet" size={72} />
                <p className="text-[13px] font-medium text-foreground">
                  No conversations yet
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Ask Hint something and it will show up here.
                </p>
              </div>
            ) : (
              chats.map((chat) => (
                // Delete sits beside the row rather than inside it — a button
                // nested in a button is invalid, and left the row unreachable
                // by keyboard.
                <div
                  key={chat.id}
                  className="group relative mx-2 mb-px flex items-center"
                  onMouseEnter={() => setHoveredChat(chat.id)}
                >
                  {/* The fills live on the sliding pills now, so the row itself
                    only carries text colour and weight. */}
                  <ChatPills
                    isActive={activeChatId === chat.id}
                    isHovered={hoveredChat === chat.id}
                  />
                  <button
                    type="button"
                    onClick={() => selectChat(chat)}
                    // Focus drives the same key as hover, so tabbing reveals the
                    // delete button and moves the pill with it.
                    onFocus={() => setHoveredChat(chat.id)}
                    className={cn(
                      "relative z-10 flex h-8 min-w-0 flex-1 items-center rounded-md pr-2 pl-2.5 text-left text-[13px] transition-colors outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring",
                      activeChatId === chat.id
                        ? "font-medium text-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {/* `truncate` on a flex container does nothing —
                      text-overflow does not apply to one. The title needs its
                      own box, and it fades rather than clipping. */}
                    <span
                      className="min-w-0 flex-1 overflow-hidden whitespace-nowrap"
                      style={TITLE_FADE}
                    >
                      {chat.title}
                    </span>
                  </button>
                  {/* In flow beside the title, not overlaid: the title is
                    flex-1, so it simply gives up the width when this appears
                    and can never run underneath it. */}
                  {hoveredChat === chat.id ? (
                    <button
                      type="button"
                      onClick={(e) => deleteChat(chat.id, e)}
                      aria-label={`Delete ${chat.title}`}
                      className="relative z-10 mr-1 grid size-6 shrink-0 place-items-center rounded text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <TrashIcon aria-hidden className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </LoadingSwap>
        </div>
      </div>

      {/* ── Main area ── */}
      <div
        className="relative flex min-w-0 flex-1 flex-col"
        onMouseMove={isEmpty ? trackPointer : undefined}
      >
        {/* No top bar. The only control it held was the mobile drawer
            toggle, which floats instead so it costs no vertical space. */}
        {sidebarOpen ? null : (
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open chat list"
            className="absolute top-3 left-3 z-10 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted md:hidden"
          >
            <SidebarSimpleIcon className="size-4" />
          </button>
        )}

        {/* Messages */}
        {isEmpty ? <PaperPattern ref={patternRef} /> : null}

        {/* Decorative band behind the greeting. Masked to fade out toward the
            top so the sky blends into the page instead of ending on a hard
            edge, and dimmed in dark mode where a bright sky would shout. */}
        {isEmpty ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[32%] overflow-hidden"
          >
            {/* The book stack sits on the hill crest, so the crop is anchored
                at 70% down the image rather than object-bottom — the bottom
                edge would cut the crest away. The mask then holds the lower
                ~60% solid to keep the books readable and dissolves only across
                the top, where the sky needs to disappear into the page. */}
            <img
              src="/ask-hint-scene.jpg"
              alt=""
              className="size-full object-cover object-[center_70%] opacity-60 dark:opacity-30"
              // Two masks intersected rather than one: the vertical fade hides
              // the sky at the top, the horizontal one dissolves both side
              // edges. Intersect keeps only what both leave opaque, so the
              // centre — where the book stack sits — stays solid.
              style={{
                maskImage: MASK,
                WebkitMaskImage: MASK,
                maskComposite: "intersect",
                WebkitMaskComposite: "source-in",
              }}
            />
          </div>
        ) : null}

        <div
          ref={convScrollRef}
          className="relative z-10 flex-1 overflow-y-auto"
        >
          <div
            className={cn(
              "mx-auto w-full max-w-3xl px-4",
              // min-h-full + justify-center centres the greeting while it fits
              // and lets it scroll normally from the top when it does not.
              // Centring on the scroll container itself (align-items or an auto
              // margin) puts the overflow ABOVE the scroll origin, where it
              // cannot be reached — that is what was clipping the logo.
              isEmpty ? "flex min-h-full flex-col justify-center py-10" : "py-6"
            )}
          >
            {isEmpty ? (
              <div className="flex flex-col items-center gap-7">
                <PaperhintMark className="size-10 text-primary" />

                {/* Set entirely in Merriweather, with one word in italic —
                    the same roman/italic pairing the wordmark uses. */}
                <h2 className="text-center font-serif text-[28px] leading-snug font-medium tracking-tight text-balance text-foreground">
                  Hi <em className="text-primary italic">{firstName}</em>, how
                  can I help?
                </h2>

                {/* Shares a layoutId with the docked composer below: on the
                    first send the landing state unmounts, the docked one
                    mounts, and Motion plays that as one box gliding to the
                    bottom of the page. */}
                <motion.div
                  layoutId="composer-dock"
                  transition={reduceMotion ? { duration: 0 } : PILL_SPRING}
                  className="w-full"
                >
                  <Composer
                    inputRef={inputRef}
                    value={input}
                    onChange={setInput}
                    onKeyDown={handleKeyDown}
                    onSend={handleSend}
                    isAsking={isAsking}
                    autoFocus
                    rotatePlaceholder
                    glow
                  />
                </motion.div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        setInput(s.prompt)
                        setTimeout(() => inputRef.current?.focus(), 50)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <s.icon aria-hidden className="size-3.5" />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg, i) => {
                  const isLatest =
                    msg.role === "assistant" &&
                    i === messages.length - 1 &&
                    msg.content === latestAnswer

                  if (msg.role === "user") {
                    return (
                      <div
                        key={msg.id}
                        data-msg-key={msg.id}
                        className="flex justify-end"
                      >
                        <div className="max-w-[80%] rounded-xl bg-muted px-3.5 py-2.5 text-sm text-foreground">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={msg.id}
                      data-msg-key={msg.id}
                      className="flex gap-3"
                    >
                      <PaperhintMark className="mt-0.5 size-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1 text-sm leading-relaxed">
                        {/* Where the answer came from — a SQL read of school
                            data, the Knowledge Library, or a question back.
                            One neutral treatment for all three. */}
                        {msg.query_type === "sql" ? (
                          <SourceNote
                            icon={DatabaseIcon}
                            label="Database query"
                            detail={
                              msg.metadata?.row_count != null
                                ? `${String(msg.metadata.row_count)} rows`
                                : undefined
                            }
                          />
                        ) : null}
                        {msg.query_type === "rag" ? (
                          <SourceNote
                            icon={MagnifyingGlassIcon}
                            label="Knowledge Library"
                          />
                        ) : null}
                        {msg.query_type === "clarify" ? (
                          <SourceNote
                            icon={QuestionIcon}
                            label="Needs clarification"
                          />
                        ) : null}
                        <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-pre:bg-muted prose-pre:text-foreground max-w-none">
                          {isLatest ? (
                            <TypewriterText text={msg.content} />
                          ) : (
                            <MarkdownBody content={msg.content} />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {stage !== "done" && <StageIndicator stage={stage} />}
                <div ref={messagesEndRef} />
                {/* Sized by the layout effect so the anchored prompt can reach
                    the top even while the reply is still short. */}
                <div ref={tailSpacerRef} aria-hidden className="shrink-0" />
              </div>
            )}
          </div>
        </div>

        {/* Docked composer — the greeting already carries one when empty. */}
        {isEmpty ? null : (
          <div className="shrink-0 bg-background px-4 pb-4">
            <div className="mx-auto max-w-3xl">
              <motion.div
                layoutId="composer-dock"
                transition={reduceMotion ? { duration: 0 } : PILL_SPRING}
              >
                <Composer
                  inputRef={inputRef}
                  value={input}
                  onChange={setInput}
                  onKeyDown={handleKeyDown}
                  onSend={handleSend}
                  isAsking={isAsking}
                  placeholder="Ask a follow-up…"
                />
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
