import { Outlet } from "react-router-dom"
import { MenuIcon } from "lucide-react"

import { SidebarProvider, useSidebar } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Button } from "@/components/ui/button"

function MobileHeader() {
  const { isMobile, toggleSidebar } = useSidebar()
  if (!isMobile) return null

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <Button variant="ghost" size="icon" className="size-8" onClick={toggleSidebar}>
        <MenuIcon className="size-5" />
      </Button>
      <span className="text-sm font-semibold">PaperHint</span>
    </header>
  )
}

export function AppLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex h-svh min-w-0 flex-1 flex-col overflow-hidden">
          <MobileHeader />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Outlet />
          </div>
        </main>
      </SidebarProvider>
    </TooltipProvider>
  )
}
