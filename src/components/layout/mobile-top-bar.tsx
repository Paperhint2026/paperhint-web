import { useNavigate } from "react-router-dom"

import { cn } from "@/lib/utils"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { PaperhintMark } from "@/components/shared/paperhint-mark"
import { PaperhintWordmark } from "@/components/shared/paperhint-wordmark"
import { NotificationsBell } from "@/components/layout/notifications-bell"
import { TrialPill } from "@/components/layout/trial-pill"
import { MobileUserMenu } from "@/components/layout/mobile-user-menu"

/** Bar is 3.5rem, plus the phone's top inset ONLY in standalone (PWA) mode —
 *  see .ph-topbar in index.css. The page scroller pads by the same amount
 *  (.ph-topbar-pad) so content never sits under the bar. */
export const MOBILE_TOP_BAR_H = "box-content h-14 ph-topbar"
export const MOBILE_TOP_BAR_PAD = "ph-topbar-pad"

/**
 * The phone's app bar: menu · logo · bell · avatar. Replaces the floating
 * sidebar trigger that used to sit on top of page titles. Pinned to the top
 * of the shell (the page scroller pads its top by the bar's height), so the
 * bar never moves and content never sits under it — only the page scrolls.
 */
export function MobileTopBar() {
  const navigate = useNavigate()

  return (
    <header
      className={cn(
        "absolute inset-x-0 top-0 z-20 flex items-center gap-1 border-b bg-background/95 px-2 backdrop-blur",
        MOBILE_TOP_BAR_H
      )}
    >
      <SidebarTrigger className="shrink-0" />

      <button
        type="button"
        onClick={() => navigate("/")}
        aria-label="Home"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1"
      >
        <PaperhintMark className="size-6 shrink-0 text-primary" />
        <PaperhintWordmark className="min-w-0 truncate text-base text-foreground" />
      </button>

      {/* Compact trial chip — appears only during active trial, days 14→4.
          The amber/teal top-banner variants take over once the trial is
          nearly done or over. */}
      <TrialPill variant="mobile" />

      <NotificationsBell />

      {/* Avatar opens the profile dropdown (identity, Settings, theme,
          Log out). Navigation lives on the hamburger. */}
      <MobileUserMenu />
    </header>
  )
}
