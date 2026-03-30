import { createBrowserRouter } from "react-router-dom"

import { AppLayout } from "@/components/layout/app-layout"
import { ProtectedRoute } from "@/components/layout/protected-route"
import { LoginPage } from "@/modules/auth/pages/login-page"
import { SetPasswordPage } from "@/modules/auth/pages/set-password-page"
import { HomePage } from "@/modules/home/pages/home-page"
import { ClassesPage } from "@/modules/classes/pages/classes-page"
import { TeachersPage } from "@/modules/teachers/pages/teachers-page"
import { TeacherOverviewPage } from "@/modules/teachers/pages/teacher-overview-page"
import { StudentsPage } from "@/modules/students/pages/students-page"
import { SettingsPage } from "@/modules/settings/pages/settings-page"
import { HelpPage } from "@/modules/help/pages/help-page"

export const router = createBrowserRouter([
  { path: "login", element: <LoginPage /> },
  { path: "set-password", element: <SetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "classes", element: <ClassesPage /> },
          { path: "teachers", element: <TeachersPage /> },
          { path: "teachers/:id/overview", element: <TeacherOverviewPage /> },
          { path: "students", element: <StudentsPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "help", element: <HelpPage /> },
        ],
      },
    ],
  },
])
