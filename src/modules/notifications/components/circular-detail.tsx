import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeftIcon,
  CaretDownIcon,
  CaretUpIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  FileIcon,
  ImageSquareIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"
import dayjs from "dayjs"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { showError } from "@/lib/show-error"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ErrorState } from "@/components/shared/error-state"
import { NotesMarkdown } from "@/modules/notes/components/notes-markdown"
import {
  circularsApi,
  type Attachment,
  type CircularDetail as Circular,
  type Recipient,
} from "@/modules/notifications/lib/circulars-api"
import {
  AttachmentPreviewDialog,
  fmtSize,
} from "@/modules/notifications/components/attachment-preview-dialog"

/**
 * One circular, read like an email: subject, who sent it and to whom,
 * the body, images inline, other files as download chips. Teachers get an
 * Acknowledge button (opening already marked it read server-side); the
 * admin gets the recipients panel with per-teacher receipts.
 */
export function CircularDetailView({
  circularId,
  isAdmin,
}: {
  circularId: string
  isAdmin: boolean
}) {
  const navigate = useNavigate()
  const [circular, setCircular] = useState<Circular | null>(null)
  const [loadError, setLoadError] = useState<unknown | null>(null)
  const [acking, setAcking] = useState(false)
  const [preview, setPreview] = useState<Attachment | null>(null)

  const load = useCallback(() => {
    setLoadError(null)
    circularsApi
      .get(circularId)
      .then((r) => setCircular(r.circular))
      .catch((err) => {
        setLoadError(err)
        setCircular(null)
      })
  }, [circularId])

  useEffect(() => {
    load()
  }, [load])

  const acknowledge = async () => {
    if (!circular || acking) return
    setAcking(true)
    try {
      const r = await circularsApi.acknowledge(circular.id)
      setCircular({ ...circular, my_acknowledged_at: r.acknowledged_at })
      toast.success("Acknowledged — the office can see you've read it")
    } catch (err) {
      showError(err, "Could not acknowledge")
    } finally {
      setAcking(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
          onClick={() => navigate("/notifications/circulars")}
        >
          <ArrowLeftIcon className="size-4" />
          All circulars
        </Button>
      </div>

      {loadError ? (
        <ErrorState size="page" title="Couldn't open this circular" error={loadError} onRetry={load} />
      ) : !circular ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-2/3 rounded-lg" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <article className="overflow-hidden rounded-xl border bg-card">
            <header className="flex flex-col gap-2 border-b px-5 py-4">
              <h1 className="text-base font-semibold tracking-tight break-words sm:text-lg">{circular.subject}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {circular.author_name && <span>From {circular.author_name}</span>}
                <span>{dayjs(circular.sent_at).format("ddd, D MMM YYYY · h:mm A")}</span>
                <Badge variant="secondary" className="gap-1 font-normal">
                  <UsersThreeIcon className="size-3" />
                  To: {circular.audience_label}
                </Badge>
              </div>
            </header>

            <div className="px-5 py-4">
              <NotesMarkdown content={circular.body_md} />
            </div>

            {circular.attachments.length > 0 && (
              <div className="flex flex-col gap-3 border-t px-5 py-4">
                {/* Attachments are chips, full stop — pictures the sender
                    wanted INSIDE the message were placed there via the
                    editor and arrive resolved in the body above. Click
                    previews in place (image, PDF, text); Office files
                    explain themselves and offer Download. */}
                <div className="flex flex-wrap gap-2">
                  {circular.attachments.map((a) => (
                    <button
                      key={a.path}
                      type="button"
                      onClick={() => setPreview(a)}
                      disabled={!a.url}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                        !a.url && "cursor-not-allowed opacity-50"
                      )}
                    >
                      {a.is_image ? (
                        <ImageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="max-w-[16rem] truncate">{a.name}</span>
                      <span className="text-[11px] text-muted-foreground">{fmtSize(a.size)}</span>
                      <span className="text-[11px] font-medium text-primary">
                        {a.kind === "office" ? "Download" : "Preview"}
                      </span>
                    </button>
                  ))}
                </div>
                <AttachmentPreviewDialog attachment={preview} onClose={() => setPreview(null)} />
              </div>
            )}

            {!isAdmin && (
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3">
                <p className="text-xs text-muted-foreground">
                  {circular.my_acknowledged_at
                    ? `Acknowledged ${dayjs(circular.my_acknowledged_at).format("D MMM, h:mm A")}`
                    : "Let the office know you've read this."}
                </p>
                {circular.my_acknowledged_at ? (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                    <CheckCircleIcon weight="fill" className="size-4" />
                    Acknowledged
                  </span>
                ) : (
                  <Button onClick={() => void acknowledge()} disabled={acking}>
                    {acking ? <CircleNotchIcon className="size-4 animate-spin" /> : <CheckCircleIcon className="size-4" />}
                    Acknowledge
                  </Button>
                )}
              </footer>
            )}
          </article>

          {isAdmin && <RecipientsPanel circular={circular} />}
        </>
      )}
    </div>
  )
}

/* ── Admin: who got it, who read it, who acknowledged ─────────────────── */

function RecipientsPanel({ circular }: { circular: Circular }) {
  const [recipients, setRecipients] = useState<Recipient[] | null>(null)
  const [open, setOpen] = useState(true)
  const [error, setError] = useState<unknown | null>(null)

  const load = useCallback(() => {
    setError(null)
    circularsApi
      .recipients(circular.id)
      .then((r) => setRecipients(r.recipients))
      .catch((err) => setError(err))
  }, [circular.id])

  useEffect(() => {
    load()
    // Receipts move as teachers open the circular — a quiet 30s refresh
    // while the panel is on screen keeps the counts honest.
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  const total = recipients?.length ?? circular.recipients_total ?? 0
  const read = recipients?.filter((r) => r.read_at).length ?? circular.read_count ?? 0
  const acked = recipients?.filter((r) => r.acknowledged_at).length ?? circular.acknowledged_count ?? 0

  const statusOf = (r: Recipient) =>
    r.acknowledged_at ? "acknowledged" : r.read_at ? "read" : "delivered"
  const ORDER = { delivered: 0, read: 1, acknowledged: 2 } as const

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <UsersThreeIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Recipients</span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:justify-start">
          <span className="hidden h-1.5 max-w-40 flex-1 overflow-hidden rounded-full bg-muted sm:block">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${total ? (read / total) * 100 : 0}%` }} />
          </span>
          <span className="text-xs text-muted-foreground">
            {read} of {total} read · {acked} acknowledged
          </span>
        </span>
        {open ? <CaretUpIcon className="size-4 text-muted-foreground" /> : <CaretDownIcon className="size-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t">
          {error ? (
            <ErrorState title="Couldn't load recipients" error={error} onRetry={load} className="m-3" />
          ) : recipients === null ? (
            <div className="p-4">
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : (
            <ul className="divide-y">
              {[...recipients]
                .sort((a, b) => ORDER[statusOf(a)] - ORDER[statusOf(b)] || a.teacher_name.localeCompare(b.teacher_name))
                .map((r) => {
                  const s = statusOf(r)
                  return (
                    <li key={r.teacher_id} className="flex items-center gap-3 px-5 py-2.5">
                      <Avatar className="size-7">
                        {r.profile_url && <AvatarImage src={r.profile_url} alt="" />}
                        <AvatarFallback className="text-[11px]">
                          {r.teacher_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-sm">{r.teacher_name}</span>
                      <span className="hidden text-[11px] text-muted-foreground sm:inline">
                        {s === "acknowledged"
                          ? `ack ${dayjs(r.acknowledged_at!).format("D MMM, h:mm A")}`
                          : s === "read"
                            ? `read ${dayjs(r.read_at!).format("D MMM, h:mm A")}`
                            : `sent ${dayjs(r.delivered_at).format("D MMM, h:mm A")}`}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-normal",
                          s === "acknowledged" && "bg-primary text-primary-foreground",
                          s === "read" && "bg-primary/10 text-primary",
                          s === "delivered" && "text-muted-foreground"
                        )}
                      >
                        {s === "acknowledged" ? "Acknowledged" : s === "read" ? "Read" : "Delivered"}
                      </Badge>
                    </li>
                  )
                })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
