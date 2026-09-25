import { useEffect, useState } from "react"
import {
  ArrowSquareOutIcon,
  CircleNotchIcon,
  DownloadSimpleIcon,
  FileIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { PdfPages } from "@/components/shared/pdf-pages"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Attachment } from "@/modules/notifications/lib/circulars-api"

const TEXT_PREVIEW_MAX = 200 * 1024 // read at most 200 KB of a text file

// iOS Safari renders only the first page of a PDF inside an iframe and won't
// scroll it. There, opening the signed URL in a new tab gives the native
// full-screen viewer instead.
const isIOS =
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))

export function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * In-app preview for a circular attachment — nobody should have to download
 * a PDF to read a notice. Images and PDFs render via the browser (the
 * signed URL is cross-origin to Supabase storage, so it's isolated from our
 * page like any embedded document); text/CSV is fetched and shown as text;
 * Office files can't be rendered by a browser, so those say so plainly and
 * offer the download. The Download button always uses the server's
 * `download_url`, which forces Content-Disposition: attachment.
 */
export function AttachmentPreviewDialog({
  attachment,
  onClose,
}: {
  attachment: Attachment | null
  onClose: () => void
}) {
  const open = !!attachment
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92dvh] w-[min(96vw,1100px)] max-w-none flex-col gap-0 overflow-hidden p-0">
        {attachment && <PreviewBody attachment={attachment} />}
      </DialogContent>
    </Dialog>
  )
}

function PreviewBody({ attachment }: { attachment: Attachment }) {
  const [text, setText] = useState<string | null>(null)
  const [textError, setTextError] = useState(false)
  const kind = attachment.kind ?? (attachment.is_image ? "image" : "office")

  useEffect(() => {
    if (kind !== "text" || !attachment.url) return
    let cancelled = false
    setText(null)
    setTextError(false)
    fetch(attachment.url)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status))
        const blob = await r.blob()
        return blob.slice(0, TEXT_PREVIEW_MAX).text()
      })
      .then((t) => {
        if (!cancelled) setText(t)
      })
      .catch(() => {
        if (!cancelled) setTextError(true)
      })
    return () => {
      cancelled = true
    }
  }, [kind, attachment.url])

  const download = attachment.download_url ?? attachment.url ?? undefined

  return (
    <>
      <DialogHeader className="flex-row items-center justify-between gap-3 border-b px-4 py-3 text-left">
        <div className="min-w-0">
          <DialogTitle className="truncate text-sm font-medium">{attachment.name}</DialogTitle>
          <p className="text-[11px] text-muted-foreground">{fmtSize(attachment.size)}</p>
        </div>
        {download && (
          <Button asChild size="sm" variant="outline" className="mr-8 shrink-0">
            <a href={download} rel="noreferrer" aria-label="Download">
              <DownloadSimpleIcon className="size-4" />
              <span className="hidden sm:inline">Download</span>
            </a>
          </Button>
        )}
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-auto bg-muted/30">
        {!attachment.url ? (
          <Unavailable title="This file couldn't be opened" hint="The link has expired — reload the circular and try again." />
        ) : kind === "image" ? (
          <div className="flex min-h-[50vh] items-center justify-center p-4">
            <img src={attachment.url} alt={attachment.name} className="max-h-[80vh] max-w-full rounded-lg object-contain" />
          </div>
        ) : kind === "pdf" ? (
          isIOS ? (
            <Unavailable
              title="Open the PDF"
              hint="On iPhone and iPad the PDF opens full-screen in Safari's viewer."
              icon={<FileIcon className="size-8 text-muted-foreground/60" />}
              download={download}
              open={attachment.url}
            />
          ) : (
            // Rendered to canvases with pdf.js — an <iframe> is blank in
            // prod because the CSP sets frame-src 'none'.
            <div className="p-4">
              <PdfPages url={attachment.url} label="PDF" />
            </div>
          )
        ) : kind === "text" ? (
          textError ? (
            <Unavailable title="Couldn't load this file" hint="Use Download to open it on your device." />
          ) : text === null ? (
            <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
              <CircleNotchIcon className="mr-2 size-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <pre className="m-4 rounded-lg border bg-background p-4 text-xs leading-relaxed whitespace-pre-wrap break-words">
              {text}
              {attachment.size > TEXT_PREVIEW_MAX && (
                <span className="mt-3 block text-muted-foreground">… (showing the first 200 KB — download for the full file)</span>
              )}
            </pre>
          )
        ) : (
          <Unavailable
            title="Preview isn't available for this file type"
            hint="Word, Excel and PowerPoint files open in their own apps — download it to read."
            icon={<FileIcon className="size-8 text-muted-foreground/60" />}
            download={download}
          />
        )}
      </div>
    </>
  )
}

function Unavailable({
  title,
  hint,
  icon,
  download,
  open,
}: {
  title: string
  hint: string
  icon?: React.ReactNode
  download?: string
  /** Inline signed URL to open in a new tab (iOS PDF path). */
  open?: string | null
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center">
      {icon ?? <WarningCircleIcon className="size-8 text-muted-foreground/60" />}
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {open && (
          <Button asChild>
            <a href={open} target="_blank" rel="noreferrer">
              <ArrowSquareOutIcon className="size-4" />
              Open
            </a>
          </Button>
        )}
        {download && (
          <Button asChild variant={open ? "outline" : "default"}>
            <a href={download} rel="noreferrer">
              <DownloadSimpleIcon className="size-4" />
              Download
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}
