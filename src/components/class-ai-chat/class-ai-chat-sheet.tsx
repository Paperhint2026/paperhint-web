import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowUpIcon,
  AtIcon,
  BookOpenIcon,
  ChalkboardIcon,
  ChartBarIcon,
  CircleNotchIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  PaperclipIcon,
  PlusIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react"
import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import "katex/dist/katex.min.css"

import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth"
import type { ClassAiChat, Material } from "@/hooks/use-class-ai-chat"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PaperhintMark } from "@/components/shared/paperhint-mark"
import { Sticker } from "@/components/shared/sticker"

interface ClassAiChatSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classLabel?: string
  chat: ClassAiChat
}

/* Same shape as the Ask Hint page's starters: a short chip, a full prompt. */
const SUGGESTIONS: { icon: Icon; label: string; prompt: string }[] = [
  {
    icon: BookOpenIcon,
    label: "Summarise a chapter",
    prompt: "Summarise the key concepts from the most recent chapter.",
  },
  {
    icon: ListChecksIcon,
    label: "Quiz questions",
    prompt:
      "Write 10 short quiz questions from the uploaded notes, with answers.",
  },
  {
    icon: ChalkboardIcon,
    label: "Lesson plan",
    prompt: "Draft a 40-minute lesson plan for the next topic in this class.",
  },
  {
    icon: ChartBarIcon,
    label: "Explain with a diagram",
    prompt: "Explain the hardest concept in these materials with a diagram.",
  },
]

/* Fade the sky out at the top and both side edges, keep the hill and book
   stack solid — the same treatment the Ask Hint page gives the scene. */
const MASK = [
  "linear-gradient(to top, black 45%, transparent 100%)",
  "linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)",
].join(", ")

function getFileIcon(url: string) {
  const lower = url.toLowerCase()
  if (lower.endsWith(".pdf")) return FileTextIcon
  if (/\.(jpe?g|png|webp|gif|svg)/.test(lower)) return ImageIcon
  return FileIcon
}

/**
 * Per-class-subject AI chat. State (messages, pinned materials, in-flight
 * stream) lives in AppLayout via `useClassAiChat`, so closing the sheet does
 * NOT destroy the conversation — only switching class-subject, leaving the
 * /class/:csId/* scope, or app refresh does.
 *
 * Streaming responses arrive via SSE from /api/knowledge/ask-stream; the
 * fetch lives in the hook so the stream survives sheet close.
 */
export function ClassAiChatSheet({
  open,
  onOpenChange,
  classLabel,
  chat,
}: ClassAiChatSheetProps) {
  const {
    classSubjectId,
    messages,
    input,
    setInput,
    pinnedIds,
    togglePin,
    clearPinned,
    materials,
    isStreaming,
    streamingMessageId,
    send,
    resetChat,
  } = chat

  const navigate = useNavigate()
  const { user } = useAuth()
  const firstName = user?.full_name?.split(" ")[0] ?? "there"

  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionStartIdx, setMentionStartIdx] = useState<number | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming, open])

  const pinnedMaterials = useMemo(
    () => materials.filter((m) => pinnedIds.has(m.id)),
    [materials, pinnedIds]
  )

  // --- @-mention detection ---------------------------------------------------

  const detectMention = useCallback((value: string, caretIdx: number) => {
    // Walk back from caret looking for an unclosed @ that started after a
    // whitespace / line-start boundary. If we find one, open the picker.
    let i = caretIdx - 1
    let atIdx = -1
    while (i >= 0) {
      const ch = value[i]
      if (ch === "@") {
        atIdx = i
        break
      }
      if (ch === " " || ch === "\n" || ch === "\t") break
      i--
    }
    if (atIdx === -1)
      return { open: false, query: "", start: null as number | null }
    const before = atIdx === 0 ? "" : value[atIdx - 1]
    const validBoundary =
      atIdx === 0 || before === " " || before === "\n" || before === "\t"
    if (!validBoundary)
      return { open: false, query: "", start: null as number | null }
    return { open: true, query: value.slice(atIdx + 1, caretIdx), start: atIdx }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInput(value)

    const el = e.target
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`

    const caret = el.selectionStart ?? value.length
    const m = detectMention(value, caret)
    setMentionOpen(m.open)
    setMentionQuery(m.query)
    setMentionStartIdx(m.start)
  }

  const pickMentionMaterial = (material: Material) => {
    togglePin(material.id)
    if (mentionStartIdx !== null && textareaRef.current) {
      const el = textareaRef.current
      const caret = el.selectionStart ?? input.length
      const before = input.slice(0, mentionStartIdx)
      const after = input.slice(caret)
      const next = before + after
      setInput(next)
      requestAnimationFrame(() => {
        el.focus()
        const pos = before.length
        el.setSelectionRange(pos, pos)
      })
    }
    setMentionOpen(false)
    setMentionQuery("")
    setMentionStartIdx(null)
  }

  const filteredMentions = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase()
    let list = materials.filter((m) => !pinnedIds.has(m.id))
    if (q) list = list.filter((m) => m.title.toLowerCase().includes(q))
    return list.slice(0, 8)
  }, [materials, mentionQuery, pinnedIds])

  // --- Send ------------------------------------------------------------------

  const handleSend = () => {
    const q = input.trim()
    if (!q || isStreaming || !classSubjectId) return

    // Snapshot pinned set then clear so the chips above the input disappear.
    // The attached-materials info is still visible on the user bubble via
    // pinnedMaterialIds copied onto the message inside the hook.
    const pinnedSnapshot = [...pinnedIds]
    clearPinned()
    setInput("")
    setMentionOpen(false)
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    void send(q, pinnedSnapshot)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && filteredMentions.length > 0) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        pickMentionMaterial(filteredMentions[0])
        return
      }
      if (e.key === "Escape") {
        setMentionOpen(false)
        return
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const pickSuggestion = (prompt: string) => {
    setInput(prompt)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const isEmpty = messages.length === 0 && !isStreaming
  const hasMaterials = materials.length > 0

  const composer = (
    <div className="flex w-full flex-col gap-2">
      {/* Pinned chips */}
      {pinnedMaterials.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {pinnedMaterials.map((m) => {
            const FIcon = getFileIcon(m.file_url)
            return (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-0.5 pr-1 pl-2 text-xs"
              >
                <FIcon className="size-3 text-muted-foreground" />
                <span className="max-w-[180px] truncate">{m.title}</span>
                <button
                  type="button"
                  onClick={() => togglePin(m.id)}
                  aria-label={`Detach ${m.title}`}
                  className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            )
          })}
          <span className="text-[11px] text-muted-foreground">
            Answer will use only these
          </span>
        </div>
      )}

      {/* The prompt box — same wrapper as the Ask Hint page: the border is
          a layer the glow can orbit in, clipped back to the rounded rect. */}
      <div className="group/composer relative w-full overflow-hidden rounded-xl bg-foreground/15 p-px shadow-sm">
        {isEmpty && hasMaterials ? (
          <div
            aria-hidden
            className="absolute top-1/2 left-1/2 aspect-square w-[140%] -translate-x-1/2 -translate-y-1/2 animate-spin opacity-70 [animation-duration:5s] motion-reduce:hidden"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0%, var(--color-primary) 12%, transparent 28%)",
            }}
          />
        ) : null}
        <div className="relative flex w-full flex-col rounded-[calc(var(--radius)*1.4-1px)] bg-card">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setMentionOpen(false), 200)}
            placeholder={
              hasMaterials
                ? `Ask about ${classLabel ?? "this class"}… type @ to point at a file`
                : "Upload a source first, then ask away"
            }
            aria-label="Ask Hint about this class"
            rows={1}
            className="relative max-h-40 min-h-[46px] w-full resize-none overflow-y-auto bg-transparent px-4 pt-3.5 text-sm leading-6 outline-none placeholder:text-muted-foreground/60"
          />
          <div className="flex items-center justify-between px-2.5 pb-2.5">
            <AttachButton
              materials={materials}
              pinnedIds={pinnedIds}
              onToggle={togglePin}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isStreaming || !classSubjectId}
              aria-label="Send"
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                input.trim() && !isStreaming
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground/40"
              )}
            >
              {isStreaming ? (
                <CircleNotchIcon className="size-4 animate-spin" />
              ) : (
                <ArrowUpIcon className="size-4" weight="bold" />
              )}
            </button>
          </div>

          {mentionOpen && filteredMentions.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 max-h-64 w-full max-w-sm overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-xl">
              <div className="px-2 py-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Point at a file
                {mentionQuery ? (
                  <span className="ml-1 font-normal tracking-normal text-foreground normal-case">
                    · "{mentionQuery}"
                  </span>
                ) : null}
              </div>
              {filteredMentions.map((m) => {
                const FIcon = getFileIcon(m.file_url)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => pickMentionMaterial(m)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                  >
                    <FIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{m.title}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        size="2xl"
        showCloseButton={false}
        className="flex min-h-0 flex-col gap-0 bg-background p-0"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 flex-row items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <PaperhintMark className="size-6 shrink-0 text-primary" />
            <div className="min-w-0">
              <SheetTitle className="truncate font-serif text-base font-medium tracking-tight">
                Ask <em className="text-primary italic">hint</em>
              </SheetTitle>
              <SheetDescription className="truncate text-xs">
                {classLabel ?? "This class"}
                <span className="mx-1.5 text-border">·</span>
                {materials.length}{" "}
                {materials.length === 1 ? "source" : "sources"}
              </SheetDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full"
                    onClick={() => {
                      resetChat()
                      textareaRef.current?.focus()
                    }}
                    aria-label="New chat"
                  >
                    <PlusIcon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">New chat</TooltipContent>
              </Tooltip>
            )}
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label="Close"
              >
                <XIcon className="size-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        {isEmpty ? (
          /* ── Landing: scene, greeting, composer, starters ── */
          <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden"
            >
              <img
                src="/ask-hint-scene.jpg"
                alt=""
                className="size-full object-cover object-[center_62%] opacity-70 dark:opacity-30"
                style={{
                  maskImage: MASK,
                  WebkitMaskImage: MASK,
                  maskComposite: "intersect",
                  WebkitMaskComposite: "source-in",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-transparent" />
            </div>

            <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
              <PaperhintMark className="size-9 text-primary" />
              <div className="flex flex-col gap-2">
                <h2 className="font-serif text-[26px] leading-snug font-medium tracking-tight text-balance text-foreground">
                  Hi <em className="text-primary italic">{firstName}</em>, what
                  would you like to know about{" "}
                  <em className="text-primary italic">
                    {classLabel ?? "this class"}
                  </em>
                  ?
                </h2>
                <p className="text-sm text-muted-foreground">
                  {hasMaterials
                    ? `Answers come only from this class's ${materials.length} ${materials.length === 1 ? "source" : "sources"}. Type @ to point at one.`
                    : "Hint answers from this class's sources, and there aren't any yet."}
                </p>
              </div>

              {hasMaterials ? (
                <>
                  {composer}
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => pickSuggestion(s.prompt)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <s.icon aria-hidden className="size-3.5" />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Sticker name="point" size={72} />
                  <Button
                    onClick={() => {
                      onOpenChange(false)
                      if (classSubjectId)
                        navigate(`/class/${classSubjectId}/knowledge`)
                    }}
                  >
                    <BookOpenIcon className="size-3.5" />
                    Add a source
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Conversation ── */
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 md:px-6">
                {messages.map((msg) =>
                  msg.role === "user" ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[80%] rounded-xl bg-muted px-3.5 py-2.5 text-sm text-foreground">
                        {msg.pinnedMaterialIds &&
                          msg.pinnedMaterialIds.length > 0 && (
                            <div className="mb-1.5 flex flex-wrap gap-1">
                              {msg.pinnedMaterialIds.map((id) => {
                                const mat = materials.find((m) => m.id === id)
                                return (
                                  <span
                                    key={id}
                                    className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
                                  >
                                    <AtIcon className="size-2.5" />
                                    {mat?.title ?? "Material"}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="flex gap-3">
                      {/* Same wait as the Ask Hint page: the mark itself turns
                          and the line shimmers, laid out as Hint's turn. */}
                      <PaperhintMark
                        className={cn(
                          "mt-0.5 size-5 shrink-0 text-primary",
                          msg.id === streamingMessageId &&
                            !msg.content &&
                            "animate-spin [animation-duration:1.8s] motion-reduce:animate-none"
                        )}
                      />
                      <div className="min-w-0 flex-1 text-sm leading-relaxed">
                        {msg.id === streamingMessageId && !msg.content ? (
                          <span className="[animation:text-shimmer_2.2s_linear_infinite] bg-[linear-gradient(90deg,var(--color-muted-foreground)_0%,var(--color-foreground)_50%,var(--color-muted-foreground)_100%)] bg-[length:200%_auto] bg-clip-text text-sm leading-relaxed text-transparent motion-reduce:[animation:none]">
                            Searching this class's sources…
                          </span>
                        ) : (
                          <>
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                <MagnifyingGlassIcon className="size-3.5" />
                                <span>From</span>
                                {msg.sources.map((s) => (
                                  <Tooltip key={s.id}>
                                    <TooltipTrigger asChild>
                                      <span className="max-w-[200px] truncate rounded-md bg-muted px-1.5 py-0.5 text-secondary-foreground">
                                        {s.title}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>{s.title}</TooltipContent>
                                  </Tooltip>
                                ))}
                              </div>
                            )}
                            {msg.id === streamingMessageId ? (
                              <StreamingMarkdown content={msg.content} />
                            ) : (
                              <AnswerMarkdown content={msg.content} />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="shrink-0 border-t border-border bg-background px-4 py-3 md:px-6">
              <div className="mx-auto flex max-w-2xl flex-col gap-2">
                {composer}
                <p className="text-center text-[11px] text-muted-foreground">
                  Grounded in this class's sources. Check before you teach it.
                </p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function AttachButton({
  materials,
  pinnedIds,
  onToggle,
}: {
  materials: Material[]
  pinnedIds: Set<string>
  onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return materials
    return materials.filter((m) => m.title.toLowerCase().includes(q))
  }, [materials, query])

  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen((p) => !p)}
            aria-label="Point at a file"
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition-colors",
              pinnedIds.size > 0
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <PaperclipIcon className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Point at a file</TooltipContent>
      </Tooltip>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute bottom-full left-0 z-40 mb-2 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
            <div className="border-b border-border p-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${materials.length} sources…`}
                  className="h-8 w-full rounded-md border border-border bg-background pr-2 pl-8 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {materials.length === 0
                    ? "No sources in this class yet."
                    : "Nothing matches."}
                </p>
              ) : (
                filtered.map((m) => {
                  const FIcon = getFileIcon(m.file_url)
                  const picked = pinnedIds.has(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onToggle(m.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                        picked ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      )}
                    >
                      <FIcon className="size-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{m.title}</span>
                      {picked && <span className="text-[10px]">Attached</span>}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Smoothly reveals `target` by advancing a displayed-length counter on every
 * animation frame, sized to the lag, so chunky SSE tokens read as a steady
 * flow rather than visible stair steps.
 */
function useSmoothedStream(target: string): string {
  const [displayed, setDisplayed] = useState(target)
  const targetRef = useRef(target)

  useEffect(() => {
    targetRef.current = target
  }, [target])

  useEffect(() => {
    let raf = 0
    let active = true

    const tick = () => {
      if (!active) return
      setDisplayed((current) => {
        const t = targetRef.current
        if (current.length > t.length) return t
        if (current.length >= t.length) return current
        const lag = t.length - current.length
        const advance = Math.max(2, Math.ceil(lag / 8))
        return t.slice(0, current.length + advance)
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      active = false
      cancelAnimationFrame(raf)
    }
  }, [])

  return displayed
}

function StreamingMarkdown({ content }: { content: string }) {
  const displayed = useSmoothedStream(content)
  return <AnswerMarkdown content={displayed} />
}

function AnswerMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-pre:bg-muted prose-pre:text-foreground max-w-none [&_svg]:h-auto [&_svg]:max-w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          table: ({ children, ...props }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border">
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
            <td
              className="border-t border-border px-3 py-2 text-[13px]"
              {...props}
            >
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
