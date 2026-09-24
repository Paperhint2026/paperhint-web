import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  MegaphoneIcon,
  PaperclipIcon,
  PlusIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"
import dayjs from "dayjs"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/shared/error-state"
import {
  circularsApi,
  type CircularSummary,
} from "@/modules/notifications/lib/circulars-api"

/**
 * The Circulars tab: admin sees everything the school sent with read
 * receipts summarised; a teacher sees what was addressed to them, unread
 * first-class. Both click through to the circular itself.
 */
export function CircularsTab({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate()
  const [items, setItems] = useState<CircularSummary[] | null>(null)
  const [loadError, setLoadError] = useState<unknown | null>(null)

  const load = useCallback(() => {
    setLoadError(null)
    circularsApi
      .list()
      .then((r) => setItems(r.circulars ?? []))
      .catch((err) => {
        setLoadError(err)
        setItems(null)
      })
  }, [])

  useEffect(() => {
    load()
    // A new circular pushed over the rail lands in the list live.
    const onRail = (e: Event) => {
      if ((e as CustomEvent).detail?.type === "circular") load()
    }
    window.addEventListener("ph:notification", onRail)
    return () => window.removeEventListener("ph:notification", onRail)
  }, [load])

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={() => navigate("/notifications/circulars/new")}>
            <PlusIcon className="size-4" />
            New circular
          </Button>
        </div>
      )}

      {loadError ? (
        <ErrorState size="page" title="Couldn't load circulars" error={loadError} onRetry={load} />
      ) : items === null ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <MegaphoneIcon className="size-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">No circulars yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {isAdmin
              ? "Write one to reach all teachers, class teachers, or a set of grades — with attachments, and read receipts."
              : "Circulars from the office will appear here, and you'll get a notification when one arrives."}
          </p>
          {isAdmin && (
            <Button className="mt-2" onClick={() => navigate("/notifications/circulars/new")}>
              <PlusIcon className="size-4" />
              Write the first circular
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((c) => {
            const unread = !isAdmin && !c.my_read_at
            const total = c.recipients_total ?? 0
            const read = c.read_count ?? 0
            const acked = c.acknowledged_count ?? 0
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/notifications/circulars/${c.id}`)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50",
                  unread && "border-primary/30 bg-primary/[0.04]"
                )}
              >
                <span
                  className={cn(
                    "mt-2 size-1.5 shrink-0 rounded-full",
                    unread ? "bg-primary" : "bg-transparent"
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>
                      {c.subject}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {dayjs(c.sent_at).format("D MMM, h:mm A")}
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted-foreground">
                    {c.excerpt}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="gap-1 font-normal">
                      <UsersThreeIcon className="size-3" />
                      {c.audience_label}
                    </Badge>
                    {c.attachment_count > 0 && (
                      <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                        <PaperclipIcon className="size-3" />
                        {c.attachment_count}
                      </Badge>
                    )}
                    {c.author_name && (
                      <span className="text-[11px] text-muted-foreground">
                        by {c.author_name}
                      </span>
                    )}
                    {isAdmin && total > 0 && (
                      <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${(read / total) * 100}%` }}
                          />
                        </span>
                        Read {read}/{total}
                        {acked > 0 && <span>· Ack {acked}</span>}
                      </span>
                    )}
                    {!isAdmin && c.my_acknowledged_at && (
                      <Badge className="ml-auto bg-primary/10 font-normal text-primary" variant="secondary">
                        Acknowledged
                      </Badge>
                    )}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
