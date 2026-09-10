import { useCallback, useMemo, useState, type ReactNode } from "react"

import { useAuth } from "@/lib/auth"
import {
  VIEW_ROLE_KEY,
  ViewRoleContext,
  readStoredViewRole,
  type ViewRole,
  type ViewRoleValue,
} from "@/lib/view-role"

export function ViewRoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const actualRole: ViewRole = user?.role === "teacher" ? "teacher" : "admin"
  const canPreview = actualRole === "admin"
  const [preview, setPreviewState] = useState<ViewRole | null>(
    readStoredViewRole
  )

  const setPreview = useCallback((role: ViewRole | null) => {
    setPreviewState(role)
    try {
      if (role) sessionStorage.setItem(VIEW_ROLE_KEY, role)
      else sessionStorage.removeItem(VIEW_ROLE_KEY)
    } catch {
      /* preview contexts may block storage; the in-memory state still works */
    }
  }, [])

  const value = useMemo<ViewRoleValue>(
    () => ({
      role: canPreview && preview ? preview : actualRole,
      actualRole,
      canPreview,
      setPreview,
    }),
    [actualRole, canPreview, preview, setPreview]
  )

  return (
    <ViewRoleContext.Provider value={value}>
      {children}
    </ViewRoleContext.Provider>
  )
}
