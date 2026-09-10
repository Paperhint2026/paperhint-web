import { createContext, useContext } from "react"

/**
 * The role the shell renders for. Normally the signed-in user's role; an admin
 * can preview the teacher shell (menu + Home) to see what teachers see. It is
 * a preview aid — data stays scoped to the real account, permissions are
 * untouched, and the API never learns about it.
 */

export type ViewRole = "admin" | "teacher"

export type ViewRoleValue = {
  /** The role the shell should render for. */
  role: ViewRole
  /** The signed-in user's actual role. */
  actualRole: ViewRole
  /** True for admins, who may preview the teacher shell. */
  canPreview: boolean
  /** Set a preview role, or null to return to the actual role. */
  setPreview: (role: ViewRole | null) => void
}

export const VIEW_ROLE_KEY = "paperhint.view-role"
export const ViewRoleContext = createContext<ViewRoleValue | null>(null)

export function readStoredViewRole(): ViewRole | null {
  try {
    const v = sessionStorage.getItem(VIEW_ROLE_KEY)
    return v === "teacher" || v === "admin" ? v : null
  } catch {
    return null
  }
}

export function useViewRole(): ViewRoleValue {
  const ctx = useContext(ViewRoleContext)
  if (!ctx) {
    throw new Error("useViewRole must be used inside <ViewRoleProvider>")
  }
  return ctx
}
