import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import { apiClient } from "@/lib/api-client"

export interface User {
  id: string
  full_name: string
  email: string
  role?: string
  school_id?: string
  avatar?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
}

interface LoginRequest {
  email: string
  password: string
}

interface LoginResponse {
  message: string
  session: {
    access_token: string
  }
  user: User
}

const initialState: AuthState = {
  user: JSON.parse(localStorage.getItem("user") || "null"),
  token: localStorage.getItem("access_token"),
  isLoading: false,
  error: null,
}

export const login = createAsyncThunk<
  LoginResponse,
  LoginRequest,
  { rejectValue: string }
>("auth/login", async (credentials, { rejectWithValue }) => {
  try {
    return await apiClient.post<LoginResponse>(
      "/api/auth/login",
      credentials,
    )
  } catch (err) {
    return rejectWithValue(
      err instanceof Error ? err.message : "Login failed",
    )
  }
})

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.user = null
      state.token = null
      state.error = null
      localStorage.removeItem("access_token")
      localStorage.removeItem("user")
      localStorage.removeItem("school")
      localStorage.removeItem("subjects")
    },
    clearError(state) {
      state.error = null
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
        state.token = action.payload.session.access_token
        state.user = action.payload.user
        localStorage.setItem("access_token", state.token)
        localStorage.setItem("user", JSON.stringify(state.user))
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload ?? "Login failed"
      })
  },
})

export const { logout, clearError } = authSlice.actions
export default authSlice.reducer
