import { useEffect, useState } from "react"
import { Outlet, useParams } from "react-router-dom"
import { SparkleIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth"
import {
  useTeacherAssignments,
  classLabel,
} from "@/hooks/use-teacher-assignments"
import { useClassAiChat } from "@/hooks/use-class-ai-chat"
import { Button } from "@/components/ui/button"
import { ClassAiChatSheet } from "@/components/class-ai-chat/class-ai-chat-sheet"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { PAGE_GUTTER } from "@/components/layout/page-container"
import { HeaderActionsProvider } from "@/components/layout/header-actions-context"
import { PageTransition } from "@/components/layout/page-transition"
import {
  HelpDialogProvider,
  useHelpDialog,
} from "@/components/help/help-dialog-context"
import { HelpSupportDialog } from "@/components/help/help-support-dialog"

function AppLayoutInner() {
  const { classSubjectId } = useParams()
  const { user } = useAuth()
  const { assignments } = useTeacherAssignments()
  const { isMobile } = useSidebar()
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const help = useHelpDialog()

  // `?` opens help from anywhere, except while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (
        t instanceof HTMLElement &&
        (t.isContentEditable ||
          t.closest("input, textarea, select, [contenteditable='true']"))
      )
        return
      e.preventDefault()
      help.open()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [help])
  // Lifted chat state — survives sheet close, resets on classSubjectId change.
  const classAiChat = useClassAiChat(classSubjectId ?? null)

  const isClassScoped = Boolean(classSubjectId) && user?.role === "teacher"

  // Only still needed to title the class-scoped AI chat sheet.
  const classTitle = (() => {
    if (!classSubjectId) return null
    const assignment = assignments.find(
      (a) => a.class_subject_id === classSubjectId
    )
    return assignment ? classLabel(assignment) : null
  })()

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        {/* No chrome bar. These float inside the page's top padding so they
            cost no vertical space and stay aligned with the page gutter. */}
        {isMobile ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 pt-4">
            <div className={cn(PAGE_GUTTER, "flex items-center gap-2")}>
              {isMobile ? (
                <SidebarTrigger className="pointer-events-auto -ml-1 shrink-0" />
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>

        {/* Ask Hint for this class — a floating pill in the corner, so it is
            always one click away and never collides with a page's own header.
            A corner pill reads as an app-wide control, so the class name rides
            along on it to say this chat is scoped to the class being viewed. */}
        {isClassScoped ? (
          <div className="pointer-events-none absolute right-6 bottom-6 z-30">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="lg"
                  onClick={() => setAiChatOpen(true)}
                  className="pointer-events-auto max-w-[min(20rem,calc(100vw-3rem))] gap-2 rounded-full pr-5 pl-4 shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
                >
                  <SparkleIcon weight="fill" className="size-4 shrink-0" />
                  <span className="shrink-0">
                    Ask <span className="font-serif italic">hint</span>
                  </span>
                  {classTitle ? (
                    <>
                      <span
                        aria-hidden
                        className="h-3.5 w-px shrink-0 bg-primary-foreground/30"
                      />
                      <span className="truncate text-primary-foreground/80">
                        {classTitle}
                      </span>
                    </>
                  ) : null}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                Ask Hint about {classTitle ?? "this class"}
              </TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </SidebarInset>

      <ClassAiChatSheet
        open={aiChatOpen}
        onOpenChange={setAiChatOpen}
        classLabel={classTitle ?? undefined}
        chat={classAiChat}
      />

      <HelpSupportDialog />
    </>
  )
}

export function AppLayout() {
  return (
    <HeaderActionsProvider>
      <TooltipProvider>
        {/* Provider sits above AppLayoutInner so the header can read the
            sidebar's collapsed state via useSidebar(). */}
        <SidebarProvider>
          <HelpDialogProvider>
            <AppLayoutInner />
          </HelpDialogProvider>
        </SidebarProvider>
      </TooltipProvider>
    </HeaderActionsProvider>
  )
}
