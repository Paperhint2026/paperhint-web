import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export type NavWorkspacePage = {
  name: string
  icon: React.ReactNode
  isActive?: boolean
  onClick: () => void
}

export function NavWorkspaces({
  workspaces,
}: {
  workspaces: {
    name: string
    pages: NavWorkspacePage[]
  }[]
}) {
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
              <SidebarMenuButton isActive={page.isActive} onClick={page.onClick}>
                {page.icon}
                <span>{page.name}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
