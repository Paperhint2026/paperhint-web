import { useCallback } from "react"
import { useAppDispatch, useAppSelector } from "@/store"
import {
  login as loginThunk,
  logout as logoutAction,
  type User,
} from "@/store/auth-slice"
import { fetchSchool, clearSchool } from "@/store/school-slice"

export type { User }

export function useAuth() {
  const dispatch = useAppDispatch()
  const { user, token, isLoading, error } = useAppSelector(
    (state) => state.auth,
  )

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      const result = await dispatch(loginThunk(credentials))
      if (loginThunk.rejected.match(result)) {
        throw new Error(result.payload ?? "Login failed")
      }
      dispatch(fetchSchool())
    },
    [dispatch],
  )

  const logout = useCallback(() => {
    dispatch(logoutAction())
    dispatch(clearSchool())
  }, [dispatch])

  return {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    error,
    login,
    logout,
  }
}
