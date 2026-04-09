import { useLocation, useNavigate, useParams } from "react-router-dom"
import {
  ContactRoundIcon,
  GraduationCapIcon,
  HelpCircleIcon,
  HomeIcon,
  LogOutIcon,
  SchoolIcon,
  SettingsIcon,
} from "lucide-react"

import { useAuth } from "@/lib/auth"
import { useTeacherAssignments, classLabel } from "@/hooks/use-teacher-assignments"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"

const adminNavItems = [
  { label: "Home", icon: HomeIcon, path: "/" },
  { label: "Classes", icon: SchoolIcon, path: "/classes" },
  { label: "Teachers", icon: ContactRoundIcon, path: "/teachers" },
  { label: "Students", icon: GraduationCapIcon, path: "/students" },
]

const bottomNavItems = [
  { label: "Settings", icon: SettingsIcon, path: "/settings" },
  { label: "Help", icon: HelpCircleIcon, path: "/help" },
]

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()
  const { user, logout } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const { assignments } = useTeacherAssignments()
  const isTeacher = user?.role === "teacher"

  const activeClassSubjectId = params.classSubjectId || ""

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/"
    return location.pathname.startsWith(path)
  }

  const handleNav = (path: string) => {
    if (isMobile) {
      setOpenMobile(false)
      setTimeout(() => navigate(path), 300)
    } else {
      navigate(path)
    }
  }

  const handleLogout = () => {
    if (isMobile) {
      setOpenMobile(false)
      setTimeout(() => {
        logout()
        navigate("/login")
      }, 300)
    } else {
      logout()
      navigate("/login")
    }
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 p-2">
          <Avatar>
            {user?.profile_url ? (
              <img
                src={user.profile_url}
                alt={user.full_name}
                className="aspect-square size-full rounded-full object-cover"
              />
            ) : (
              <AvatarFallback>
                {user?.full_name ? getInitials(user.full_name) : "PH"}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium">{user?.full_name}</p>
            <p className="truncate text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive(item.path)}
                    tooltip={item.label}
                    onClick={() => handleNav(item.path)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isTeacher && assignments.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Class Room</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {assignments.map((a) => (
                    <SidebarMenuItem key={a.class_subject_id}>
                      <SidebarMenuButton
                        isActive={activeClassSubjectId === a.class_subject_id}
                        tooltip={classLabel(a)}
                        onClick={() =>
                          handleNav(`/class/${a.class_subject_id}/knowledge`)
                        }
                      >
                        <SchoolIcon />
                        <span className="truncate">{classLabel(a)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {bottomNavItems.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton
                isActive={isActive(item.path)}
                tooltip={item.label}
                onClick={() => handleNav(item.path)}
              >
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Logout" onClick={handleLogout}>
              <LogOutIcon />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
