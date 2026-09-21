import { useCallback, useEffect, useState } from "react"
import { BellIcon } from "@phosphor-icons/react"
import { useNavigate } from "react-router-dom"

import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * The rail's bell (migration 039). Fast path: a WebSocket to the API — a new
 * notification lands instantly. The poll stays as the reconciliation
 * fallback (slow while connected, faster while the socket is down), so a
 * dropped connection can delay a notification but never lose one. Opening
 * the list marks everything read.
 */

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  created_at: string
  read_at: string | null
}

const POLL_CONNECTED_MS = 5 * 60_000
const POLL_FALLBACK_MS = 30_000

function wsUrl() {
  const base = import.meta.env.VITE_API_BASE_URL || window.location.origin
  return base.replace(/^http/, "ws") + "/api/notifications/ws"
}

/**
 * A soft two-tone chime, synthesized — no asset to load. Browsers keep audio
 * suspended until the user has interacted with the page (autoplay policy), so
 * the context is created lazily and a failed play is simply silent; the badge
 * still tells the story.
 */
let audioCtx: AudioContext | null = null
function chime() {
  try {
    audioCtx ??= new AudioContext()
    if (audioCtx.state === "suspended") {
      // No user gesture yet this session — stay silent rather than error.
      void audioCtx.resume().catch(() => {})
      if (audioCtx.state === "suspended") return
    }
    const now = audioCtx.currentTime
    for (const [freq, at] of [
      [880, 0],
      [1174.66, 0.09],
    ] as const) {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + at)
      gain.gain.linearRampToValueAtTime(0.08, now + at + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.35)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(now + at)
      osc.stop(now + at + 0.4)
    }
  } catch {
    /* no audio — the badge still shows it */
  }
}

/** Where a notification leads. The stored link decides; rows from before
 *  tabs existed fall back to a route derived from their type. */
const TYPE_ROUTE: Record<string, string> = {
  leave_requested: "/attendance/leave",
  substitution_offer: "/attendance/substitutions",
  substitution_auto: "/attendance/substitutions",
}
function routeFor(n: Notification) {
  if (n.link && n.link !== "/attendance") return n.link
  return TYPE_ROUTE[n.type] ?? n.link
}

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export function NotificationsBell() {
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<Notification[] | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(() => {
    apiClient
      .get<{ notifications: Notification[]; unread: number }>(
        "/api/notifications"
      )
      .then((r) => {
        setItems(r.notifications)
        setUnread(r.unread)
      })
      .catch(() => {})
  }, [])

  const [connected, setConnected] = useState(false)

  // Fast path: the socket. Token goes in the FIRST message, never the URL.
  useEffect(() => {
    let ws: WebSocket | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let closed = false
    let backoff = 1000

    const connect = () => {
      const token = localStorage.getItem("access_token")
      if (!token) return
      try {
        ws = new WebSocket(wsUrl())
      } catch {
        return
      }
      ws.onopen = () => ws?.send(JSON.stringify({ type: "auth", token }))
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg.type === "ready") {
            setConnected(true)
            backoff = 1000
            load() // reconcile anything missed while disconnected
          } else if (msg.type === "notification") {
            setItems((prev) => [msg.notification, ...(prev ?? [])].slice(0, 20))
            setUnread((u) => u + 1)
            chime()
            // Let interested components react (e.g. the Leave card refetches
            // when a decision lands) without their own sockets.
            window.dispatchEvent(
              new CustomEvent("ph:notification", { detail: msg.notification })
            )
          }
        } catch {
          /* ignore malformed frames */
        }
      }
      ws.onclose = () => {
        setConnected(false)
        if (closed) return
        retry = setTimeout(connect, backoff)
        backoff = Math.min(backoff * 2, 30_000)
      }
      ws.onerror = () => ws?.close()
    }

    connect()
    return () => {
      closed = true
      if (retry) clearTimeout(retry)
      ws?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reconciliation poll — slow while the socket is live, faster when it
  // isn't, and NOT AT ALL while the tab is hidden: background tabs are the
  // common case all day in a school office, and polling them is pure waste.
  // Coming back to the tab reconciles immediately instead.
  useEffect(() => {
    load()
    let t: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (t) clearInterval(t)
      t = setInterval(load, connected ? POLL_CONNECTED_MS : POLL_FALLBACK_MS)
    }
    const onVisibility = () => {
      if (document.hidden) {
        if (t) clearInterval(t)
        t = null
      } else {
        load()
        start()
      }
    }
    if (!document.hidden) start()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      if (t) clearInterval(t)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [load, connected])

  const onOpenChange = (o: boolean) => {
    setOpen(o)
    if (o) {
      load()
      // Seeing the list is reading it.
      if (unread > 0) {
        apiClient
          .post("/api/notifications/read", { all: true })
          .then(() => setUnread(0))
          .catch(() => {})
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications — ${unread} unread` : "Notifications"}
          className="relative grid size-7 shrink-0 place-items-center rounded-md text-sidebar-label transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <BellIcon aria-hidden className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid min-w-3.5 place-items-center rounded-full bg-primary px-0.5 text-[9px] leading-3.5 font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2 text-xs font-medium text-foreground">
          Notifications
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!items || items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nothing yet — leave requests and decisions land here.
            </p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  setOpen(false)
                  const target = routeFor(n)
                  if (target)
                    navigate(target, { state: { rail: n.type, at: Date.now() } })
                }}
                className={cn(
                  "block w-full border-b border-border/60 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-muted/60",
                  !n.read_at && "bg-primary/[0.04]"
                )}
              >
                <span className="flex items-start gap-2">
                  {!n.read_at && (
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-foreground">
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {n.body}
                      </span>
                    )}
                    <span className="block text-[10px] text-muted-foreground/70">
                      {ago(n.created_at)}
                    </span>
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
