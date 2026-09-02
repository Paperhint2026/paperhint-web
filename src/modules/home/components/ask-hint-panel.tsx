import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import dayjs from "dayjs"
import {
  ArrowRightIcon,
  ChatCircleDotsIcon,
  PaperPlaneTiltIcon,
} from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { Skeleton } from "@/components/ui/skeleton"
import { PaperhintMark } from "@/components/shared/paperhint-mark"

interface Chat {
  id: string
  title: string
  updated_at: string
}

/* Fade the sky out at the top and both side edges, keep the hill and book
   stack solid — the same treatment the Ask Hint page gives the scene. */
const MASK = [
  "linear-gradient(to top, black 45%, transparent 100%)",
  "linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)",
].join(", ")

/**
 * The Ask Hint page in miniature: the hill scene, the serif greeting, a
 * prompt box that hands off to the real composer, the same starter chips,
 * and the last few conversations.
 */
export function AskHintPanel() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState("")
  const [chats, setChats] = useState<Chat[] | null>(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<{ chats: Chat[] }>("/api/copilot/chats")
      .then((res) => {
        if (!cancelled) setChats((res.chats ?? []).slice(0, 3))
      })
      .catch(() => {
        if (!cancelled) setChats([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const ask = (prompt: string) => {
    const text = prompt.trim()
    navigate("/ask", text ? { state: { prompt: text } } : undefined)
  }

  return (
    <section className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background">
      {/* Hero — grows to whatever height the row gives the card and centres
          the greeting in it, so a taller neighbour never leaves a blank band */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-5 py-7 text-center">
        {/* Scene */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <img
            src="/ask-hint-scene.jpg"
            alt=""
            className="size-full object-cover object-[center_60%] opacity-70 dark:opacity-30"
            style={{
              maskImage: MASK,
              WebkitMaskImage: MASK,
              maskComposite: "intersect",
              WebkitMaskComposite: "source-in",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-transparent" />
        </div>

        <PaperhintMark className="relative size-8 text-primary" />
        <h2 className="relative font-serif text-xl leading-snug font-medium tracking-tight text-balance text-foreground">
          Ask <em className="text-primary italic">hint</em>
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            ask(draft)
          }}
          className="relative flex w-full items-center gap-2 rounded-xl border border-border bg-background/90 p-1.5 pl-3.5 shadow-sm backdrop-blur transition-colors focus-within:border-primary/50"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask anything about your classes…"
            aria-label="Ask Hint"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            aria-label="Ask"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
          >
            <PaperPlaneTiltIcon weight="fill" className="size-4" />
          </button>
        </form>
      </div>

      {/* Recent */}
      <div className="flex flex-col border-t border-border">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Recent
          </p>
          {chats && chats.length > 0 && (
            <button
              type="button"
              onClick={() => navigate("/ask")}
              className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              All chats
              <ArrowRightIcon className="size-3" />
            </button>
          )}
        </div>
        {chats === null ? (
          <div className="flex flex-col gap-2 px-4 pt-1 pb-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : chats.length === 0 ? (
          <p className="px-4 pt-1 pb-4 text-xs text-muted-foreground">
            Your conversations will show up here.
          </p>
        ) : (
          <div className="flex flex-col pb-2">
            {chats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/ask/c/${c.id}`)}
                className="flex items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-muted/60"
              >
                <ChatCircleDotsIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm text-secondary-foreground">
                  {c.title}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {dayjs(c.updated_at).format("D MMM")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
