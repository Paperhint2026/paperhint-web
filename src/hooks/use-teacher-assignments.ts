import { useCallback, useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"

export interface Assignment {
  class_subject_id: string
  class: { id: string; grade: number; section: string; name?: string | null } | null
  subject: { id: string; subject_name: string } | null
}

interface TeacherOverview {
  assignments: Assignment[]
}

/** Short label for a class row. Coaching workspaces store a batch label on
 *  classes.name — prefer it when present so "6B01" never leaks to the UI. */
export function classCode(c: { grade: number; section: string; name?: string | null } | null | undefined): string {
  if (!c) return ""
  return (c.name && c.name.trim()) || `${c.grade}${c.section}`
}

/** What fits in the small square badge: "6A" for school/solo; for a named
 *  batch, a two-letter monogram from the name ("Weekend JEE 10th" → "WJ"). */
export function classBadge(c: { grade: number; section: string; name?: string | null } | null | undefined): string {
  if (!c) return ""
  const name = c.name?.trim()
  if (!name) return `${c.grade}${c.section}`
  const words = name.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w))
  const initials = words.slice(0, 2).map((w) => w[0].toUpperCase()).join("")
  return initials || name.slice(0, 2).toUpperCase()
}

export function classLabel(a: Assignment) {
  if (!a.class || !a.subject) return a.class_subject_id
  return `${classCode(a.class)} - ${a.subject.subject_name}`
}

export function classSlug(a: Assignment) {
  if (!a.class || !a.subject) return a.class_subject_id
  return `${classCode(a.class)}-${a.subject.subject_name}`.replace(
    /\s+/g,
    "-"
  )
}

let cachedAssignments: Assignment[] | null = null
let cacheUserId: string | null = null

export function useTeacherAssignments() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState<Assignment[]>(
    cacheUserId === user?.id ? (cachedAssignments ?? []) : []
  )
  const [isLoading, setIsLoading] = useState(
    !cachedAssignments || cacheUserId !== user?.id
  )

  const fetchAssignments = useCallback(async () => {
    // The overview endpoint is teacher-scoped (.single() on role='teacher'),
    // so calling it as an admin 500s with a coercion error. Admins have no
    // class assignments anyway.
    if (!user || user.role !== "teacher") {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const res = await apiClient.get<{ teacher: TeacherOverview }>(
        `/api/auth/teacher/${user.id}/overview`
      )
      // Stable order everywhere (sidebar, home, pickers): grade 5 before 6,
      // section A before B, then subject name. The API returns rows in
      // whatever order the DB felt like, which visibly reshuffled the nav.
      const list = [...(res.teacher.assignments ?? [])].sort(
        (x, y) =>
          (x.class?.grade ?? 0) - (y.class?.grade ?? 0) ||
          (x.class?.section ?? "").localeCompare(y.class?.section ?? "") ||
          (x.subject?.subject_name ?? "").localeCompare(
            y.subject?.subject_name ?? ""
          )
      )
      cachedAssignments = list
      cacheUserId = user.id
      setAssignments(list)
    } catch (err) {
      console.error("Failed to fetch assignments:", err)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (
      user &&
      user.role === "teacher" &&
      (cacheUserId !== user.id || !cachedAssignments)
    ) {
      fetchAssignments()
    }
  }, [user, fetchAssignments])

  return { assignments, isLoading, refetch: fetchAssignments }
}
