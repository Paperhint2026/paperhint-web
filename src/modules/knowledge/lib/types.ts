export interface Material {
  id: string
  class_subject_id: string
  teacher_id: string
  title: string
  file_url: string
  tags?: string[] | null
  processed?: boolean
  uploaded_at: string
  linked_class_subject_ids: string[]
  visibility?: "public" | "private"
}

export interface ClassSubjectLabel {
  class_subject_id: string
  grade: number | null
  section: string | null
  subject_id: string | null
  subject_name: string | null
}

export interface TeacherLite {
  id: string
  full_name: string
  email: string
  profile_url?: string | null
}

export function formatClassSubjectLabel(
  cs: ClassSubjectLabel | undefined | null,
  fallback = "Unknown class",
): string {
  if (!cs) return fallback
  const classPart = cs.grade != null && cs.section ? `${cs.grade}${cs.section}` : ""
  const subjectPart = cs.subject_name || ""
  if (classPart && subjectPart) return `${classPart} — ${subjectPart}`
  return classPart || subjectPart || fallback
}
