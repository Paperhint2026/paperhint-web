import { Link, Outlet, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { LayoutDashboardIcon, NewspaperIcon } from "lucide-react"

import { useAuth } from "@/lib/auth"
import { getPageTitleFromPath } from "@/lib/get-page-title"
import { useTeacherAssignments, classLabel } from "@/hooks/use-teacher-assignments"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { HeaderActionsProvider, useHeaderActions } from "@/components/layout/header-actions-context"

function AppLayoutInner() {
  const location = useLocation()
  const { classSubjectId, grade } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { assignments } = useTeacherAssignments()
  const { headerActions } = useHeaderActions()

  const pageTab = (searchParams.get("tab") ?? "overview") as "overview" | "exams"
  const handleTabChange = (value: string) => {
    if (!value) return
    const params = new URLSearchParams(searchParams)
    params.set("tab", value)
    navigate({ search: params.toString() }, { replace: true })
  }
  const rawTitle = getPageTitleFromPath(location.pathname)

  const classTitle = (() => {
    if (!classSubjectId) return null
    const assignment = assignments.find((a) => a.class_subject_id === classSubjectId)
    return assignment ? classLabel(assignment) : null
  })()

  // Build breadcrumb segments: { label, href? }
  // href present = clickable link; absent = current page (non-clickable)
  const segments: { label: string; href?: string }[] = (() => {
    if (location.pathname === "/" && user?.full_name) {
      return [{ label: `Welcome, ${user.full_name.split(" ")[0]}` }]
    }
    if (classTitle) {
      // /class/:classSubjectId/* → Classes › Class Name
      return [
        { label: "Classes", href: "/classes" },
        { label: classTitle },
      ]
    }
    if (grade) {
      // /classes/:grade/overview → Classes › Grade X
      return [
        { label: "Classes", href: "/classes" },
        { label: `Grade ${grade}` },
      ]
    }
    return [{ label: rawTitle }]
  })()

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center justify-between border-b px-3 sm:px-4">
            <div className="flex min-h-0 min-w-0 items-center gap-2 self-stretch">
              <SidebarTrigger className="shrink-0" />
              <Separator
                orientation="vertical"
                className="mx-1 w-px shrink-0 self-stretch"
              />
              <Breadcrumb className="min-w-0">
                <BreadcrumbList className="flex-nowrap gap-1.5 sm:gap-1.5">
                  {segments.map((seg, i) => {
                    const isLast = i === segments.length - 1
                    return (
                      <BreadcrumbItem key={seg.label}>
                        {!isLast && seg.href ? (
                          <>
                            <BreadcrumbLink asChild>
                              <Link
                                to={seg.href}
                                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                              >
                                {seg.label}
                              </Link>
                            </BreadcrumbLink>
                            <BreadcrumbSeparator />
                          </>
                        ) : (
                          <BreadcrumbPage className="line-clamp-1 text-sm font-medium text-foreground">
                            {seg.label}
                          </BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    )
                  })}
                </BreadcrumbList>
              </Breadcrumb>

              {/* Overview / Exams toggle — placed right after the grade name */}
              {grade && (
                <ToggleGroup
                  type="single"
                  size="sm"
                  variant="outline"
                  spacing={2}
                  value={pageTab}
                  onValueChange={handleTabChange}
                  className="ml-2"
                >
                  <ToggleGroupItem value="overview" aria-label="Overview">
                    <LayoutDashboardIcon className="size-3.5" />
                    Overview
                  </ToggleGroupItem>
                  <ToggleGroupItem value="exams" aria-label="Exams">
                    <NewspaperIcon className="size-3.5" />
                    Exams
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            </div>

            {/* Page-level CTA slot — populated by each page via useHeaderActions() */}
            {headerActions && (
              <div className="ml-auto flex items-center pl-2">
                {headerActions}
              </div>
            )}
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

export function AppLayout() {
  return (
    <HeaderActionsProvider>
      <AppLayoutInner />
    </HeaderActionsProvider>
  )
}
