import { useState } from "react"
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom"
import {
  BookOpenIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  MenuIcon,
  SparklesIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Button } from "@/components/ui/button"
import { CopilotPanel } from "@/components/copilot/copilot-panel"

const moduleSegments = [
  { label: "Knowledge base", icon: BookOpenIcon, segment: "knowledge" },
  { label: "Question Papers", icon: ClipboardListIcon, segment: "exams" },
  { label: "Grading", icon: ClipboardCheckIcon, segment: "grading" },
]

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

function ClassModuleBar({ onOpenCopilot }: { onOpenCopilot: () => void }) {
  const { classSubjectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const activeSegment = (() => {
    const path = location.pathname
    if (path.includes("/knowledge")) return "knowledge"
    if (path.includes("/grading")) return "grading"
    if (path.includes("/exams")) return "exams"
    return ""
  })()

  return (
    <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
      {classSubjectId ? (
        <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
          {moduleSegments.map((mod) => (
            <button
              key={mod.segment}
              onClick={() => navigate(`/class/${classSubjectId}/${mod.segment}`)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                activeSegment === mod.segment
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <mod.icon className="size-3.5" />
              {mod.label}
            </button>
          ))}
        </div>
      ) : (
        <div />
      )}

      {/* Hint AI button — always visible, top-right */}
      <button
        onClick={onOpenCopilot}
        className="group relative isolate flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all hover:scale-[1.03] active:scale-[0.97]"
      >
        {/* Animated gradient border */}
        <span className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-violet-500 via-primary to-cyan-400 opacity-80 blur-[1px] transition-all group-hover:opacity-100 group-hover:blur-[2px]" />
        <span className="absolute inset-[1.5px] -z-10 rounded-[10px] bg-background" />
        <SparklesIcon className="size-4 text-primary" />
        <span className="hidden bg-gradient-to-r from-violet-500 via-primary to-cyan-400 bg-clip-text text-transparent sm:inline">
          Ask Hint AI
        </span>
      </button>
    </div>
  )
}

export function AppLayout() {
  const [copilotOpen, setCopilotOpen] = useState(false)

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex h-svh min-w-0 flex-1 flex-col overflow-hidden">
          <MobileHeader />
          <ClassModuleBar onOpenCopilot={() => setCopilotOpen(true)} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Outlet />
          </div>
        </main>

        <CopilotPanel open={copilotOpen} onClose={() => setCopilotOpen(false)} />
      </SidebarProvider>
    </TooltipProvider>
  )
}
