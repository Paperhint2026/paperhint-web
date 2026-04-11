import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowUpIcon,
  DatabaseIcon,
  HelpCircleIcon,
  Loader2Icon,
  MessageSquarePlusIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"

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
  )
}

/* ------------------------------------------------------------------ */
/*  Stage indicator                                                    */
/* ------------------------------------------------------------------ */

function StageIndicator({ stage }: { stage: Stage }) {
  if (stage === "done") return null
  return (
    <div className="flex justify-start py-2">
      <div className="inline-flex items-center gap-2.5 rounded-full bg-muted/60 px-4 py-2 text-xs text-muted-foreground">
        {stage === "querying" ? (
          <DatabaseIcon className="size-3.5 animate-pulse text-violet-500" />
        ) : stage === "searching" ? (
          <SearchIcon className="size-3.5 animate-pulse text-cyan-500" />
        ) : (
          <Loader2Icon className="size-3.5 animate-spin text-primary" />
        )}
        {STAGE_LABELS[stage]}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Suggestions                                                        */
/* ------------------------------------------------------------------ */

const SUGGESTIONS = [
  "How many students are in class 10?",
  "Show average marks for all exams",
  "Explain the concept of photosynthesis",
  "List all teachers and their subjects",
]

/* ------------------------------------------------------------------ */
/*  Main panel                                                         */
/* ------------------------------------------------------------------ */

export function CopilotPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isAsking, setIsAsking] = useState(false)
  const [stage, setStage] = useState<Stage>("done")
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile())
  const [latestAnswer, setLatestAnswer] = useState<string | null>(null)
  const initRef = useRef(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, stage, scrollToBottom])

  useEffect(() => {
    if (!open) {
      initRef.current = false
      return
    }

    setSidebarOpen(!isMobile())

    const init = async () => {
      if (initRef.current) return
      initRef.current = true

      try {
        const res = await apiClient.get<{ chats: Chat[] }>("/api/copilot/chats")
        const list = res.chats ?? []
        setChats(list)

        if (list.length > 0 && !activeChatId) {
          const latest = list[0]
          setActiveChatId(latest.id)
          const msgRes = await apiClient.get<{ messages: Message[] }>(
            `/api/copilot/chats/${latest.id}/messages`,
          )
          setMessages(msgRes.messages ?? [])
        }
      } catch { /* ignore */ }

      setTimeout(() => inputRef.current?.focus(), 300)
    }

    init()
  }, [open, activeChatId])

  /* ---- API helpers ---- */

  const fetchChats = async () => {
    try {
      const res = await apiClient.get<{ chats: Chat[] }>("/api/copilot/chats")
      setChats(res.chats ?? [])
    } catch { /* ignore */ }
  }

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await apiClient.get<{ messages: Message[] }>(
        `/api/copilot/chats/${chatId}/messages`,
      )
      setMessages(res.messages ?? [])
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
  }

  const selectChat = async (chat: Chat) => {
    setActiveChatId(chat.id)
    setLatestAnswer(null)
    await fetchMessages(chat.id)
    if (isMobile()) setSidebarOpen(false)
  }

  const handleNewChat = () => {
    setActiveChatId(null)
    setMessages([])
    setLatestAnswer(null)
    if (isMobile()) setSidebarOpen(false)
    setTimeout(() => inputRef.current?.focus(), 100)
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

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex bg-background">
      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <div
        className={cn(
          "flex shrink-0 flex-col border-r bg-background transition-all duration-300",
          "fixed inset-y-0 left-0 z-50 w-72",
          "md:relative md:inset-auto md:z-auto md:bg-muted/30",
          sidebarOpen
            ? "translate-x-0 md:w-64"
            : "-translate-x-full md:w-0 md:translate-x-0 md:overflow-hidden md:border-r-0",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-3">
          <button
            onClick={handleNewChat}
            className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PlusIcon className="size-4" />
            New chat
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          >
            <XIcon className="size-4 md:hidden" />
            <PanelLeftOpenIcon className="hidden size-4 md:block" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {chats.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-muted-foreground">
              <MessageSquarePlusIcon className="size-6 opacity-30" />
              <p className="text-[11px]">No conversations yet</p>
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => selectChat(chat)}
                className={cn(
                  "group relative mx-2 mb-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] transition-colors",
                  activeChatId === chat.id
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                <button
                  onClick={(e) => deleteChat(chat.id, e)}
                  className="shrink-0 rounded p-1 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Collapsed icon strip (visible when sidebar is closed) ── */}
      {!sidebarOpen && (
        <div className="hidden shrink-0 flex-col items-center border-r px-2 py-4 md:flex">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-muted"
              title="Open sidebar"
            >
              <PanelLeftOpenIcon className="size-5" />
            </button>
            <button
              onClick={handleNewChat}
              className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-muted"
              title="New chat"
            >
              <PlusIcon className="size-5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="flex h-14 shrink-0 items-center border-b px-4">
          {/* Left: sidebar toggle (mobile only when sidebar closed, hidden on desktop since icon strip handles it) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className={cn(
              "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted md:hidden",
              sidebarOpen && "hidden",
            )}
          >
            <PanelLeftOpenIcon className="size-4" />
          </button>

          {/* Center: title */}
          <div className="flex flex-1 items-center justify-center gap-2">
            <SparklesIcon className="size-4 text-primary" />
            <span className="text-sm font-semibold">Hint AI</span>
          </div>

          {/* Right: close */}
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {messages.length === 0 && stage === "done" ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center">
                <div className="relative mb-6">
                  <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-violet-500/20 via-primary/20 to-cyan-400/20 blur-xl" />
                  <div className="relative flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-cyan-400/10 ring-1 ring-white/10">
                    <SparklesIcon className="size-8 text-primary" />
                  </div>
                </div>
                <h2 className="mb-2 text-xl font-semibold">What can I help with?</h2>
                <p className="mb-8 max-w-sm text-center text-sm text-muted-foreground">
                  Ask about student data, exam results, teaching materials — or anything about your school.
                </p>
                <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setInput(s)
                        setTimeout(() => inputRef.current?.focus(), 50)
                      }}
                      className="rounded-xl border bg-card px-4 py-3 text-left text-[13px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted/50 hover:text-foreground"
                    >
                      {s}
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
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={msg.id} className="flex gap-3">
                      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/15 to-cyan-400/15">
                        <SparklesIcon className="size-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1 text-sm leading-relaxed">
                        {msg.query_type === "sql" && (
                          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <DatabaseIcon className="size-3 text-violet-500" />
                            <span>Database query</span>
                            {msg.metadata?.row_count != null && (
                              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-500">
                                {String(msg.metadata.row_count)} rows
                              </span>
                            )}
                          </div>
                        )}
                        {msg.query_type === "rag" && (
                          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <SearchIcon className="size-3 text-cyan-500" />
                            <span>Knowledge search</span>
                          </div>
                        )}
                        {msg.query_type === "clarify" && (
                          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <HelpCircleIcon className="size-3 text-amber-500" />
                            <span>Needs clarification</span>
                          </div>
                        )}
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted prose-pre:text-foreground">
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
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 border-t bg-background px-4 py-4">
          <div className="mx-auto max-w-3xl">
            <div className="relative flex items-end rounded-2xl border bg-muted/30 shadow-sm focus-within:border-primary/40 focus-within:shadow-md">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  const el = e.target
                  el.style.height = "auto"
                  el.style.height = `${Math.min(el.scrollHeight, 72)}px`
                }}
                onKeyDown={handleKeyDown}
                placeholder="Message Hint AI…"
                rows={1}
                className="max-h-[72px] min-h-[36px] flex-1 resize-none overflow-y-auto bg-transparent px-4 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground/50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isAsking}
                className={cn(
                  "mb-2 mr-2 flex size-9 shrink-0 items-center justify-center rounded-xl transition-all",
                  input.trim() && !isAsking
                    ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                    : "text-muted-foreground/40",
                )}
              >
                {isAsking ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <ArrowUpIcon className="size-4" />
                )}
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground/50">
              Hint AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
