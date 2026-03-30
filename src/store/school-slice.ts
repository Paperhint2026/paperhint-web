import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import { apiClient } from "@/lib/api-client"

export interface School {
  id: string
  name: string
  board_id: string
  boardName: string
}

interface SchoolState {
  school: School | null
  isLoading: boolean
}

interface SchoolApiResponse {
  school: {
    id: string
    name: string
    board_id: string
    boards: { id: string; name: string }
    created_at: string
  }
}

const initialState: SchoolState = {
  school: JSON.parse(localStorage.getItem("school") || "null"),
  isLoading: false,
}

export const fetchSchool = createAsyncThunk<
  School,
  void,
  { rejectValue: string }
>("school/fetch", async (_, { rejectWithValue }) => {
  try {
    const res = await apiClient.get<SchoolApiResponse>("/api/schools")
    const s = res.school
    return {
      id: s.id,
      name: s.name,
      board_id: s.board_id,
      boardName: s.boards?.name ?? "",
    }
  } catch (err) {
    return rejectWithValue(
      err instanceof Error ? err.message : "Failed to fetch school",
    )
  }
})

const schoolSlice = createSlice({
  name: "school",
  initialState,
  reducers: {
    clearSchool(state) {
      state.school = null
      localStorage.removeItem("school")
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSchool.pending, (state) => {
        state.isLoading = true
      })
      .addCase(fetchSchool.fulfilled, (state, action) => {
        state.isLoading = false
        state.school = action.payload
        localStorage.setItem("school", JSON.stringify(action.payload))
      })
      .addCase(fetchSchool.rejected, (state) => {
        state.isLoading = false
      })
  },
})

export const { clearSchool } = schoolSlice.actions
export default schoolSlice.reducer
