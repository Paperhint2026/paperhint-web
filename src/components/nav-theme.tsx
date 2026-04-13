import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavTheme() {
  const { theme, setTheme } = useTheme()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip="Toggle theme">
              <SunIcon className="scale-100 dark:scale-0" />
              <MoonIcon className="absolute scale-0 dark:scale-100" />
              <span>Toggle theme</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end">
            <DropdownMenuItem
              onClick={() => setTheme("light")}
              data-active={theme === "light"}
              className="gap-2 data-[active=true]:font-medium"
            >
              <SunIcon />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("dark")}
              data-active={theme === "dark"}
              className="gap-2 data-[active=true]:font-medium"
            >
              <MoonIcon />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("system")}
              data-active={theme === "system"}
              className="gap-2 data-[active=true]:font-medium"
            >
              <MonitorIcon />
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
