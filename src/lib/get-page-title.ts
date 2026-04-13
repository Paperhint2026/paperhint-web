/** Single title for the app shell header (breadcrumb current page). */
export function getPageTitleFromPath(pathname: string): string {
  const path = pathname || "/"
  if (path === "/" || path === "") return "Home"
  if (path.includes("/classes/") && path.includes("/overview"))
    return "Class overview"
  if (path.startsWith("/classes")) return "Classes"
  if (path.includes("/teachers/") && path.includes("/overview"))
    return "Teacher overview"
  if (path.startsWith("/teachers")) return "Teachers"
  if (path.startsWith("/students")) return "Students"
  if (path.startsWith("/settings")) return "Settings"
  if (path.startsWith("/help")) return "Help"
  if (path.startsWith("/ask")) return "Ask Hint AI"
  if (path.includes("/grading/") && path.includes("/review")) return "Review"
  if (path.includes("/grading")) return "Grading"
  if (path.includes("/pdf-builder")) return "PDF builder"
  if (path.includes("/questions")) return "Questions"
  if (path.includes("/upload")) return "Upload paper"
  if (path.includes("/generate")) return "Generate questions"
  if (path.includes("/knowledge")) return "Knowledge base"
  if (path.includes("/exams")) return "Question papers"
  return "PaperHint"
}
