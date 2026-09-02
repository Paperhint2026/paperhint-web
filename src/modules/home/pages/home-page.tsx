import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { useTeacherAssignments } from "@/hooks/use-teacher-assignments"
import { AdminHome } from "@/modules/home/components/admin-home"
import { TeacherHome } from "@/modules/home/components/teacher-home"

/**
 * Home is persona-shaped. A teacher lands on their classes and whatever is
 * waiting to be graded; an admin lands on the state of the school and what
 * still needs setting up. Both share the greeting and the Ask Hint panel.
 */
export function HomePage() {
  const { user } = useAuth()
  const { assignments, isLoading } = useTeacherAssignments()
  const isTeacher = user?.role === "teacher"
  const firstName = user?.full_name?.split(" ")[0] ?? "there"

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex flex-col gap-6 pb-12"
      )}
    >
      {isTeacher ? (
        <TeacherHome
          firstName={firstName}
          assignments={assignments}
          assignmentsLoading={isLoading}
        />
      ) : (
        <AdminHome firstName={firstName} />
      )}
    </div>
  )
}
