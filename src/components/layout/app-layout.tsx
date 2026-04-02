import { Outlet } from "react-router-dom"

import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/layout/app-sidebar"

export function AppLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex h-svh flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </SidebarProvider>
    </TooltipProvider>
  )
}
