import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { AnimatePresence } from "motion/react"
import {
  PaletteIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth"
import { useAppSelector } from "@/store"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  SettingsNav,
  type SettingsSection,
  type SettingsSectionId,
} from "@/modules/settings/components/settings-nav"
import { ProfileSection } from "@/modules/settings/components/profile-section"
import { SecuritySection } from "@/modules/settings/components/security-section"
import { AppearanceSection } from "@/modules/settings/components/appearance-section"

const SECTIONS: SettingsSection[] = [
  {
    id: "profile",
    label: "Profile",
    hint: "Photo, name and contact",
    icon: UserCircleIcon,
  },
  {
    id: "security",
    label: "Security",
    hint: "Password",
    icon: ShieldCheckIcon,
  },
  {
    id: "appearance",
    label: "Appearance",
    hint: "Light, dark or system",
    icon: PaletteIcon,
  },
]

const SECTION_IDS = new Set<string>(SECTIONS.map((s) => s.id))

function isSectionId(v: string): v is SettingsSectionId {
  return SECTION_IDS.has(v)
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Settings: a section rail on the left, one section at a time on the right.
 * The open section lives in the URL hash (`/settings#security`) so a reload
 * or a shared link lands on the same place, and the sections swap with a
 * short rise so the change of subject is felt without a page flash.
 */
export function SettingsPage() {
  const { user } = useAuth()
  const school = useAppSelector((s) => s.school.school)
  const location = useLocation()
  const navigate = useNavigate()

  const fromHash = location.hash.replace(/^#/, "")
  const [active, setActive] = useState<SettingsSectionId>(
    isSectionId(fromHash) ? fromHash : "profile"
  )

  // Back/forward through hashes keeps the rail in step.
  useEffect(() => {
    const h = location.hash.replace(/^#/, "")
    if (isSectionId(h) && h !== active) setActive(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash])

  // Edge fades only where there is more to scroll to: a fade over content
  // that is already fully in view just hides the card's border.
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ top: false, bottom: false })
  const measure = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const top = el.scrollTop > 2
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2
    setEdges((prev) =>
      prev.top === top && prev.bottom === bottom ? prev : { top, bottom }
    )
  }, [])
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    // Content height changes as sections swap and animate in, and as the
    // window resizes; the observer catches all of it without a resize handler.
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    const mo = new MutationObserver(() => {
      for (const child of Array.from(el.children)) ro.observe(child)
      measure()
    })
    mo.observe(el, { childList: true })
    measure()
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [measure, active])

  const select = (id: SettingsSectionId) => {
    setActive(id)
    navigate({ hash: id === "profile" ? "" : `#${id}` }, { replace: true })
  }

  if (!user) return null

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "flex h-full min-h-0 flex-col gap-6 lg:gap-8"
      )}
    >
      {/* ── Page header: who this is ── */}
      <header className="flex flex-wrap items-center gap-4">
        <Avatar className="size-12 ring-2 ring-border">
          {user.profile_url ? (
            <img
              src={user.profile_url}
              alt=""
              className="aspect-square size-full rounded-full object-cover"
            />
          ) : (
            <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
          )}
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
              {user.full_name}
            </h1>
            {user.role ? (
              <Badge variant="secondary" className="capitalize">
                {user.role}
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {[user.designation, school?.name].filter(Boolean).join(" · ") ||
              user.email}
          </p>
        </div>
      </header>

      {/* ── Rail + section ── */}
      {/* Header and rail stay put; only the section column scrolls, so the
          rail is always in reach and the save bar pins to this column's edge. */}
      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10">
        <aside className="lg:self-start">
          <SettingsNav sections={SECTIONS} active={active} onChange={select} />
        </aside>

        {/* The scroller. Fades at both ends say "there is more" without a
            hard cut, and the gutter keeps the cards clear of the scrollbar. */}
        <div className="relative min-h-0 min-w-0 lg:max-w-3xl">
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-background to-transparent transition-opacity duration-200",
              edges.top ? "opacity-100" : "opacity-0"
            )}
          />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-background to-transparent transition-opacity duration-200",
              edges.bottom ? "opacity-100" : "opacity-0"
            )}
          />
          <div
            ref={scrollerRef}
            onScroll={measure}
            className="h-full min-h-0 overflow-y-auto pr-4 pb-16 pl-1 [scrollbar-gutter:stable]"
          >
            <AnimatePresence mode="wait" initial={false}>
              {active === "profile" ? (
                <ProfileSection key="profile" user={user} />
              ) : active === "security" ? (
                <SecuritySection key="security" />
              ) : (
                <AppearanceSection key="appearance" />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
