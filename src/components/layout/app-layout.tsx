import { Outlet } from "react-router-dom"

import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/layout/app-sidebar"

export function AppLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </SidebarProvider>
    </TooltipProvider>
  )
}
