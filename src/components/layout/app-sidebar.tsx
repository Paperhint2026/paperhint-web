import { useLocation, useNavigate } from "react-router-dom"
import {
  ContactRoundIcon,
  GraduationCapIcon,
  HomeIcon,
  SchoolIcon,
  SparklesIcon,
} from "lucide-react"

import { useAuth } from "@/lib/auth"
import { useTeacherAssignments, classLabel } from "@/hooks/use-teacher-assignments"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { NavWorkspaces } from "@/components/nav-workspaces"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
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
      title: "Ask Hint AI",
      icon: <SparklesIcon />,
      isActive: isActivePath("/ask"),
      onClick: () => handleNav("/ask"),
    },
    {
      title: "Home",
      icon: <HomeIcon />,
      isActive: location.pathname === "/",
      onClick: () => handleNav("/"),
    },
    {
      title: "Classes",
      icon: <SchoolIcon />,
      isActive: isActivePath("/classes"),
      onClick: () => handleNav("/classes"),
    },
    {
      title: "Teachers",
      icon: <ContactRoundIcon />,
      isActive: isActivePath("/teachers"),
      onClick: () => handleNav("/teachers"),
    },
    {
      title: "Students",
      icon: <GraduationCapIcon />,
      isActive: isActivePath("/students"),
      onClick: () => handleNav("/students"),
    },
  ]

  const workspaces =
    isTeacher && assignments.length > 0
      ? [
          {
            name: "Your classes",
            pages: assignments.map((a) => ({
              name: classLabel(a),
              icon: <SchoolIcon className="size-3.5" />,
              isActive: location.pathname.startsWith(`/class/${a.class_subject_id}`),
              onClick: () =>
                handleNav(`/class/${a.class_subject_id}/knowledge`),
            })),
          },
        ]
      : []

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none px-[6px]">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <SparklesIcon className="size-4" />
              </div>
              <span className="truncate font-semibold">PaperHint</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainItems} />
        {workspaces.length > 0 ? <NavWorkspaces workspaces={workspaces} /> : null}
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
      <SidebarRail />
    </Sidebar>
  )
}
