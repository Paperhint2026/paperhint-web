import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  BookOpenIcon,
  BooksIcon,
  ChalkboardIcon,
  ExamIcon,
  GraduationCapIcon,
  HouseIcon,
  IdentificationCardIcon,
  ListChecksIcon,
  SparkleIcon,
  UsersIcon,
} from "@phosphor-icons/react"
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
  const isTeacher = user?.role === "teacher"

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

  const isActivePath = (path: string) => {
    if (path === "/") return location.pathname === "/"
    return location.pathname.startsWith(path)
  }

  const mainItems = [
    {
      title: "Home",
      icon: HouseIcon,
      isActive: location.pathname === "/",
      onClick: () => handleNav("/"),
    },
    {
      title: "Ask Hint",
      icon: SparkleIcon,
      isActive: isActivePath("/ask"),
      onClick: () => handleNav("/ask"),
    },
    {
      title: "Classes",
      icon: ChalkboardIcon,
      isActive: isActivePath("/classes"),
      onClick: () => handleNav("/classes"),
    },
    {
      title: "Teachers",
      icon: IdentificationCardIcon,
      isActive: isActivePath("/teachers"),
      onClick: () => handleNav("/teachers"),
    },
    {
      title: "Students",
      icon: GraduationCapIcon,
      isActive: isActivePath("/students"),
      onClick: () => handleNav("/students"),
    },
  ]

  const libraryItems = [
    {
      title: "Knowledge Library",
      icon: BookOpenIcon,
      // Active only on /library itself (not /library/bank); the Bank has
      // its own entry below and we don't want both highlighted at once.
      isActive: location.pathname === "/library",
      onClick: () => handleNav("/library"),
    },
    {
      title: "Shared Library",
      icon: BooksIcon,
      isActive: isActivePath("/library/bank"),
      onClick: () => handleNav("/library/bank"),
    },
  ]

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
          <NavMain
            items={mainItems}
            hovered={hoveredNav}
            onHover={setHoveredNav}
          />
          <NavMain
            items={libraryItems}
            label="Library"
            hovered={hoveredNav}
            onHover={setHoveredNav}
          />
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
