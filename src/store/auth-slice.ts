import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import { apiClient } from "@/lib/api-client"

export interface User {
  id: string
  full_name: string
  email: string
  role?: string
  school_id?: string
  profile_url?: string | null
  designation?: string | null
  phone_number?: string | null
  date_of_joining?: number | string | null
  department_id?: string | null
}

interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
}

interface LoginRequest {
  email: string
  password: string
}

interface LoginResponse {
  message: string
  // The server still returns `session` for one release so the Bearer-header
  // fallback stays alive for any tab that missed the cookies deploy; the
  // web app no longer reads it — the browser handles cookies transparently.
  session?: { access_token?: string }
  user: User
}

const initialState: AuthState = {
  user: JSON.parse(localStorage.getItem("user") || "null"),
  isLoading: false,
  error: null,
}

export const login = createAsyncThunk<
  LoginResponse,
  LoginRequest,
  { rejectValue: string }
>("auth/login", async (credentials, { rejectWithValue }) => {
  try {
    return await apiClient.post<LoginResponse>("/api/auth/login", credentials)
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : "Login failed")
  }
})

/**
 * Log out the server session (revokes the refresh token, clears cookies)
 * THEN clear local UI state. Best-effort — a network failure still logs
 * the user out locally; the server's cookies were HttpOnly and expire
 * on their own, and any real forced-logout is done via the direct `logout`
 * action (which api-client dispatches on a definitive 401).
 */
export const logoutServer = createAsyncThunk("auth/logoutServer", async () => {
  try {
    await apiClient.post("/api/auth/logout")
  } catch {
    /* offline / expired session — clear locally either way */
  }
})

const clearLocalState = (state: AuthState) => {
  state.user = null
  state.error = null
  localStorage.removeItem("user")
  localStorage.removeItem("school")
  localStorage.removeItem("subjects")
  // Legacy: earlier builds stored the JWT here. Wipe on this build so no
  // stale token lingers where a future XSS could read it.
  localStorage.removeItem("access_token")
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      clearLocalState(state)
    },
    clearError(state) {
      state.error = null
    },
    updateUser(state, action: { payload: Partial<User> }) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
        localStorage.setItem("user", JSON.stringify(state.user))
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false
        state.user = action.payload.user
        localStorage.setItem("user", JSON.stringify(state.user))
        // Legacy from the pre-cookies build — clear it here on the first
        // successful login after the migration.
        localStorage.removeItem("access_token")
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload ?? "Login failed"
      })
      .addCase(logoutServer.fulfilled, clearLocalState)
      .addCase(logoutServer.rejected, clearLocalState)
  },
})

export const { logout, clearError, updateUser } = authSlice.actions
export default authSlice.reducer
