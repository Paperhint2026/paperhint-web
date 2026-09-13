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
import { GradeOverviewPage } from "@/modules/classes/pages/grade-overview-page"
import { TeachersPage } from "@/modules/teachers/pages/teachers-page"
import { TeacherOverviewPage } from "@/modules/teachers/pages/teacher-overview-page"
import { StudentsPage } from "@/modules/students/pages/students-page"
import { BatchesPage } from "@/modules/batches/pages/batches-page"
import { CalendarPage } from "@/modules/calendar/pages/calendar-page"
import { TimetablePage } from "@/modules/timetable/pages/timetable-page"
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
import { SetupPage } from "@/modules/setup/pages/setup-page"
import { PlatformPage } from "@/modules/platform/pages/platform-page"
import { PlatformSchoolPage } from "@/modules/platform/pages/platform-school-page"
import { PlatformSchoolNewPage } from "@/modules/platform/pages/platform-school-new-page"
import { FeatureRoute } from "@/components/shared/feature-route"
import { ComingSoonPage } from "@/modules/coming-soon/pages/coming-soon-page"
import { AllotmentsPage } from "@/modules/allotments/pages/allotments-page"
import { RolloverPage } from "@/modules/rollover/pages/rollover-page"
import { DepartmentsPage } from "@/modules/departments/pages/departments-page"
import { DepartmentDetailPage } from "@/modules/departments/pages/department-detail-page"
import { SubjectsPage } from "@/modules/subjects/pages/subjects-page"

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
          { path: "classes", element: <ClassesPage /> },
          { path: "classes/:grade/overview", element: <GradeOverviewPage /> },
          { path: "teachers", element: <TeachersPage /> },
          { path: "teachers/:id/overview", element: <TeacherOverviewPage /> },
          { path: "students", element: <StudentsPage /> },
          { path: "batches", element: <BatchesPage /> },
          {
            path: "calendar",
            element: (
              <FeatureRoute feature="calendar">
                <CalendarPage />
              </FeatureRoute>
            ),
          },
          {
            path: "timetable",
            element: (
              <FeatureRoute feature="timetable">
                <TimetablePage />
              </FeatureRoute>
            ),
          },
          // PaperHint team only — the page itself redirects non-platform
          // roles home, and every /api/platform route re-checks the role.
          // School admin's configuration home (role-gated in the page)
          { path: "soon/:slug", element: <ComingSoonPage /> },
          { path: "allotments", element: <AllotmentsPage /> },
          { path: "rollover", element: <RolloverPage /> },
          { path: "departments", element: <DepartmentsPage /> },
          { path: "departments/:id", element: <DepartmentDetailPage /> },
          { path: "subjects", element: <SubjectsPage /> },
          { path: "setup", element: <SetupPage /> },
          { path: "setup/:section", element: <SetupPage /> },
          { path: "platform", element: <PlatformPage /> },
          { path: "platform/schools/new", element: <PlatformSchoolNewPage /> },
          {
            path: "platform/schools/:schoolId",
            element: <PlatformSchoolPage />,
          },
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
          {
            path: "class/:classSubjectId/grading",
            element: (
              <FeatureRoute feature="grading">
                <GradingPage />
              </FeatureRoute>
            ),
          },
          {
            path: "class/:classSubjectId/grading/:submissionId/review",
            element: (
              <FeatureRoute feature="grading">
                <GradingReviewPage />
              </FeatureRoute>
            ),
          },
          {
            path: "class/:classSubjectId/students",
            element: <ClassStudentsMarksPage />,
          },

          {
            path: "ask",
            element: (
              <FeatureRoute feature="copilot">
                <CopilotPage />
              </FeatureRoute>
            ),
          },
          // A thread is its own page: navigating between it and /ask remounts
          // the panel, so no scroll/anchor state can leak between the two.
          {
            path: "ask/c/:chatId",
            element: (
              <FeatureRoute feature="copilot">
                <CopilotPage />
              </FeatureRoute>
            ),
          },
          { path: "settings", element: <SettingsPage /> },
          { path: "help", element: <HelpPage /> },
        ],
      },
    ],
  },
])
