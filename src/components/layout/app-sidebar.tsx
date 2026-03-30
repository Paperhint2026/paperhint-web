import { useLocation, useNavigate } from "react-router-dom"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
} from "@/components/ui/sidebar"

const mainNavItems = [
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
  const { user, logout } = useAuth()

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/"
    return location.pathname.startsWith(path)
  }

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center p-2">
          <Avatar>
            <AvatarImage src={user?.avatar} alt={user?.full_name} />
            <AvatarFallback>
              {user?.full_name ? getInitials(user.full_name) : "PH"}
            </AvatarFallback>
          </Avatar>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive(item.path)}
                    tooltip={item.label}
                    onClick={() => navigate(item.path)}
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
                onClick={() => navigate(item.path)}
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
