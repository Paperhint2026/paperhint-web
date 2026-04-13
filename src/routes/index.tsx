import { createBrowserRouter } from "react-router-dom"

import { AppLayout } from "@/components/layout/app-layout"
import { ProtectedRoute } from "@/components/layout/protected-route"
import { LoginPage } from "@/modules/auth/pages/login-page"
import { ForgotPasswordPage } from "@/modules/auth/pages/forgot-password-page"
import { ResetPasswordPage } from "@/modules/auth/pages/reset-password-page"
import { SetPasswordPage } from "@/modules/auth/pages/set-password-page"
import { HomePage } from "@/modules/home/pages/home-page"
import { ClassesPage } from "@/modules/classes/pages/classes-page"
import { ClassOverviewPage } from "@/modules/classes/pages/class-overview-page"
import { TeachersPage } from "@/modules/teachers/pages/teachers-page"
import { TeacherOverviewPage } from "@/modules/teachers/pages/teacher-overview-page"
import { StudentsPage } from "@/modules/students/pages/students-page"
import { KnowledgePage } from "@/modules/knowledge/pages/knowledge-page"
import { ExamsPage } from "@/modules/exams/pages/exams-page"
import { GenerateQuestionsPage } from "@/modules/exams/pages/generate-questions-page"
import { QuestionsPage } from "@/modules/exams/pages/questions-page"
import { PdfBuilderPage } from "@/modules/exams/pages/pdf-builder-page"
import { UploadPaperPage } from "@/modules/exams/pages/upload-paper-page"
import { GradingPage } from "@/modules/grading/pages/grading-page"
import { GradingReviewPage } from "@/modules/grading/pages/grading-review-page"
import { SettingsPage } from "@/modules/settings/pages/settings-page"
import { HelpPage } from "@/modules/help/pages/help-page"
import { CopilotPage } from "@/modules/copilot/pages/copilot-page"

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
          { path: "classes/:grade/overview", element: <ClassOverviewPage /> },
          { path: "teachers", element: <TeachersPage /> },
          { path: "teachers/:id/overview", element: <TeacherOverviewPage /> },
          { path: "students", element: <StudentsPage /> },

          // Class-scoped modules
          { path: "class/:classSubjectId/knowledge", element: <KnowledgePage /> },
          { path: "class/:classSubjectId/exams", element: <ExamsPage /> },
          { path: "class/:classSubjectId/exams/:examId/generate", element: <GenerateQuestionsPage /> },
          { path: "class/:classSubjectId/exams/:examId/upload", element: <UploadPaperPage /> },
          { path: "class/:classSubjectId/exams/:examId/questions", element: <QuestionsPage /> },
          { path: "class/:classSubjectId/exams/:examId/pdf-builder", element: <PdfBuilderPage /> },
          { path: "class/:classSubjectId/grading", element: <GradingPage /> },
          { path: "class/:classSubjectId/grading/:submissionId/review", element: <GradingReviewPage /> },

          { path: "ask", element: <CopilotPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "help", element: <HelpPage /> },
        ],
      },
    ],
  },
])
