import { createBrowserRouter } from "react-router-dom"

import { AppLayout } from "@/components/layout/app-layout"
import { ProtectedRoute } from "@/components/layout/protected-route"
import { LoginPage } from "@/modules/auth/pages/login-page"
import { ForgotPasswordPage } from "@/modules/auth/pages/forgot-password-page"
import { ResetPasswordPage } from "@/modules/auth/pages/reset-password-page"
import { SetPasswordPage } from "@/modules/auth/pages/set-password-page"
import { HomePage } from "@/modules/home/pages/home-page"
import { ClassesPage } from "@/modules/classes/pages/classes-page"
import { TeachersPage } from "@/modules/teachers/pages/teachers-page"
import { TeacherOverviewPage } from "@/modules/teachers/pages/teacher-overview-page"
import { StudentsPage } from "@/modules/students/pages/students-page"
import { KnowledgePage } from "@/modules/knowledge/pages/knowledge-page"
import { ExamsPage } from "@/modules/exams/pages/exams-page"
import { GenerateQuestionsPage } from "@/modules/exams/pages/generate-questions-page"
import { QuestionsPage } from "@/modules/exams/pages/questions-page"
import { PdfBuilderPage } from "@/modules/exams/pages/pdf-builder-page"
import { UploadPaperPage } from "@/modules/exams/pages/upload-paper-page"
import { SettingsPage } from "@/modules/settings/pages/settings-page"
import { HelpPage } from "@/modules/help/pages/help-page"

export const router = createBrowserRouter([
  { path: "login", element: <LoginPage /> },
  { path: "forgot-password", element: <ForgotPasswordPage /> },
  { path: "reset-password", element: <ResetPasswordPage /> },
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
          { path: "knowledge", element: <KnowledgePage /> },
          { path: "exams", element: <ExamsPage /> },
          { path: "exams/:examId/generate", element: <GenerateQuestionsPage /> },
          { path: "exams/:examId/upload", element: <UploadPaperPage /> },
          { path: "exams/:examId/questions", element: <QuestionsPage /> },
          { path: "exams/:examId/pdf-builder", element: <PdfBuilderPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "help", element: <HelpPage /> },
        ],
      },
    ],
  },
])
