// src/hooks/use-student-labels.ts
import { useCallback } from "react"
import { useAuthToken } from "@/hooks/use-auth-token"
import { apiClient } from "@/lib/api-client"

export interface StudentLabel {
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  usage_count?: number
}

export interface StudentLabelAssignment {
  id: string
  student_id: string
  label_id: string
  created_at: string
}

export function useStudentLabels() {
  const token = useAuthToken()

  const getLabels = useCallback(async (opts?: { includeDeleted?: boolean }) => {
    const params = opts?.includeDeleted ? { include_deleted: "true" } : {}
    const res = await apiClient.get<{ labels: StudentLabel[] }>("/api/student_labels", { params, token })
    return res.labels
  }, [token])

  const createLabel = useCallback(
    async (label: { name: string; color: string }) => {
      const res = await apiClient.post<{ label: StudentLabel }>("/api/student_labels", label, { token })
      return res.label
    },
    [token]
  )

  const updateLabel = useCallback(
    async (id: string, updates: { name?: string; color?: string }) => {
      const res = await apiClient.patch<{ label: StudentLabel }>(`/api/student_labels/${id}`, updates, { token })
      return res.label
    },
    [token]
  )

  const deleteLabel = useCallback(
    async (id: string) => {
      await apiClient.delete<{ success: true }>(`/api/student_labels/${id}`, { token })
      return true
    },
    [token]
  )

  return {
    getLabels,
    createLabel,
    updateLabel,
    deleteLabel,
  }
}

export function useStudentLabelsForStudent(studentId: string) {
  const token = useAuthToken()

  const getLabels = useCallback(async () => {
    const res = await apiClient.get<{
      labels: Array<{ id: string; name: string; color: string; assigned_at: string }>
    }>(`/api/students/${studentId}/labels`, { token })
    return res.labels
  }, [studentId, token])

  const assignLabel = useCallback(
    async (labelId: string) => {
      const res = await apiClient.post<{ assignment: StudentLabelAssignment }>(
        `/api/students/${studentId}/labels`,
        { label_id: labelId },
        { token }
      )
      return res.assignment
    },
    [studentId, token]
  )

  const unassignLabel = useCallback(
    async (labelId: string) => {
      await apiClient.delete<{ success: true }>(
        `/api/students/${studentId}/labels/${labelId}`,
        { token }
      )
      return true
    },
    [studentId, token]
  )

  return {
    getLabels,
    assignLabel,
    unassignLabel,
  }
}

export function useStudentLabelsByStudentIds() {
  const token = useAuthToken()

  const getLabelsByStudentIds = useCallback(async (studentIds: string[]) => {
    if (!studentIds.length) return {}
    const res = await apiClient.post<{
      result: Record<string, Array<{ id: string; name: string; color: string }>>
    }>(
      "/api/student_labels/by_student_ids",
      { student_ids: studentIds },
      { token }
    )
    return res.result
  }, [token])

  return {
    getLabelsByStudentIds
  }
}
