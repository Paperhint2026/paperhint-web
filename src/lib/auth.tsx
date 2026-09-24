import { useCallback } from "react"
import { useAppDispatch, useAppSelector } from "@/store"
import {
  login as loginThunk,
  logoutServer,
  type User,
} from "@/store/auth-slice"
import { fetchSchool, clearSchool } from "@/store/school-slice"
import { resetFeaturesCache } from "@/hooks/use-features"

export type { User }

export function useAuth() {
  const dispatch = useAppDispatch()
  const { user, isLoading, error } = useAppSelector((state) => state.auth)

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      const result = await dispatch(loginThunk(credentials))
      if (loginThunk.rejected.match(result)) {
        throw new Error(result.payload ?? "Login failed")
      }
      dispatch(fetchSchool())
    },
    [dispatch]
  )

  // Fire the server-side logout (revokes the refresh token and clears
  // cookies) — the thunk's fulfilled/rejected handlers both clear local
  // state so a network failure never leaves the UI half-logged-in.
  const logout = useCallback(() => {
    dispatch(logoutServer())
    dispatch(clearSchool())
    resetFeaturesCache() // next login refetches this school's license map
  }, [dispatch])

  return {
    user,
    // Session presence used to be `!!token` (from localStorage); with
    // cookies the JS can't see the token, so we treat the loaded user blob
    // as the "am I logged in?" signal. A dead session is caught by
    // api-client's silent-refresh-then-logout path on the next request.
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
  }
}
