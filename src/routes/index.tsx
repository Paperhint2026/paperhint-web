import { createBrowserRouter } from "react-router-dom"

import { AppLayout } from "@/components/layout/app-layout"
import { ProtectedRoute } from "@/components/layout/protected-route"
import { LoginPage } from "@/modules/auth/pages/login-page"
import { ForgotPasswordPage } from "@/modules/auth/pages/forgot-password-page"
import { ResetPasswordPage } from "@/modules/auth/pages/reset-password-page"
import { SetPasswordPage } from "@/modules/auth/pages/set-password-page"
import { HomePage } from "@/modules/home/pages/home-page"
import { ClassesPage } from "@/modules/classes/pages/classes-page"
import { ClassHomePage } from "@/modules/classes/pages/class-home-page"
import { TeachersPage } from "@/modules/teachers/pages/teachers-page"
import { TeacherOverviewPage } from "@/modules/teachers/pages/teacher-overview-page"
import { StudentsPage } from "@/modules/students/pages/students-page"
import { BatchesPage } from "@/modules/batches/pages/batches-page"
import { ClassStudentsMarksPage } from "@/modules/students/pages/class-students-marks-page"
import { KnowledgePage } from "@/modules/knowledge/pages/knowledge-page"
import { LibraryPage } from "@/modules/knowledge/pages/library-page"
import { BankPage } from "@/modules/knowledge/pages/bank-page"
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
          // One route for the grid and the grade sheet, so opening or closing
          // the sheet only changes params — the page never remounts.
          { path: "classes/:grade?/overview?", element: <ClassesPage /> },
          { path: "teachers", element: <TeachersPage /> },
          { path: "teachers/:id/overview", element: <TeacherOverviewPage /> },
          { path: "students", element: <StudentsPage /> },
          { path: "batches", element: <BatchesPage /> },
          { path: "library", element: <LibraryPage /> },
          { path: "library/bank", element: <BankPage /> },

          // Class-scoped modules
          { path: "class/:classSubjectId", element: <ClassHomePage /> },
          {
            path: "class/:classSubjectId/knowledge",
            element: <KnowledgePage />,
          },
          { path: "class/:classSubjectId/exams", element: <ExamsPage /> },
          {
            path: "class/:classSubjectId/exams/:examId/generate",
            element: <GenerateQuestionsPage />,
          },
          {
            path: "class/:classSubjectId/exams/:examId/upload",
            element: <UploadPaperPage />,
          },
          {
            path: "class/:classSubjectId/exams/:examId/questions",
            element: <QuestionsPage />,
          },
          {
            path: "class/:classSubjectId/exams/:examId/pdf-builder",
            element: <PdfBuilderPage />,
          },
          { path: "class/:classSubjectId/grading", element: <GradingPage /> },
          {
            path: "class/:classSubjectId/grading/:submissionId/review",
            element: <GradingReviewPage />,
          },
          {
            path: "class/:classSubjectId/students",
            element: <ClassStudentsMarksPage />,
          },

          { path: "ask", element: <CopilotPage /> },
          // A thread is its own page: navigating between it and /ask remounts
          // the panel, so no scroll/anchor state can leak between the two.
          { path: "ask/c/:chatId", element: <CopilotPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "help", element: <HelpPage /> },
        ],
      },
    ],
  },
])
