import { useEffect, useRef, useState } from "react"
import { ArrowSquareOutIcon, CircleNotchIcon } from "@phosphor-icons/react"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * In-app PDF viewer that renders every page to a <canvas> with pdf.js.
 *
 * Why not an <iframe>: the production CSP sets `frame-src 'none'` (deliberate
 * XSS hardening), so any framed PDF is blank in prod — and iOS Safari can't
 * scroll framed PDFs anyway. pdf.js is bundled locally (script-src 'self';
 * the worker inherits that) and fetches the signed URL over the open
 * connect-src, so this works everywhere the app does.
 *
 * pdf.js itself is loaded on demand so it stays out of the main bundle.
 */

type Status = "loading" | "ready" | "error"

export function PdfPages({
  url,
  className,
  /** Shown in the error fallback ("Open <label> in a new tab"). */
  label = "PDF",
}: {
  url: string
  className?: string
  label?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>("loading")
  const [pageCount, setPageCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    let doc: { destroy: () => Promise<void> } | null = null
    const container = containerRef.current
    if (!container) return

    setStatus("loading")
    container.replaceChildren()

    ;(async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
        const loaded = await pdfjs.getDocument({ url }).promise
        if (cancelled) {
          await loaded.destroy()
          return
        }
        doc = loaded
        setPageCount(loaded.numPages)

        // Fit each page to the container width, rendered at device pixel
        // ratio so handwriting stays crisp when the user zooms the page.
        const width = Math.max(container.clientWidth, 1)
        const dpr = Math.min(window.devicePixelRatio || 1, 3)

        for (let i = 1; i <= loaded.numPages; i++) {
          if (cancelled) return
          const page = await loaded.getPage(i)
          const base = page.getViewport({ scale: 1 })
          const scale = width / base.width
          const viewport = page.getViewport({ scale: scale * dpr })

          const canvas = document.createElement("canvas")
          canvas.width = Math.round(viewport.width)
          canvas.height = Math.round(viewport.height)
          canvas.style.width = `${width}px`
          canvas.style.height = `${Math.round(viewport.height / dpr)}px`
          canvas.className =
            "block rounded-lg border border-border bg-background shadow-sm"
          canvas.setAttribute("aria-label", `Page ${i} of ${loaded.numPages}`)
          const ctx = canvas.getContext("2d")
          if (!ctx) continue

          container.appendChild(canvas)
          await page.render({ canvasContext: ctx, viewport, canvas }).promise
        }
        if (!cancelled) setStatus("ready")
      } catch (err) {
        if (!cancelled) {
          console.error("[PdfPages] render failed:", err)
          setStatus("error")
        }
      }
    })()

    return () => {
      cancelled = true
      void doc?.destroy()
    }
  }, [url])

  return (
    <div className={cn("relative", className)}>
      {status === "loading" && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <CircleNotchIcon className="size-4 animate-spin" />
          Loading {label.toLowerCase()}…
        </div>
      )}
      {status === "error" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn't display this {label.toLowerCase()} here.
          </p>
          <Button size="sm" onClick={() => window.open(url, "_blank")}>
            <ArrowSquareOutIcon className="size-4" />
            Open {label.toLowerCase()} in a new tab
          </Button>
        </div>
      )}
      {/* Pages are appended here as they render, so long PDFs show
          page 1 while the rest are still being drawn. */}
      <div
        ref={containerRef}
        className="flex flex-col gap-3"
        aria-busy={status === "loading"}
        data-pages={pageCount}
      />
    </div>
  )
}
