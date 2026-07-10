// src/store/labels-slice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import { apiClient } from "@/lib/api-client"

export interface Label {
  id: string
  name: string
  color?: string | null
  student_count?: number
  created_at?: string
  updated_at?: string
}

interface CreateLabelPayload {
  name: string
  color?: string
}

interface UpdateLabelPayload {
  id: string
  name?: string
  color?: string
}

interface AssignLabelPayload {
  label_id: string
  student_ids: string[]
}

interface LabelsState {
  labels: Label[]
  isLoading: boolean
  error: string | null
}

const initialState: LabelsState = {
  labels: [],
  isLoading: false,
  error: null,
}

export const fetchLabels = createAsyncThunk<Label[]>(
  "labels/fetchLabels",
  async (_, { rejectWithValue }) => {
    try {
      return await apiClient.get<Label[]>("/api/teacher-labels")
    } catch (err) {
      return rejectWithValue("Failed to load labels")
    }
  }
)

export const createLabel = createAsyncThunk<
  Label,
  CreateLabelPayload,
  { rejectValue: string }
>(
  "labels/createLabel",
  async (payload, { rejectWithValue }) => {
    try {
      return await apiClient.post<Label>("/api/teacher-labels", payload)
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to create label")
    }
  }
)

export const updateLabel = createAsyncThunk<
  Label,
  UpdateLabelPayload,
  { rejectValue: string }
>(
  "labels/updateLabel",
  async (payload, { rejectWithValue }) => {
    try {
      const { id, ...rest } = payload
      return await apiClient.put<Label>(`/api/teacher-labels/${id}`, rest)
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to update label")
    }
  }
)

export const deleteLabel = createAsyncThunk<
  { message: string },
  { id: string },
  { rejectValue: string }
>(
  "labels/deleteLabel",
  async ({ id }, { rejectWithValue }) => {
    try {
      return await apiClient.delete<{ message: string }>(`/api/teacher-labels/${id}`)
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to delete label")
    }
  }
)

export const assignLabelToStudents = createAsyncThunk<
  { message: string; count: number },
  AssignLabelPayload,
  { rejectValue: string }
>(
  "labels/assignLabelToStudents",
  async (payload, { rejectWithValue }) => {
    try {
      return await apiClient.post<{ message: string; count: number }>(
        "/api/teacher-labels/students/assign",
        payload
      )
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to assign label")
    }
  }
)

export const unassignLabelFromStudents = createAsyncThunk<
  { message: string; count: number },
  AssignLabelPayload,
  { rejectValue: string }
>(
  "labels/unassignLabelFromStudents",
  async (payload, { rejectWithValue }) => {
    try {
      return await apiClient.post<{ message: string; count: number }>(
        "/api/teacher-labels/students/unassign",
        payload
      )
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to unassign label")
    }
  }
)

const labelsSlice = createSlice({
  name: "labels",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLabels.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchLabels.fulfilled, (state, action) => {
        state.isLoading = false
        state.labels = action.payload
      })
      .addCase(fetchLabels.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

      .addCase(createLabel.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createLabel.fulfilled, (state, action) => {
        state.isLoading = false
        state.labels.push(action.payload)
      })
      .addCase(createLabel.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

      .addCase(updateLabel.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateLabel.fulfilled, (state, action) => {
        state.isLoading = false
        state.labels = state.labels.map((l) =>
          l.id === action.payload.id ? { ...l, ...action.payload } : l
        )
      })
      .addCase(updateLabel.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

      .addCase(deleteLabel.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(deleteLabel.fulfilled, (state, action) => {
        state.isLoading = false
        // Remove the deleted label
        const id = (action.meta.arg as { id: string }).id
        state.labels = state.labels.filter((l) => l.id !== id)
      })
      .addCase(deleteLabel.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  },
})

export default labelsSlice.reducer
