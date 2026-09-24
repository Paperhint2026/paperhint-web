import { useCallback, useEffect, useState } from "react"
import {
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom"
import {
  ArrowRightIcon,
  BellIcon,
  ChecksIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react"
import dayjs from "dayjs"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/shared/error-state"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import {
  routeFor,
  type RailNotification,
} from "@/modules/notifications/lib/route-for"
import { CircularsTab } from "@/modules/notifications/components/circulars-tab"
import { CircularDetailView } from "@/modules/notifications/components/circular-detail"
import { CircularComposer } from "@/modules/notifications/components/circular-composer"

const PAGE_SIZE = 50

function dateHeading(iso: string) {
  const d = dayjs(iso)
  if (d.isSame(dayjs(), "day")) return "Today"
  if (d.isSame(dayjs().subtract(1, "day"), "day")) return "Yesterday"
  return d.format("ddd, D MMM YYYY")
}

/** Group by calendar day, newest day first (rows arrive newest-first). */
function groupByDay(items: RailNotification[]) {
  const groups: { day: string; items: RailNotification[] }[] = []
  for (const n of items) {
    const day = dayjs(n.created_at).format("YYYY-MM-DD")
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(n)
    else groups.push({ day, items: [n] })
  }
  return groups
}

/**
 * Notifications & circulars — a LAYOUT route: this component renders the
 * header and the tab toggle exactly once and never remounts while the
 * children swap through the <Outlet />:
 *   /notifications                       → <NotificationsList/> (index)
 *   /notifications/circulars             → <CircularsListRoute/>
 *   /notifications/circulars/new         → <CircularComposerRoute/>
 *   /notifications/circulars/:circularId → <CircularDetailRoute/>
 * The tab IS the URL so a bell click can land on the exact surface, and
 * only the body below the toggle re-renders on a switch.
 */
export function NotificationsLayout() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const tab: "notifications" | "circulars" = pathname.startsWith(
    "/notifications/circulars"
  )
    ? "circulars"
    : "notifications"

  return (
    <div className={cn(PAGE_GUTTER, PAGE_TOP, "flex min-h-full flex-col gap-5 pb-12")}>
      <PageHeader
        icon={BellIcon}
        title="Notifications & circulars"
        description={
          isAdmin
            ? "Everything the rail delivered, and the circulars you've sent — with who read them."
            : "Everything the school sent your way — nudges, covers, leave decisions, and circulars from the office."
        }
      >
        <div className="flex rounded-lg border bg-muted/40 p-0.5 self-start">
          {(
            [
              { key: "notifications", label: "Notifications", to: "/notifications" },
              { key: "circulars", label: "Circulars", to: "/notifications/circulars" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => navigate(t.to)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {/* Only this swaps on a tab/route change; keying by path restarts the
          fade so the change reads as a transition, not a flash. */}
      <div key={pathname} className="animate-in fade-in duration-200">
        <Outlet />
      </div>
    </div>
  )
}

/* ── Route children ─────────────────────────────────────────────────────── */

export function CircularsListRoute() {
  const { user } = useAuth()
  return <CircularsTab isAdmin={user?.role === "admin"} />
}

export function CircularComposerRoute() {
  const { user } = useAuth()
  // Teachers have no composer — back to the list, no dead end.
  if (user?.role !== "admin") return <Navigate to="/notifications/circulars" replace />
  return <CircularComposer />
}

export function CircularDetailRoute() {
  const { user } = useAuth()
  const { circularId } = useParams<{ circularId: string }>()
  if (!circularId) return <Navigate to="/notifications/circulars" replace />
  return <CircularDetailView circularId={circularId} isAdmin={user?.role === "admin"} />
}

/* ── The rail: every notification, grouped by day (index child) ─────────── */

export function NotificationsList() {
  const navigate = useNavigate()
  const [items, setItems] = useState<RailNotification[] | null>(null)
  const [unread, setUnread] = useState(0)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  // Distinguish "the fetch failed" from "there's nothing here" — silently
  // rendering the empty state on a 500 fooled users into thinking the API
  // was quiet when it was broken.
  const [loadError, setLoadError] = useState<unknown | null>(null)

  const load = useCallback(() => {
    setLoadError(null)
    apiClient
      .get<{ notifications: RailNotification[]; unread: number }>(
        `/api/notifications?limit=${PAGE_SIZE}`
      )
      .then((r) => {
        setItems(r.notifications ?? [])
        setUnread(r.unread ?? 0)
        setExhausted((r.notifications ?? []).length < PAGE_SIZE)
      })
      .catch((err) => {
        setLoadError(err)
        setItems(null)
      })
  }, [])

  useEffect(() => {
    load()
    // A push landing while the page is open prepends live.
    const onRail = (e: Event) => {
      const n = (e as CustomEvent).detail as RailNotification | undefined
      if (!n?.id) return
      setItems((prev) => (prev ? [n, ...prev] : prev))
      setUnread((u) => u + 1)
    }
    window.addEventListener("ph:notification", onRail)
    return () => window.removeEventListener("ph:notification", onRail)
  }, [load])

  const loadOlder = async () => {
    if (!items || items.length === 0 || loadingOlder) return
    setLoadingOlder(true)
    try {
      const oldest = items[items.length - 1].created_at
      const r = await apiClient.get<{ notifications: RailNotification[] }>(
        `/api/notifications?limit=${PAGE_SIZE}&before=${encodeURIComponent(oldest)}`
      )
      const older = r.notifications ?? []
      setItems((prev) => [...(prev ?? []), ...older])
      if (older.length < PAGE_SIZE) setExhausted(true)
    } catch {
      toast.error("Could not load older notifications")
    } finally {
      setLoadingOlder(false)
    }
  }

  const markAllRead = async () => {
    try {
      await apiClient.post("/api/notifications/read", { all: true })
      const now = new Date().toISOString()
      setItems((prev) => (prev ?? []).map((n) => (n.read_at ? n : { ...n, read_at: now })))
      setUnread(0)
    } catch {
      toast.error("Could not mark as read")
    }
  }

  const open = (n: RailNotification) => {
    const target = routeFor(n)
    if (target) navigate(target, { state: { rail: n.type, at: Date.now() } })
  }

  return (
    <div className="flex flex-col gap-4">
      {unread > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => void markAllRead()}>
            <ChecksIcon className="size-4" />
            Mark all read ({unread})
          </Button>
        </div>
      )}

      {loadError ? (
        <ErrorState size="page" title="Couldn't load your notifications" error={loadError} onRetry={load} />
      ) : items === null ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <BellIcon className="size-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">Nothing yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Class nudges, covers, leave decisions, circulars and the morning digest will collect here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groupByDay(items).map((group) => (
            <section key={group.day} className="flex flex-col gap-2">
              <div className="flex items-center gap-3 px-1">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {dateHeading(group.items[0].created_at)}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="overflow-hidden rounded-xl border bg-card">
                {group.items.map((n, i) => {
                  const target = routeFor(n)
                  const Row = target ? "button" : "div"
                  return (
                    <Row
                      key={n.id}
                      {...(target ? { type: "button" as const, onClick: () => open(n) } : {})}
                      className={cn(
                        "block w-full px-4 py-3 text-left",
                        i > 0 && "border-t",
                        target && "cursor-pointer transition-colors hover:bg-muted/50",
                        !n.read_at && "bg-primary/[0.04]"
                      )}
                    >
                      <span className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "mt-1.5 size-1.5 shrink-0 rounded-full",
                            n.read_at ? "bg-transparent" : "bg-primary"
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-medium">{n.title}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {dayjs(n.created_at).format("h:mm A")}
                            </span>
                          </span>
                          {n.body && (
                            // The digest packs one line per class — preserve them.
                            <span className="mt-0.5 block text-[13px] leading-relaxed whitespace-pre-line text-muted-foreground">
                              {n.body}
                            </span>
                          )}
                          {target && (
                            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                              Open
                              <ArrowRightIcon className="size-3" />
                            </span>
                          )}
                        </span>
                      </span>
                    </Row>
                  )
                })}
              </div>
            </section>
          ))}

          {!exhausted && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => void loadOlder()} disabled={loadingOlder}>
                {loadingOlder ? (
                  <>
                    <CircleNotchIcon className="size-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load older"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
