import { useCallback, useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"

export interface Assignment {
  class_subject_id: string
  class: { id: string; grade: number; section: string } | null
  subject: { id: string; subject_name: string } | null
}

interface TeacherOverview {
  assignments: Assignment[]
}

export function classLabel(a: Assignment) {
  if (!a.class || !a.subject) return a.class_subject_id
  return `${a.class.grade}${a.class.section} - ${a.subject.subject_name}`
}

export function classSlug(a: Assignment) {
  if (!a.class || !a.subject) return a.class_subject_id
  return `${a.class.grade}${a.class.section}-${a.subject.subject_name}`.replace(/\s+/g, "-")
}

let cachedAssignments: Assignment[] | null = null
let cacheUserId: string | null = null

export function useTeacherAssignments() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState<Assignment[]>(
    cacheUserId === user?.id ? (cachedAssignments ?? []) : [],
  )
  const [isLoading, setIsLoading] = useState(!cachedAssignments || cacheUserId !== user?.id)

  const fetchAssignments = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const res = await apiClient.get<{ teacher: TeacherOverview }>(
        `/api/auth/teacher/${user.id}/overview`,
      )
      const list = res.teacher.assignments ?? []
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
    if (user && (cacheUserId !== user.id || !cachedAssignments)) {
      fetchAssignments()
    }
  }, [user, fetchAssignments])

  return { assignments, isLoading, refetch: fetchAssignments }
}
