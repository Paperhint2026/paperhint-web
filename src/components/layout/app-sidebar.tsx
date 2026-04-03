import { useLocation, useNavigate } from "react-router-dom"
import {
  BookOpenIcon,
  ClipboardListIcon,
  ContactRoundIcon,
  GraduationCapIcon,
  HelpCircleIcon,
  HomeIcon,
  LogOutIcon,
  SchoolIcon,
  SettingsIcon,
} from "lucide-react"

import { useAuth } from "@/lib/auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

const mainNavItems = [
  { label: "Home", icon: HomeIcon, path: "/", roles: undefined },
  { label: "Classes", icon: SchoolIcon, path: "/classes", roles: undefined },
  { label: "Teachers", icon: ContactRoundIcon, path: "/teachers", roles: undefined },
  { label: "Students", icon: GraduationCapIcon, path: "/students", roles: undefined },
  { label: "Knowledge Base", icon: BookOpenIcon, path: "/knowledge", roles: ["teacher"] as string[] },
  { label: "Exams", icon: ClipboardListIcon, path: "/exams", roles: ["teacher"] as string[] },
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
  const { user, logout } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/"
    return location.pathname.startsWith(path)
  }

  const handleNav = (path: string) => {
    if (isMobile) {
      setOpenMobile(false)
      setTimeout(() => navigate(path), 500)
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
      }, 500)
    } else {
      logout()
      navigate("/login")
    }
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center p-2">
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
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems
                .filter((item) => !item.roles || item.roles.includes(user?.role ?? ""))
                .map((item) => (
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
