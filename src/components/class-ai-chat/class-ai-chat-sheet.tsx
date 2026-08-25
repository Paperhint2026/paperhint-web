import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ArrowUpIcon,
  AtSignIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  Loader2Icon,
  MessageSquarePlusIcon,
  PaperclipIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import "katex/dist/katex.min.css"

import { cn } from "@/lib/utils"
import type { ClassAiChat, Material } from "@/hooks/use-class-ai-chat"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface ClassAiChatSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classLabel?: string
  chat: ClassAiChat
}

const SUGGESTIONS = [
  "Summarise the key concepts from Chapter 1",
  "Create a 40-minute lesson plan for this topic",
  "Generate 10 quiz questions from the uploaded notes",
  "Explain this with a diagram",
]

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
    [materials, pinnedIds],
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
    if (atIdx === -1) return { open: false, query: "", start: null as number | null }
    const before = atIdx === 0 ? "" : value[atIdx - 1]
    const validBoundary = atIdx === 0 || before === " " || before === "\n" || before === "\t"
    if (!validBoundary) return { open: false, query: "", start: null as number | null }
    return {
      open: true,
      query: value.slice(atIdx + 1, caretIdx),
      start: atIdx,
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInput(value)

    // Auto-resize
    const el = e.target
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`

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

    // Fire-and-forget — the hook updates message state as tokens arrive.
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

  const handleResetChat = () => {
    resetChat()
    textareaRef.current?.focus()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        size="2xl"
        className="flex min-h-0 flex-col gap-0 bg-background p-0"
      >
        <SheetHeader className="shrink-0 flex-row items-center justify-between gap-4 border-b p-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/15 to-cyan-400/15">
              <SparklesIcon className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate">Ask AI about this class</SheetTitle>
              <SheetDescription className="truncate text-xs">
                {classLabel
                  ? `Scoped to ${classLabel} — ${materials.length} material${materials.length === 1 ? "" : "s"} available`
                  : "Auto-scoped to this class's knowledge"}
              </SheetDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetChat}
                className="mr-8 gap-1.5 text-xs"
              >
                <MessageSquarePlusIcon className="size-3.5" />
                New chat
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 md:px-6">
            {messages.length === 0 && !isStreaming ? (
              <EmptyState
                materialsCount={materials.length}
                onPick={(s) => {
                  setInput(s)
                  setTimeout(() => textareaRef.current?.focus(), 50)
                }}
              />
            ) : (
              messages.map((msg) =>
                msg.role === "user" ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      {msg.pinnedMaterialIds && msg.pinnedMaterialIds.length > 0 && (
                        <div className="mb-1.5 flex flex-wrap gap-1">
                          {msg.pinnedMaterialIds.map((id) => {
                            const mat = materials.find((m) => m.id === id)
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[10px]"
                              >
                                <AtSignIcon className="size-2.5" />
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
                    <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/15 to-cyan-400/15">
                      <SparklesIcon className="size-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 text-sm leading-relaxed">
                      {msg.id === streamingMessageId && !msg.content ? (
                        <div className="inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
                          <Loader2Icon className="size-3.5 animate-spin text-primary" />
                          Thinking…
                        </div>
                      ) : msg.id === streamingMessageId ? (
                        <StreamingMarkdown content={msg.content} />
                      ) : (
                        <AnswerMarkdown content={msg.content} />
                      )}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                            Sources
                          </span>
                          {msg.sources.map((s) => (
                            <span
                              key={s.id}
                              title={s.title}
                              className="max-w-[200px] truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {s.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="shrink-0 border-t bg-background px-4 py-3 md:px-6">
          <div className="mx-auto max-w-3xl">
            {/* Pinned chips */}
            {pinnedMaterials.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {pinnedMaterials.map((m) => {
                  const Icon = getFileIcon(m.file_url)
                  return (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-xs"
                    >
                      <Icon className="size-3 text-muted-foreground" />
                      <span className="max-w-[180px] truncate">{m.title}</span>
                      <button
                        onClick={() => togglePin(m.id)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  )
                })}
                <span className="inline-flex items-center px-2 py-1 text-[10px] text-muted-foreground">
                  Answer will use ONLY these materials
                </span>
              </div>
            )}

            <div className="relative flex items-end rounded-2xl border bg-muted/30 shadow-sm focus-within:border-primary/40 focus-within:shadow-md">
              <AttachButton
                materials={materials}
                pinnedIds={pinnedIds}
                onToggle={togglePin}
              />
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  // Delay close so click on mention entry fires first
                  setTimeout(() => setMentionOpen(false), 200)
                }}
                placeholder={
                  materials.length === 0
                    ? "No materials yet. Upload some first to get better answers."
                    : "Ask anything. Type @ to attach a specific material…"
                }
                rows={1}
                className="max-h-[180px] min-h-[40px] flex-1 resize-none overflow-y-auto bg-transparent py-3 pr-2 text-sm leading-6 outline-none placeholder:text-muted-foreground/50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming || !classSubjectId}
                className={cn(
                  "mr-2 mb-2 flex size-9 shrink-0 items-center justify-center rounded-xl transition-all",
                  input.trim() && !isStreaming
                    ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                    : "text-muted-foreground/40",
                )}
              >
                {isStreaming ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <ArrowUpIcon className="size-4" />
                )}
              </button>

              {mentionOpen && filteredMentions.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 max-h-64 w-full max-w-sm overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-xl ring-1 ring-foreground/5">
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    Attach material{" "}
                    {mentionQuery ? (
                      <span className="text-foreground">· "{mentionQuery}"</span>
                    ) : null}
                  </div>
                  {filteredMentions.map((m) => {
                    const Icon = getFileIcon(m.file_url)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => pickMentionMaterial(m)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted"
                      >
                        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{m.title}</span>
                        {m.processed && (
                          <SparklesIcon className="size-3 shrink-0 text-emerald-500" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
              Answers are grounded in your class materials. Verify before using in class.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function EmptyState({
  materialsCount,
  onPick,
}: {
  materialsCount: number
  onPick: (s: string) => void
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="relative mb-5">
        <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-violet-500/20 via-primary/20 to-cyan-400/20 blur-xl" />
        <div className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-cyan-400/10 ring-1 ring-white/10">
          <SparklesIcon className="size-7 text-primary" />
        </div>
      </div>
      <h2 className="mb-1.5 font-heading text-lg">How can I help today?</h2>
      <p className="mb-6 max-w-sm text-xs text-muted-foreground">
        {materialsCount === 0
          ? "Upload materials for this class first — I'll answer straight from them."
          : "Ask me anything. I'll answer using only this class's materials. Use @ to pin a specific document."}
      </p>
      {materialsCount > 0 && (
        <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="rounded-xl border bg-card px-3 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted/50 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
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
      <button
        type="button"
        title="Attach material"
        onClick={() => setOpen((p) => !p)}
        className="m-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <PaperclipIcon className="size-4" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute bottom-full left-0 z-40 mb-2 w-80 overflow-hidden rounded-xl border bg-popover shadow-xl ring-1 ring-foreground/5">
            <div className="border-b p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search materials…"
                className="w-full rounded-md bg-muted/40 px-2.5 py-1.5 text-xs outline-none"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {materials.length === 0
                    ? "No materials in this class yet."
                    : "No match."}
                </p>
              ) : (
                filtered.map((m) => {
                  const Icon = getFileIcon(m.file_url)
                  const picked = pinnedIds.has(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onToggle(m.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                        picked
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted",
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" />
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
 * animation frame, sized to the lag. Effect: chunky SSE tokens look like a
 * steady flow rather than visible "stair steps" landing.
 *
 * - Initial render shows whatever has already arrived (no replay).
 * - On every frame, advance toward target by max(2, lag/8) chars — so big
 *   bursts catch up fast and a trickle still flows visibly.
 * - When target shrinks (e.g. new message starts at 0 / hard reset), snap.
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
        if (current.length > t.length) return t // shrink → snap
        if (current.length >= t.length) return current // caught up → bail out
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
    <div className="prose prose-sm dark:prose-invert max-w-none [&_svg]:max-w-full [&_svg]:h-auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          table: ({ children, ...props }) => (
            <div className="my-3 overflow-x-auto rounded-lg border">
              <table className="w-full text-[13px]" {...props}>{children}</table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th className="bg-muted/50 px-3 py-2 text-left text-xs font-semibold" {...props}>{children}</th>
          ),
          td: ({ children, ...props }) => (
            <td className="border-t px-3 py-2 text-[13px]" {...props}>{children}</td>
          ),
          p: ({ children, ...props }) => (
            <p className="mb-3 last:mb-0" {...props}>{children}</p>
          ),
          ul: ({ children, ...props }) => (
            <ul className="mb-3 list-disc pl-5 last:mb-0" {...props}>{children}</ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="mb-3 list-decimal pl-5 last:mb-0" {...props}>{children}</ol>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
