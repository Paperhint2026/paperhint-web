import type { Icon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import {
  NAV_GROUP,
  NAV_PILL_BUTTON_RESET,
  NavPills,
} from "@/components/nav-pill"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export type NavMainItem = {
  title: string
  /** The Phosphor icon itself, not an element — the selected row renders it
   *  at `fill` weight, which needs the component. */
  icon: Icon
  isActive?: boolean
  onClick: () => void
}

export function NavMain({
  items,
  label,
  hovered,
  onHover,
}: {
  items: NavMainItem[]
  /** Optional group heading — omit for the primary (unlabelled) group. */
  label?: string
  /** Hover key, shared across every group so the pill can cross a heading. */
  hovered: string | null
  onHover: (key: string) => void
}) {
  const { state, isMobile } = useSidebar()

  // Collapsed to icons, the buttons are narrower than their row and are mid
  // CSS transition on width and padding — measuring a layout animation against
  // that distorts it. There the button's own data-active styling takes over.
  const animated = isMobile || state === "expanded"

  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem
              key={item.title}
              onMouseEnter={() => onHover(item.title)}
            >
              {animated ? (
                <NavPills
                  groupId={NAV_GROUP}
                  isActive={!!item.isActive}
                  isHovered={hovered === item.title}
                />
              ) : null}
              <SidebarMenuButton
                isActive={item.isActive}
                tooltip={item.title}
                onClick={item.onClick}
                className={cn(animated && NAV_PILL_BUTTON_RESET)}
              >
                <item.icon weight={item.isActive ? "fill" : "regular"} />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
