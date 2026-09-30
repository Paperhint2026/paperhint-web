import { useMemo, useState } from "react"
import { WarningCircleIcon, XIcon, EnvelopeIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useAppSelector } from "@/store"
import { useHelpDialog } from "@/components/help/help-dialog-context"

/**
 * Trial banner — sits at the top of AppLayout content, gets its state from
 * the trial slice (populated by fetchTrialStatus in AppLayoutInner). Hidden
 * when the trial is active with more than 3 days left. Two visible states:
 *
 *   - ending_soon: amber pill with a soft nudge and days_left.
 *   - expired / quota_hit: firmer teal card with a "Send us a note" CTA
 *     that opens the existing support dialog. No upgrade/payment CTA —
 *     PaperHint's pilot is pre-billing.
 *
 * Users can dismiss the ending_soon variant; the expired variant stays put
 * because writes are actually blocked and the CTA is how they get help.
 */

export function TrialBanner() {
  const status = useAppSelector((s) => s.trial.status)
  const { open: openSupport } = useHelpDialog()
  const [dismissed, setDismissed] = useState(false)

  const state = useMemo(() => {
    if (!status?.is_trialing) return null
    if (status.status === "active") return null
    return status.status
  }, [status])

  if (!state || (state === "ending_soon" && dismissed)) return null

  if (state === "ending_soon") {
    const days = status?.days_left ?? 0
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
        <WarningCircleIcon weight="fill" className="size-5 shrink-0" />
        <span className="flex-1">
          Your PaperHint trial ends in{" "}
          <span className="font-semibold">
            {days === 1 ? "1 day" : `${days} days`}
          </span>
          . <button className="underline underline-offset-2 hover:no-underline" onClick={openSupport}>Get in touch</button> before then to keep editing.
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-md p-1 text-amber-900/70 transition-colors hover:bg-amber-100/60 hover:text-amber-900 dark:text-amber-100/70 dark:hover:bg-amber-500/20 dark:hover:text-amber-50"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    )
  }

  // expired or quota_hit — same visual treatment; the copy differs.
  const isExpired = state === "expired"
  const quotaHit = status?.quotas
    ? (Object.entries(status.quotas).find(([, q]) => q.exceeded)?.[0] as
        | "grading"
        | "papers"
        | "copilot"
        | "knowledge"
        | undefined)
    : undefined

  const resourceLabel: Record<string, string> = {
    grading: "answer sheets graded",
    papers: "question papers generated",
    copilot: "Hint conversations",
    knowledge: "knowledge library uploads",
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm text-foreground dark:border-primary/50 dark:bg-primary/10">
      <WarningCircleIcon weight="fill" className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="font-medium">
          {isExpired
            ? "Your PaperHint trial has ended"
            : `You've hit the trial limit for ${quotaHit ? resourceLabel[quotaHit] : "this resource"}`}
        </p>
        <p className={cn("mt-0.5 text-muted-foreground", isExpired ? "" : "")}>
          {isExpired
            ? "You can still browse your workspace. Send us a note to keep editing."
            : "You can still use every other part of PaperHint. Send us a note to unlock more."}
        </p>
      </div>
      <button
        type="button"
        onClick={openSupport}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <EnvelopeIcon className="size-3.5" />
        Send us a note
      </button>
    </div>
  )
}
