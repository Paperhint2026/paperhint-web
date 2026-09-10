import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  BookOpenIcon,
  ChalkboardIcon,
  ExamIcon,
  ListChecksIcon,
  UsersIcon,
} from "@phosphor-icons/react"
import { isNavItemActive, navForRole } from "@/data/nav"
import { useViewRole } from "@/lib/view-role"
import { useAuth } from "@/lib/auth"
import {
  useTeacherAssignments,
  classLabel,
} from "@/hooks/use-teacher-assignments"
import { SidebarIcon } from "@phosphor-icons/react"
import { PaperhintMark } from "@/components/shared/paperhint-mark"
import { PaperhintWordmark } from "@/components/shared/paperhint-wordmark"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { NavViewRole } from "@/components/nav-view-role"
import { NavWorkspaces } from "@/components/nav-workspaces"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** Sections inside a class, in the order they appear under the class in the nav. */
const CLASS_SECTIONS = [
  { slug: "knowledge", label: "Knowledge", icon: BookOpenIcon },
  { slug: "exams", label: "Exams", icon: ExamIcon },
  { slug: "grading", label: "Grading", icon: ListChecksIcon },
  { slug: "students", label: "Students", icon: UsersIcon },
] as const

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar()

  // On mobile the sidebar is a sheet, never a rail, so it is never icon-mode.
  const iconMode = state === "collapsed" && !isMobile

  const [hoveredNav, setHoveredNav] = useState<string | null>(null)
  const { assignments } = useTeacherAssignments()
  const { role: viewRole } = useViewRole()
  const isTeacher = viewRole === "teacher"

  const closeMobileThen = (fn: () => void) => {
    if (isMobile) {
      setOpenMobile(false)
      setTimeout(fn, 300)
    } else {
      fn()
    }
  }

  const handleNav = (path: string) => {
    closeMobileThen(() => navigate(path))
  }

  const handleLogout = () => {
    closeMobileThen(() => {
      logout()
      navigate("/login")
    })
  }

  // The menu is per role; the shell is shared. See src/data/nav.ts.
  const navGroups = navForRole(viewRole).map((group) => ({
    label: group.label,
    items: group.items.map((item) => ({
      title: item.title,
      icon: item.icon,
      soon: item.status === "soon",
      isActive: isNavItemActive(item, location.pathname),
      onClick: () => handleNav(item.path),
    })),
  }))

  const workspaces =
    isTeacher && assignments.length > 0
      ? [
          {
            name: "Your classes",
            pages: assignments.map((a) => {
              const base = `/class/${a.class_subject_id}`
              return {
                name: classLabel(a),
                icon: ChalkboardIcon,
                // Selected is exact — on /class/x/exams the section is the
                // selected row, not the class. Open is the prefix, so the
                // sections stay listed while you are inside the class.
                isActive: location.pathname === base,
                isOpen: location.pathname.startsWith(base),
                // Land on the class home — an overview of everything happening
                // in the class, with links into each area.
                onClick: () => handleNav(base),
                // Nested shortcuts, shown only while this class is open.
                sections: CLASS_SECTIONS.map((section) => ({
                  name: section.label,
                  icon: section.icon,
                  isActive: location.pathname.startsWith(
                    `${base}/${section.slug}`
                  ),
                  onClick: () => handleNav(`${base}/${section.slug}`),
                })),
              }
            }),
          },
        ]
      : []

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="h-14 justify-center">
        <div className="flex w-full items-center gap-2 px-1">
          {iconMode ? (
            // Collapsed there is no room for a separate control, so the mark
            // carries it: hovering swaps it for the toggle.
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label="Expand sidebar"
                  className="group/logo relative grid size-6 shrink-0 place-items-center rounded-md transition-colors hover:bg-sidebar-accent"
                >
                  <PaperhintMark className="size-6 text-primary transition-opacity group-hover/logo:opacity-0" />
                  <SidebarIcon
                    aria-hidden
                    className="absolute size-4 text-sidebar-foreground opacity-0 transition-opacity group-hover/logo:opacity-100"
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <PaperhintMark className="size-7 shrink-0 text-primary" />
              <PaperhintWordmark className="min-w-0 flex-1 truncate text-base text-foreground" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    className="grid size-7 shrink-0 place-items-center rounded-md text-sidebar-label transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <SidebarIcon aria-hidden className="size-4" />
                    <span className="sr-only">Collapse sidebar</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Collapse sidebar</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* One hover key for every group, cleared once on leaving the whole
            nav — per-list state let two groups both claim the pill mid-move. */}
        <div
          className="flex min-h-0 flex-col"
          onMouseLeave={() => setHoveredNav(null)}
        >
          {navGroups.map((group, i) => (
            <NavMain
              key={group.label ?? `group-${i}`}
              items={group.items}
              label={group.label}
              hovered={hoveredNav}
              onHover={setHoveredNav}
            />
          ))}
          {workspaces.length > 0 ? (
            <NavWorkspaces
              workspaces={workspaces}
              hovered={hoveredNav}
              onHover={setHoveredNav}
            />
          ) : null}
        </div>
      </SidebarContent>
      <SidebarFooter>
        <NavViewRole />
        {user ? (
          <NavUser
            user={{
              name: user.full_name,
              email: user.email,
              avatar: user.profile_url,
            }}
            onLogout={handleLogout}
          />
        ) : null}
      </SidebarFooter>
    </Sidebar>
  )
}
