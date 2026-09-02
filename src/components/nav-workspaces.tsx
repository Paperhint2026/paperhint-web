import type { Icon } from "@phosphor-icons/react"

import { useState, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import {
  NAV_GROUP,
  NAV_PILL_BUTTON_RESET,
  NAV_PILL_SUB_BUTTON_RESET,
  NavPills,
} from "@/components/nav-pill"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"

/**
 * Height transition for a class's section list.
 *
 * `overflow-hidden` is applied only while the height is actually moving. Left
 * on permanently it would clip the shared nav pill as it slides down from the
 * class row into a section, since the pill renders at its destination.
 */
function ExpandCollapse({
  open,
  children,
}: {
  open: boolean
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const [animating, setAnimating] = useState(true)

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="sections"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.22, ease: [0.4, 0, 0.2, 1] }
          }
          onAnimationStart={() => setAnimating(true)}
          onAnimationComplete={() => setAnimating(false)}
          className={animating ? "overflow-hidden" : undefined}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export type NavWorkspaceSection = {
  name: string
  /** Component, not element — see NavMainItem. */
  icon?: Icon
  isActive?: boolean
  onClick: () => void
}

export type NavWorkspacePage = {
  name: string
  /** Path prefix matches — the class is open, so list its sections. */
  isOpen?: boolean
  /** Component, not element — see NavMainItem. */
  icon: Icon
  isActive?: boolean
  onClick: () => void
  /** Sections inside the class — rendered nested, only while the class is open. */
  sections?: NavWorkspaceSection[]
}

export function NavWorkspaces({
  workspaces,
  hovered,
  onHover,
}: {
  workspaces: {
    name: string
    pages: NavWorkspacePage[]
  }[]
  /** Shared with the other groups — see NavMain. */
  hovered: string | null
  onHover: (key: string | null) => void
}) {
  const { state, isMobile } = useSidebar()

  // See NavMain: layout animation and the collapsed-to-icons width transition
  // fight each other, so the pills stand down while the rail is collapsed.
  const animated = isMobile || state === "expanded"

  const allPages = workspaces.flatMap((w) => w.pages)

  if (allPages.length === 0) {
    return null
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Your classes</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {allPages.map((page) => (
            <SidebarMenuItem key={page.name}>
              {/* The pills wrap the button alone — the list item also holds the
                  nested sections, and inset-0 there would span both. */}
              <div className="relative" onMouseEnter={() => onHover(page.name)}>
                {animated ? (
                  <NavPills
                    groupId={NAV_GROUP}
                    isActive={!!page.isActive}
                    isHovered={hovered === page.name}
                  />
                ) : null}
                <SidebarMenuButton
                  isActive={page.isActive}
                  tooltip={page.name}
                  onClick={page.onClick}
                  className={cn(animated && NAV_PILL_BUTTON_RESET)}
                >
                  <page.icon
                    weight={page.isActive ? "fill" : "regular"}
                    className="size-3.5"
                  />
                  <span>{page.name}</span>
                </SidebarMenuButton>
              </div>
              <ExpandCollapse
                open={Boolean(page.isOpen && page.sections?.length)}
              >
                <SidebarMenuSub>
                  {(page.sections ?? []).map((section) => (
                    <SidebarMenuSubItem
                      key={section.name}
                      onMouseEnter={() => onHover(section.name)}
                    >
                      {animated ? (
                        <NavPills
                          groupId={NAV_GROUP}
                          isActive={!!section.isActive}
                          isHovered={hovered === section.name}
                        />
                      ) : null}
                      <SidebarMenuSubButton
                        asChild
                        isActive={section.isActive}
                        className={cn(
                          "w-full cursor-pointer text-left",
                          animated && NAV_PILL_SUB_BUTTON_RESET
                        )}
                      >
                        <button type="button" onClick={section.onClick}>
                          {section.icon ? (
                            <section.icon
                              weight={section.isActive ? "fill" : "regular"}
                              className="size-3.5 shrink-0"
                            />
                          ) : null}
                          <span>{section.name}</span>
                        </button>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </ExpandCollapse>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
