import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import { apiClient } from "@/lib/api-client"
import type { RootState } from "@/store"

export interface Subject {
  id: string
  subject_name: string
  school_id?: string
}

interface SubjectsState {
  subjects: Subject[]
  isLoading: boolean
}

interface SubjectsResponse {
  subjects: Subject[]
}

const initialState: SubjectsState = {
  subjects: [],
  isLoading: false,
}

export const fetchSubjects = createAsyncThunk<
  Subject[],
  void,
  { state: RootState; rejectValue: string }
>("subjects/fetch", async (_, { getState, rejectWithValue }) => {
  const { subjects } = getState().subjects
  if (subjects.length > 0) return subjects

  try {
    const res = await apiClient.get<SubjectsResponse>("/api/subjects")
    return res.subjects ?? []
  } catch (err) {
    return rejectWithValue(
      err instanceof Error ? err.message : "Failed to fetch subjects",
    )
  }
})

const subjectsSlice = createSlice({
  name: "subjects",
  initialState,
  reducers: {
    clearSubjects(state) {
      state.subjects = []
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSubjects.pending, (state) => {
        if (state.subjects.length === 0) {
          state.isLoading = true
        }
      })
      .addCase(fetchSubjects.fulfilled, (state, action) => {
        state.isLoading = false
        state.subjects = action.payload
      })
      .addCase(fetchSubjects.rejected, (state) => {
        state.isLoading = false
      })
  },
})

export const { clearSubjects } = subjectsSlice.actions
export default subjectsSlice.reducer
