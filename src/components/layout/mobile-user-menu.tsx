import { useNavigate } from "react-router-dom"
import {
  BuildingsIcon,
  GearIcon,
  MonitorIcon,
  MoonIcon,
  QuestionIcon,
  SignOutIcon,
  SunIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { tameCaps } from "@/lib/format"
import { useAuth } from "@/lib/auth"
import { useAppSelector } from "@/store"
import { useTheme } from "@/components/theme-provider"
import { useHelpDialog } from "@/components/help/help-dialog-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Mobile top-bar profile dropdown. Same content shape as the desktop
 * NavUser (school, identity, Settings, Help, Appearance, Log out) but
 * triggered by the plain avatar in the top bar instead of the
 * sidebar-shaped button. The sidebar hamburger opens navigation only;
 * this opens the profile.
 */

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/** Strip the "…, CBSE" tail some school names carry — the board isn't
 *  part of the name; mirrors the same helper in NavUser. */
function schoolName(name: string) {
  return name.replace(
    /\s*[,(–-]\s*(CBSE|ICSE|IB|IGCSE|STATE BOARD)[^,)]*\)?\s*$/i,
    ""
  )
}

const THEMES = [
  { value: "light" as const, label: "Light", icon: SunIcon },
  { value: "dark" as const, label: "Dark", icon: MoonIcon },
  { value: "system" as const, label: "Auto", icon: MonitorIcon },
]

export function MobileUserMenu() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const help = useHelpDialog()
  const school = useAppSelector((s) => s.school.school)

  if (!user) return null
  const fallback = user.full_name ? initialsFromName(user.full_name) : "PH"

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="ml-0.5 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Avatar className="size-7">
            {user.profile_url && <AvatarImage src={user.profile_url} alt="" />}
            <AvatarFallback className="text-[11px]">{fallback || "?"}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-72 rounded-xl p-0"
        align="end"
        side="bottom"
        sideOffset={8}
      >
        {school?.name && (
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <BuildingsIcon weight="duotone" className="size-5 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold text-foreground">
              {tameCaps(schoolName(school.name))}
            </span>
          </div>
        )}

        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Avatar className="size-11 rounded-full ring-2 ring-background">
              {user.profile_url && <AvatarImage src={user.profile_url} alt={user.full_name} />}
              <AvatarFallback className="rounded-full text-sm">{fallback}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-foreground">
                {user.full_name}
              </span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-0" />

        <DropdownMenuGroup className="p-1.5">
          <DropdownMenuItem
            onClick={() => navigate("/settings")}
            className="gap-2.5 rounded-lg px-2.5 py-2"
          >
            <GearIcon className="size-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => help.open()}
            className="gap-2.5 rounded-lg px-2.5 py-2"
          >
            <QuestionIcon className="size-4" />
            Help & support
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-0" />

        <div className="flex flex-col gap-2 px-4 py-3">
          <span className="text-[11px] font-medium text-muted-foreground">Appearance</span>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-sidebar p-1">
            {THEMES.map((t) => {
              const active = theme === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTheme(t.value)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-colors",
                    active
                      ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <t.icon className="size-3.5" weight={active ? "fill" : "regular"} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <DropdownMenuSeparator className="my-0" />

        <div className="p-1.5">
          <DropdownMenuItem
            onClick={handleLogout}
            className="gap-2.5 rounded-lg px-2.5 py-2 text-muted-foreground focus:text-destructive"
          >
            <SignOutIcon className="size-4" />
            Log out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
