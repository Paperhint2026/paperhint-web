import { useEffect, useMemo, useRef, useState } from "react"
import { EnvelopeIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useAppSelector } from "@/store"
import { useHelpDialog } from "@/components/help/help-dialog-context"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * Active-trial indicator — a small chip in the sidebar footer (desktop) and
 * the mobile top bar. Progressive disclosure: it starts almost invisible for
 * days 14→8, warms slightly for 7→4, then hands off to the amber-in-top-slot
 * TrialBanner for the final 3 days. On expired / quota_hit the pill hides —
 * the teal banner takes over.
 *
 * Click opens a compact popover with per-resource counters + a Get-in-touch
 * button. Numbers not progress bars (bars invite loss-aversion; a solo
 * teacher opening the app to grade tomorrow's papers should not feel
 * "you're running out"). See the wave 1 trial-UI design chat.
 */

type Variant = "sidebar" | "mobile"

export function TrialPill({ variant = "sidebar" }: { variant?: Variant }) {
  const status = useAppSelector((s) => s.trial.status)
  const { open: openSupport } = useHelpDialog()
  // Play the dot ripple once every time the pill mounts — that is, on a
  // fresh app load or a hard reload, not on route changes (the sidebar
  // stays mounted across those). armed.current keeps it from re-firing if
  // is_trialing flips on a background refetch. Ripple is clipped to the
  // pill by `overflow-hidden` on the button.
  const [showWave, setShowWave] = useState(false)
  const armed = useRef(false)
  useEffect(() => {
    if (armed.current || !status?.is_trialing) return
    armed.current = true
    setShowWave(true)
    const t = window.setTimeout(() => setShowWave(false), 5_500)
    return () => window.clearTimeout(t)
  }, [status?.is_trialing])

  const tone = useMemo(() => {
    if (!status?.is_trialing) return null
    if (status.status !== "active") return null // banner handles ending_soon+
    const days = status.days_left ?? 999
    if (days <= 7) return "warm"
    return "quiet"
  }, [status])

  if (!tone) return null
  const days = status?.days_left ?? 0
  const dayLabel = days === 1 ? "1 day" : `${days} days`

  const quotas = status?.quotas
  const resources: {
    key: "grading" | "papers" | "copilot" | "knowledge"
    label: string
  }[] = [
    { key: "grading", label: "Answer sheets graded" },
    { key: "papers", label: "Question papers" },
    { key: "copilot", label: "Ask Hint queries" },
    { key: "knowledge", label: "Knowledge uploads" },
  ]

  const isMobile = variant === "mobile"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Trial · ${dayLabel} left. Open trial details`}
          className={cn(
            "group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border font-medium transition-colors",
            isMobile ? "px-2 py-0.5 text-[11px]" : "w-full justify-between px-2.5 py-1.5 text-[12px]",
            tone === "quiet"
              ? "border-primary/20 bg-primary/[0.06] text-foreground hover:bg-primary/10"
              : "border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15"
          )}
        >
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "block size-1.5 rounded-full bg-primary text-primary",
                showWave && "trial-dot-wave",
                tone === "warm" && "animate-[pulse_2s_ease-in-out_infinite]"
              )}
              aria-hidden
            />
            {isMobile ? (
              <>
                <span className="tabular-nums">{days}d</span>
                <span>trial</span>
              </>
            ) : (
              <>
                Trial · <span className="font-normal text-muted-foreground">{dayLabel}</span>
              </>
            )}
          </span>
          {!isMobile && (
            <span className="text-[10px] text-muted-foreground group-hover:text-foreground">▸</span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={isMobile ? "end" : "start"}
        side={isMobile ? "bottom" : "top"}
        sideOffset={8}
        className="w-72 p-0"
      >
        <div className="border-b px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">Free trial</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{dayLabel}</span> left
            </p>
          </div>
          {status?.trial_ends_at && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Ends {new Date(status.trial_ends_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </p>
          )}
        </div>

        {quotas ? (
          <ul className="flex flex-col divide-y">
            {resources.map((r) => {
              const q = quotas[r.key]
              if (!q) return null
              return (
                <li
                  key={r.key}
                  className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]"
                >
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="tabular-nums text-foreground">
                    {q.used}/{q.cap}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}

        <div className="border-t p-3">
          <button
            type="button"
            onClick={() => openSupport()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <EnvelopeIcon className="size-4" />
            Get in touch
          </button>
          <p className="mt-2 text-[10.5px] leading-4 text-muted-foreground">
            On day {(status?.days_left ?? 0) + 1 > 14 ? 15 : 15}, editing pauses until you get in
            touch. Your workspace stays yours — reads keep working forever.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
