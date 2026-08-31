import { Fragment, useState } from "react"
import { Link, Outlet, useLocation, useParams } from "react-router-dom"
import { SparklesIcon } from "lucide-react"

import { useAuth } from "@/lib/auth"
import { getPageTitleFromPath } from "@/lib/get-page-title"
import {
  useTeacherAssignments,
  classLabel,
} from "@/hooks/use-teacher-assignments"
import { useClassAiChat } from "@/hooks/use-class-ai-chat"
import { Button } from "@/components/ui/button"
import { ClassAiChatSheet } from "@/components/class-ai-chat/class-ai-chat-sheet"
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
import { AppSidebar } from "@/components/layout/app-sidebar"
import {
  HeaderActionsProvider,
  useHeaderActions,
} from "@/components/layout/header-actions-context"

function AppLayoutInner() {
  const location = useLocation()
  const { classSubjectId, grade } = useParams()
  const { user } = useAuth()
  const { assignments } = useTeacherAssignments()
  const { headerActions } = useHeaderActions()
  const [aiChatOpen, setAiChatOpen] = useState(false)
  // Lifted chat state — survives sheet close, resets on classSubjectId change.
  const classAiChat = useClassAiChat(classSubjectId ?? null)

  const rawTitle = getPageTitleFromPath(location.pathname)

  // Label of the section inside a class-subject, derived from the pathname.
  // null on the class home (/class/:csId) itself. Deeper pages (questions,
  // review, PDF builder…) fall through to their specific page title.
  const classSubLabel = (() => {
    if (!classSubjectId) return null
    const rest = location.pathname.split(`/class/${classSubjectId}`)[1] ?? ""
    const parts = rest.split("/").filter(Boolean)
    if (parts.length === 0) return null
    if (parts.length > 1) return rawTitle
    switch (parts[0]) {
      case "knowledge":
        return "Knowledge"
      case "exams":
        return "Exams"
      case "grading":
        return "Grading"
      case "students":
        return "Students"
      default:
        return rawTitle
    }
  })()

  const classTitle = (() => {
    if (!classSubjectId) return null
    const assignment = assignments.find(
      (a) => a.class_subject_id === classSubjectId
    )
    return assignment ? classLabel(assignment) : null
  })()

  // Build breadcrumb segments: { label, href? }
  // href present = clickable link; absent = current page (non-clickable)
  const segments: { label: string; href?: string }[] = (() => {
    if (location.pathname === "/" && user?.full_name) {
      return [{ label: `Welcome, ${user.full_name.split(" ")[0]}` }]
    }
    if (classTitle) {
      // /class/:csId → Classes › Class Name
      // /class/:csId/<section> → Classes › Class Name › Section
      if (classSubLabel) {
        return [
          { label: "Classes", href: "/classes" },
          { label: classTitle, href: `/class/${classSubjectId}` },
          { label: classSubLabel },
        ]
      }
      return [{ label: "Classes", href: "/classes" }, { label: classTitle }]
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
                      <Fragment key={seg.label}>
                        <BreadcrumbItem>
                          {!isLast && seg.href ? (
                            <BreadcrumbLink asChild>
                              <Link
                                to={seg.href}
                                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                              >
                                {seg.label}
                              </Link>
                            </BreadcrumbLink>
                          ) : (
                            <BreadcrumbPage className="line-clamp-1 text-sm font-medium text-foreground">
                              {seg.label}
                            </BreadcrumbPage>
                          )}
                        </BreadcrumbItem>
                        {!isLast && <BreadcrumbSeparator />}
                      </Fragment>
                    )
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="ml-auto flex items-center gap-2 pl-2">
              {classSubjectId && user?.role === "teacher" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAiChatOpen(true)}
                  className="gap-1.5"
                  title="Ask AI about this class"
                >
                  <SparklesIcon className="size-3.5 text-primary" />
                  <span className="hidden sm:inline">Ask AI</span>
                </Button>
              )}
              {/* Page-level CTA slot — populated by each page via useHeaderActions() */}
              {headerActions}
            </div>
          </header>

          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0 overflow-x-hidden overflow-y-auto">
              <Outlet />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <ClassAiChatSheet
        open={aiChatOpen}
        onOpenChange={setAiChatOpen}
        classLabel={classTitle ?? undefined}
        chat={classAiChat}
      />
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
