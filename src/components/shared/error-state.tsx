import { useState } from "react"
import {
  ArrowClockwiseIcon,
  CheckIcon,
  CopyIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sticker } from "@/components/shared/sticker"

/**
 * The single "something went wrong" surface used in place of a naked
 * empty state when a fetch fails. Two sizes:
 *   size="page"  — a whole page's fetch failed. Sticker + heading + retry.
 *   size="card"  — a widget or list on an otherwise working page.
 *
 * Distinguishes ITSELF from empty states on purpose: silently rendering
 * "Nothing yet" on a 500 has fooled a teacher into thinking "there's just
 * no data" when the API was actually down. This surface makes the failure
 * visible AND gives the teacher a Retry button.
 *
 * The message body is what api-client threw — in prod that's the sanitized
 * "Something went wrong…" string from the server-side hygiene layer, and
 * the request_id (surfaced with a Copy button) is what support greps by.
 */
export function ErrorState({
  error,
  onRetry,
  title = "Couldn't load this",
  size = "card",
  className,
}: {
  error: unknown
  onRetry?: () => void
  title?: string
  size?: "page" | "card"
  className?: string
}) {
  const message =
    error instanceof Error
      ? error.message
      : String(error ?? "Something went wrong")
  const requestId =
    error && typeof error === "object" && "request_id" in error
      ? ((error as { request_id?: string | null }).request_id ?? null)
      : null

  const [copied, setCopied] = useState(false)
  const copyToClipboard = async () => {
    const payload = requestId
      ? `${message}\n\nRequest ID: ${requestId}`
      : message
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked; the id is still on screen to type */
    }
  }

  const isPage = size === "page"

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 text-center",
        isPage ? "px-6 py-16" : "px-4 py-10",
        className
      )}
    >
      {isPage ? (
        <Sticker name="error" size={96} />
      ) : (
        <WarningCircleIcon
          aria-hidden
          className="size-8 text-destructive/70"
          weight="regular"
        />
      )}
      <div className="flex max-w-md flex-col gap-1">
        <p
          className={cn(
            "font-medium text-foreground",
            isPage ? "text-base" : "text-sm"
          )}
        >
          {title}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {message}
        </p>
        {requestId && (
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/80">
            Request ID: {requestId}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button size={isPage ? "default" : "sm"} onClick={onRetry}>
            <ArrowClockwiseIcon className="size-4" />
            Try again
          </Button>
        )}
        <Button
          size={isPage ? "default" : "sm"}
          variant="outline"
          onClick={() => void copyToClipboard()}
        >
          {copied ? (
            <>
              <CheckIcon className="size-4" />
              Copied
            </>
          ) : (
            <>
              <CopyIcon className="size-4" />
              Copy details
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
