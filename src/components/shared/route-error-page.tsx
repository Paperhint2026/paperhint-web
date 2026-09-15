import { useState } from "react"
import {
  isRouteErrorResponse,
  useNavigate,
  useRouteError,
} from "react-router-dom"
import {
  ArrowClockwiseIcon,
  CheckIcon,
  CopyIcon,
  HouseIcon,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Sticker } from "@/components/shared/sticker"

/**
 * The page for when a route itself breaks — a crash, not an empty state a
 * page already handles on its own. React Router's default is a raw stack
 * trace; a school admin should never see that (founder, 2026-09-15: "we
 * need to create a custom screen for this error").
 */
export function RouteErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const status = isRouteErrorResponse(error) ? error.status : null
  const message = isRouteErrorResponse(error)
    ? error.statusText || error.data?.message || "That page could not load"
    : error instanceof Error
      ? error.message
      : String(error ?? "Something went wrong")
  const stack = error instanceof Error ? error.stack : undefined

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(stack ?? message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked; the message is still on screen to read */
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 py-16 text-center">
      <Sticker name="worried" size={104} />
      <div className="flex max-w-md flex-col gap-1">
        <p className="text-base font-medium text-foreground">
          {status ? `${status} — this page hit a snag` : "This page hit a snag"}
        </p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => navigate(0)}>
          <ArrowClockwiseIcon className="size-4" />
          Reload
        </Button>
        <Button variant="outline" onClick={() => navigate("/")}>
          <HouseIcon className="size-4" />
          Go home
        </Button>
        <Button variant="ghost" onClick={copy}>
          {copied ? (
            <CheckIcon className="size-4" />
          ) : (
            <CopyIcon className="size-4" />
          )}
          {copied ? "Copied" : "Copy error"}
        </Button>
      </div>
    </div>
  )
}
