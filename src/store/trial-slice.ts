import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import { apiClient } from "@/lib/api-client"

/**
 * Trial-status slice — kept in sync with GET /api/billing/status. The server
 * decides everything (kind, expiry, per-resource quotas); this is a
 * read-through cache the SPA banners key off. AppLayout dispatches
 * `fetchTrialStatus` on mount, and api-client re-fetches after a 402 so
 * the banner reflects the block that just happened.
 */

export type TrialResource = "grading" | "papers" | "copilot" | "knowledge"
export type TrialQuota = { used: number; cap: number; exceeded: boolean }
export type TrialStatusKey =
  | "active"
  | "ending_soon"
  | "expired"
  | "quota_hit"

export interface TrialStatus {
  is_trialing: boolean
  status: TrialStatusKey
  kind?: "solo" | "coaching" | "school"
  plan?: string | null
  trial_ends_at?: string | null
  expired?: boolean
  days_left?: number | null
  quotas?: Record<TrialResource, TrialQuota>
}

interface TrialState {
  status: TrialStatus | null
  isLoading: boolean
}

const initialState: TrialState = {
  status: null,
  isLoading: false,
}

export const fetchTrialStatus = createAsyncThunk<
  TrialStatus,
  void,
  { rejectValue: string }
>("trial/fetch", async (_, { rejectWithValue }) => {
  try {
    return await apiClient.get<TrialStatus>("/api/billing/status")
  } catch (err) {
    return rejectWithValue(
      err instanceof Error ? err.message : "Failed to fetch trial status"
    )
  }
})

const trialSlice = createSlice({
  name: "trial",
  initialState,
  reducers: {
    clearTrial(state) {
      state.status = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTrialStatus.pending, (state) => {
        state.isLoading = true
      })
      .addCase(fetchTrialStatus.fulfilled, (state, action) => {
        state.isLoading = false
        state.status = action.payload
      })
      .addCase(fetchTrialStatus.rejected, (state) => {
        state.isLoading = false
      })
  },
})

export const { clearTrial } = trialSlice.actions
export default trialSlice.reducer
