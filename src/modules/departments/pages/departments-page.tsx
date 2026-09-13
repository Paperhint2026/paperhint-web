import { BookOpenIcon } from "@phosphor-icons/react"

import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Sticker } from "@/components/shared/sticker"
import { DepartmentsPanel } from "@/modules/departments/components/departments-panel"

/**
 * Departments & subjects (module 02) — its own page under Setup in the nav, not
 * a tab inside School setup: it is a module of its own, and one sidebar row
 * should never land on another row's page.
 */
export function DepartmentsPage() {
  const { user } = useAuth()

  if (user?.role !== "admin") {
    return (
      <div
        className={cn(
          PAGE_GUTTER,
          PAGE_TOP,
          "flex min-h-full flex-col items-center justify-center gap-4 pb-12"
        )}
      >
        <Sticker name="peek" size={96} />
        <p className="text-base font-medium text-secondary-foreground">
          Departments are set up by admins
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex h-full min-h-0 flex-col gap-5 overflow-hidden pb-6"
      )}
    >
      <PageHeader
        icon={BookOpenIcon}
        title="Departments & subjects"
        description="A department groups people and owns subjects; a grade decides which subjects run."
      />
      <DepartmentsPanel />
    </div>
  )
}
