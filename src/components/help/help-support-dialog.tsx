import { useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowUpRightIcon,
  BugBeetleIcon,
  ChatCircleDotsIcon,
  CircleNotchIcon,
  EnvelopeSimpleIcon,
  KeyboardIcon,
  LightbulbIcon,
  MagnifyingGlassIcon,
  PaperPlaneTiltIcon,
  QuestionIcon,
  SparkleIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Sticker } from "@/components/shared/sticker"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  useHelpDialog,
  type HelpTab,
} from "@/components/help/help-dialog-context"

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const SUPPORT_EMAIL = "support@paperhint.com"
const HELLO_EMAIL = "hello@paperhint.com"

type Faq = { q: string; a: string; tags: string[] }

const FAQS: Faq[] = [
  {
    q: "How do I build a question paper?",
    a: "Open a class from the sidebar, go to Exams and create a new exam. You can generate questions from your class knowledge, upload an existing paper, or write questions by hand. When the set is ready, the PDF builder lays it out for print.",
    tags: ["exam", "paper", "questions", "pdf", "generate", "upload"],
  },
  {
    q: "How does grading work?",
    a: "In a class's Grading tab, scan or upload the answer sheets for an exam. Hint marks them against your paper, flags anything it is unsure about, and you review those before results go out.",
    tags: ["grading", "marks", "scan", "sheets", "review", "results"],
  },
  {
    q: "What goes in the Knowledge Library?",
    a: "Your teaching material: textbooks, notes, past papers, anything Hint should read. Everything in a class's Knowledge tab is what Hint draws on when it drafts questions or answers for that class.",
    tags: ["knowledge", "library", "upload", "notes", "materials"],
  },
  {
    q: "Can I share material with other teachers?",
    a: "Yes. Move or copy files into the Shared Library and any teacher in your school can link them into their own classes. Unlinking removes it from one class without touching the original.",
    tags: ["shared", "library", "teachers", "link", "unlink"],
  },
  {
    q: "What can I ask Hint?",
    a: "Anything about your classes: who slipped in the last exam, a summary of a chapter, a quick explanation to paste into notes. Inside a class, the Ask hint button keeps the conversation scoped to that class's material.",
    tags: ["ask", "hint", "ai", "chat", "copilot"],
  },
  {
    q: "How do I add students or teachers?",
    a: "Admins add them from Students and Teachers in the sidebar. Teachers get an email invite to set a password; students are enrolled into a grade and section so their sheets can be matched during grading.",
    tags: ["students", "teachers", "invite", "add", "enrol", "admin"],
  },
  {
    q: "Why can't I change my email or designation?",
    a: "Those come from your school's record and only an admin can edit them. Everything else on your profile, including your photo and password, is yours to change in Settings.",
    tags: ["settings", "profile", "email", "designation", "admin", "password"],
  },
  {
    q: "Is there a dark theme?",
    a: "Yes. Choose Light, Dark or System in Settings → Appearance, or press D anywhere in the app to flip between light and dark.",
    tags: ["theme", "dark", "light", "appearance", "settings"],
  },
]

const SHORTCUTS: { keys: string[]; does: string }[] = [
  { keys: ["D"], does: "Switch between light and dark theme" },
  { keys: ["?"], does: "Open Help & support" },
  { keys: ["Esc"], does: "Close any open dialog or sheet" },
]

const TOPICS = [
  { id: "question", label: "Question", icon: QuestionIcon },
  { id: "bug", label: "Something broke", icon: BugBeetleIcon },
  { id: "idea", label: "Feature idea", icon: LightbulbIcon },
] as const

type TopicId = (typeof TOPICS)[number]["id"]

const TABS: { id: HelpTab; label: string; icon: typeof QuestionIcon }[] = [
  { id: "answers", label: "Answers", icon: SparkleIcon },
  { id: "contact", label: "Contact us", icon: ChatCircleDotsIcon },
  { id: "shortcuts", label: "Shortcuts", icon: KeyboardIcon },
]

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-background px-1.5 font-sans text-[11px] font-medium text-foreground shadow-xs">
      {children}
    </kbd>
  )
}

function EmptyAnswers({ query, onAsk }: { query: string; onAsk: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <Sticker name="worried" size={64} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          Nothing on “{query}” yet
        </p>
        <p className="text-xs text-muted-foreground">
          Ask us directly and we'll get back to you.
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onAsk}>
        <ChatCircleDotsIcon className="size-4" />
        Ask a question
      </Button>
    </div>
  )
}

function AnswersTab({ query, onAsk }: { query: string; onAsk: () => void }) {
  const reduceMotion = useReducedMotion()
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return FAQS
    return FAQS.filter(
      (f) =>
        f.q.toLowerCase().includes(q) ||
        f.a.toLowerCase().includes(q) ||
        f.tags.some((t) => t.includes(q))
    )
  }, [query])

  // One pill for the whole list, owned by the list. It measures the hovered
  // row and glides to it, so it is always the bottom layer under every row.
  // (A shared-layout pill mounted inside each row painted over the next
  // row's text while in flight — the rows' own transforms got in the way.)
  const [hoveredEl, setHoveredEl] = useState<HTMLElement | null>(null)
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null)
  useEffect(() => {
    if (!hoveredEl) return
    const measure = () =>
      setPill({ top: hoveredEl.offsetTop, height: hoveredEl.offsetHeight })
    measure()
    // A row grows when its answer opens; keep the pill wrapped around it.
    const ro = new ResizeObserver(measure)
    ro.observe(hoveredEl)
    return () => ro.disconnect()
  }, [hoveredEl])

  if (results.length === 0) return <EmptyAnswers query={query} onAsk={onAsk} />

  return (
    <Accordion
      type="single"
      collapsible
      className="relative flex flex-col gap-1"
      onMouseLeave={() => setHoveredEl(null)}
    >
      {pill ? (
        <motion.span
          aria-hidden
          initial={false}
          animate={{
            top: pill.top,
            height: pill.height,
            opacity: hoveredEl ? 1 : 0,
          }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  type: "spring",
                  stiffness: 480,
                  damping: 40,
                  opacity: { duration: 0.15 },
                }
          }
          className="pointer-events-none absolute inset-x-0 z-0 rounded-lg bg-muted"
        />
      ) : null}
      {results.map((f, i) => (
        <motion.div
          key={f.q}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: Math.min(i, 6) * 0.03 }}
          onMouseEnter={(e) => setHoveredEl(e.currentTarget)}
          className="group/faq relative z-10"
        >
          <AccordionItem
            value={f.q}
            className="rounded-lg border border-transparent px-3 transition-colors data-[state=open]:border-border data-[state=open]:bg-muted/40"
          >
            {/* The question slides right a hair and the caret drops as the
                cursor arrives, so the row answers before it is clicked. */}
            <AccordionTrigger className="py-3 text-left text-sm hover:no-underline **:data-[slot=accordion-trigger-icon]:transition-transform **:data-[slot=accordion-trigger-icon]:duration-200 group-hover/faq:**:data-[slot=accordion-trigger-icon]:translate-y-0.5 group-hover/faq:**:data-[slot=accordion-trigger-icon]:text-foreground">
              <span className="transition-transform duration-200 ease-out group-hover/faq:translate-x-0.5">
                {f.q}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 text-[13px] leading-relaxed text-muted-foreground">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        </motion.div>
      ))}
    </Accordion>
  )
}

function ContactTab({ onSent }: { onSent: () => void }) {
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const [topic, setTopic] = useState<TopicId>("question")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)

  const canSend =
    !isSending && subject.trim().length > 0 && message.trim().length > 0

  // Sent through the backend (POST /api/support/contact), which records the
  // request and emails the team with the sender's details attached
  // server-side — no email app, and nothing for the user to fill in twice.
  const send = async () => {
    if (!canSend) return
    setIsSending(true)
    try {
      await apiClient.post("/api/support/contact", {
        topic,
        subject: subject.trim(),
        message: message.trim(),
        page_path: location.pathname,
      })
      toast.success("Message sent", {
        description: "We'll reply to your account email.",
      })
      setSubject("")
      setMessage("")
      onSent()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't send. Please try again."
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Topic: a segmented row whose highlight slides between choices. */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          What is it about?
        </span>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {TOPICS.map((t) => {
            const on = topic === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopic(t.id)}
                aria-pressed={on}
                className={cn(
                  "relative flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {on ? (
                  <motion.span
                    aria-hidden
                    layoutId="help-topic-pill"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 480, damping: 40 }
                    }
                    className="absolute inset-0 rounded-md bg-background shadow-xs ring-1 ring-border"
                  />
                ) : null}
                <t.icon className="relative z-10 size-3.5" />
                <span className="relative z-10 truncate">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="help-subject"
          className="text-xs font-medium text-muted-foreground"
        >
          Subject
        </label>
        <Input
          id="help-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder={
            topic === "bug"
              ? "e.g. Grading review page won't load"
              : topic === "idea"
                ? "e.g. Export marks to a spreadsheet"
                : "e.g. How do I re-mark one sheet?"
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="help-message"
          className="text-xs font-medium text-muted-foreground"
        >
          Message
        </label>
        <Textarea
          id="help-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={5000}
          placeholder={
            topic === "bug"
              ? "What did you do, and what happened instead?"
              : topic === "idea"
                ? "What would make Paperhint better for you?"
                : "Ask us anything about Paperhint…"
          }
          rows={5}
          className="resize-none"
        />
        <p className="text-[11px] text-muted-foreground">
          Your name, school and the page you're on come along automatically, and
          we reply to your account email.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="group inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <EnvelopeSimpleIcon className="size-3.5" />
          {SUPPORT_EMAIL}
          <ArrowUpRightIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </a>
        <Button onClick={send} disabled={!canSend}>
          {isSending ? (
            <CircleNotchIcon className="size-4 animate-spin" />
          ) : (
            <PaperPlaneTiltIcon className="size-4" />
          )}
          {isSending ? "Sending…" : "Send message"}
        </Button>
      </div>
    </div>
  )
}

function ShortcutsTab() {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {SHORTCUTS.map((s) => (
          <li
            key={s.does}
            className="flex items-center justify-between gap-4 px-3 py-2.5"
          >
            <span className="text-sm text-foreground">{s.does}</span>
            <span className="flex items-center gap-1">
              {s.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Shortcuts stay out of the way while you're typing in a field.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* The dialog                                                          */
/* ------------------------------------------------------------------ */

export function HelpSupportDialog() {
  const { isOpen, close, tab, setTab } = useHelpDialog()
  const { user } = useAuth()
  const reduceMotion = useReducedMotion()
  const [query, setQuery] = useState("")

  const firstName = user?.full_name?.split(" ")[0]

  return (
    <Dialog open={isOpen} onOpenChange={(o) => (o ? undefined : close())}>
      <DialogContent
        className="grid-cols-1 gap-0 overflow-hidden p-0 sm:max-w-4xl md:grid-cols-[17rem_minmax(0,1fr)] lg:max-w-5xl"
        showCloseButton
      >
        {/* ── Left: the greeting pane, on the app ground ── */}
        <aside className="relative hidden flex-col justify-between gap-6 overflow-hidden bg-sidebar p-6 md:flex">
          {/* Soft brand glow behind the mascot. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -left-16 size-56 rounded-full bg-primary/15 blur-3xl"
          />
          <div className="relative flex flex-col gap-4">
            <motion.div
              initial={reduceMotion ? false : { y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              <Sticker name="hint" size={88} />
            </motion.div>
            <div className="flex flex-col gap-1">
              <DialogTitle className="font-serif text-xl font-medium tracking-tight text-foreground">
                {firstName ? (
                  <>
                    Hi <em className="text-primary italic">{firstName}</em>, how
                    can we help?
                  </>
                ) : (
                  "How can we help?"
                )}
              </DialogTitle>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Quick answers, a line to the team, and the keys worth knowing.
              </p>
            </div>
          </div>

          <div className="relative flex flex-col gap-2 text-xs text-muted-foreground">
            <a
              href={`mailto:${HELLO_EMAIL}`}
              className="group inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <EnvelopeSimpleIcon className="size-3.5" />
              {HELLO_EMAIL}
              <ArrowUpRightIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
            <span>Typically replies within a school day.</span>
          </div>
        </aside>

        {/* ── Right: tabs + content ── */}
        <div className="flex h-[min(44rem,calc(100vh-5rem))] flex-col">
          <div className="flex flex-col gap-3 border-b border-border px-5 pt-5 pb-3">
            {/* Title for small screens, where the left pane is hidden. */}
            <DialogTitle className="text-base font-semibold md:hidden">
              Help & support
            </DialogTitle>
            <div className="flex items-center gap-1">
              {TABS.map((t) => {
                const on = tab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    aria-selected={on}
                    role="tab"
                    className={cn(
                      "relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {on ? (
                      <motion.span
                        aria-hidden
                        layoutId="help-tab-pill"
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 480, damping: 40 }
                        }
                        className="absolute inset-0 rounded-md bg-muted"
                      />
                    ) : null}
                    <t.icon
                      weight={on ? "fill" : "regular"}
                      className={cn(
                        "relative z-10 size-3.5",
                        on ? "text-primary" : ""
                      )}
                    />
                    <span className="relative z-10">{t.label}</span>
                  </button>
                )
              })}
            </div>

            {tab === "answers" ? (
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search answers… try “grading” or “theme”"
                  className="pl-9"
                  autoFocus
                />
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                {tab === "answers" ? (
                  <AnswersTab query={query} onAsk={() => setTab("contact")} />
                ) : tab === "contact" ? (
                  <ContactTab onSent={close} />
                ) : (
                  <ShortcutsTab />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
