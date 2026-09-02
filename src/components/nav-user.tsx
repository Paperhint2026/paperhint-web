import {
  BuildingsIcon,
  CaretUpDownIcon,
  GearIcon,
  MonitorIcon,
  MoonIcon,
  QuestionIcon,
  SignOutIcon,
  SunIcon,
} from "@phosphor-icons/react"
import { useNavigate } from "react-router-dom"

import { cn } from "@/lib/utils"
import { tameCaps } from "@/lib/format"
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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/** "VELAMMAL VIDYALAYA, CBSE" → "VELAMMAL VIDYALAYA": the board rides along
 *  in some school names, and it is not part of the name. */
function schoolName(name: string) {
  return name.replace(
    /\s*[,(–-]\s*(CBSE|ICSE|IB|IGCSE|STATE BOARD)[^,)]*\)?\s*$/i,
    ""
  )
}

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "Auto", icon: MonitorIcon },
] as const

export function NavUser({
  user,
  onLogout,
}: {
  user: {
    name: string
    email: string
    avatar?: string | null
  }
  onLogout: () => void
}) {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const help = useHelpDialog()
  const school = useAppSelector((s) => s.school.school)
  const fallback = user.name ? initialsFromName(user.name) : "PH"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-full">
                {user.avatar ? (
                  <AvatarImage src={user.avatar} alt={user.name} />
                ) : null}
                <AvatarFallback className="rounded-full">
                  {fallback}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
              </div>
              <CaretUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-72 rounded-xl p-0"
            // Opens upward off the footer button on both platforms — there is
            // nothing below it to open into.
            side="top"
            align="start"
            sideOffset={8}
          >
            {/* School — the workspace everything below belongs to */}
            {school?.name && (
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                <BuildingsIcon
                  weight="duotone"
                  className="size-5 shrink-0 text-primary"
                />
                <span className="truncate text-sm font-semibold text-foreground">
                  {tameCaps(schoolName(school.name))}
                </span>
              </div>
            )}

            {/* Identity */}
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Avatar className="size-11 rounded-full ring-2 ring-background">
                  {user.avatar ? (
                    <AvatarImage src={user.avatar} alt={user.name} />
                  ) : null}
                  <AvatarFallback className="rounded-full text-sm">
                    {fallback}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {user.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="my-0" />

            {/* Links */}
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

            {/* Appearance */}
            <div className="flex flex-col gap-2 px-4 py-3">
              <span className="text-[11px] font-medium text-muted-foreground">
                Appearance
              </span>
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
                      <t.icon
                        className="size-3.5"
                        weight={active ? "fill" : "regular"}
                      />
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <DropdownMenuSeparator className="my-0" />

            <div className="p-1.5">
              <DropdownMenuItem
                onClick={onLogout}
                className="gap-2.5 rounded-lg px-2.5 py-2 text-muted-foreground focus:text-destructive"
              >
                <SignOutIcon className="size-4" />
                Log out
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
