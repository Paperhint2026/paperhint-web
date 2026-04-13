import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom"
import {
  BookOpenIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
} from "lucide-react"

import { useAuth } from "@/lib/auth"
import { getPageTitleFromPath } from "@/lib/get-page-title"
import { cn } from "@/lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/layout/app-sidebar"

const moduleSegments = [
  { label: "Knowledge base", icon: BookOpenIcon, segment: "knowledge" },
  { label: "Question papers", icon: ClipboardListIcon, segment: "exams" },
  { label: "Grading", icon: ClipboardCheckIcon, segment: "grading" },
]

export function AppLayout() {
  const location = useLocation()
  const { classSubjectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const rawTitle = getPageTitleFromPath(location.pathname)
  const title =
    location.pathname === "/" && user?.full_name
      ? `Welcome, ${user.full_name.split(" ")[0]}`
      : rawTitle

  const activeSegment = (() => {
    const path = location.pathname
    if (path.includes("/knowledge")) return "knowledge"
    if (path.includes("/grading")) return "grading"
    if (path.includes("/exams")) return "exams"
    return ""
  })()

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header
            className={cn(
              "grid h-14 shrink-0 items-center border-b px-3 sm:px-4",
              classSubjectId
                ? "grid-cols-[minmax(0,1fr)_auto] gap-x-3"
                : "grid-cols-1",
            )}
          >
            <div className="flex min-h-0 min-w-0 items-center gap-2 self-stretch">
              <SidebarTrigger className="shrink-0" />
              <Separator
                orientation="vertical"
                className="mx-1 w-px shrink-0 self-stretch"
              />
              <Breadcrumb className="min-w-0">
                <BreadcrumbList className="flex-nowrap gap-2 sm:gap-2">
                  <BreadcrumbItem>
                    <BreadcrumbPage className="line-clamp-1 text-sm font-medium text-foreground">
                      {title}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            {classSubjectId ? (
              <div className="flex min-h-0 min-w-0 items-center justify-center justify-self-center">
                <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1">
                  {moduleSegments.map((mod) => (
                    <button
                      key={mod.segment}
                      type="button"
                      onClick={() =>
                        navigate(`/class/${classSubjectId}/${mod.segment}`)
                      }
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all sm:px-3",
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
              </div>
            ) : null}

          </header>

          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0 overflow-x-hidden overflow-y-auto">
              <Outlet />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
