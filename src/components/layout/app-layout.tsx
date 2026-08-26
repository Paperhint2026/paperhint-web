import { Fragment, useState } from "react"
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom"
import {
  BookOpenIcon,
  ListChecksIcon,
  NewspaperIcon,
  SparklesIcon,
  Users2Icon,
} from "lucide-react"

import { useAuth } from "@/lib/auth"
import { getPageTitleFromPath } from "@/lib/get-page-title"
import { useTeacherAssignments, classLabel } from "@/hooks/use-teacher-assignments"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { HeaderActionsProvider, useHeaderActions } from "@/components/layout/header-actions-context"

function AppLayoutInner() {
  const location = useLocation()
  const { classSubjectId, grade } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { assignments } = useTeacherAssignments()
  const { headerActions } = useHeaderActions()
  const [aiChatOpen, setAiChatOpen] = useState(false)
  // Lifted chat state — survives sheet close, resets on classSubjectId change.
  const classAiChat = useClassAiChat(classSubjectId ?? null)

  // Active sub-tab inside a class-subject. We derive it from pathname so a
  // teacher landing on /class/:csId/exams/:examId/questions still shows
  // "Exams" highlighted.
  const classSubTab: "knowledge" | "exams" | "grading" | "students" = (() => {
    if (!classSubjectId) return "knowledge"
    if (location.pathname.includes("/students")) return "students"
    if (location.pathname.includes("/grading")) return "grading"
    if (location.pathname.includes("/exams")) return "exams"
    return "knowledge"
  })()
  const handleClassSubTabChange = (value: string) => {
    if (!value || !classSubjectId) return
    if (value === classSubTab) return
    navigate(`/class/${classSubjectId}/${value}`)
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

              {/* Knowledge / Exams / Grading toggle — class-subject scope */}
              {classSubjectId && (
                <ToggleGroup
                  type="single"
                  size="sm"
                  variant="outline"
                  spacing={2}
                  value={classSubTab}
                  onValueChange={handleClassSubTabChange}
                  className="ml-2"
                >
                  <ToggleGroupItem value="knowledge" aria-label="Knowledge">
                    <BookOpenIcon className="size-3.5" />
                    <span className="hidden md:inline">Knowledge</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="exams" aria-label="Exams">
                    <NewspaperIcon className="size-3.5" />
                    <span className="hidden md:inline">Exams</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="grading" aria-label="Grading">
                    <ListChecksIcon className="size-3.5" />
                    <span className="hidden md:inline">Grading</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="students" aria-label="Students">
                    <Users2Icon className="size-3.5" />
                    <span className="hidden md:inline">Students</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
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
