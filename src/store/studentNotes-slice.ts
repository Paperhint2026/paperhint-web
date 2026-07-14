import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '@/lib/api';
import { RootState } from '@/store';

// Types
export interface NoteAuthor {
  full_name: string;
  avatar_url: string | null;
}

export interface StudentNote {
  id: string;
  created_at: string;
  student_id: string;
  author_id: string;
  content: string;
  author: NoteAuthor;
}

interface StudentNotesState {
  notes: StudentNote[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: StudentNotesState = {
  notes: [],
  status: 'idle',
  error: null,
};

// Async Thunks
export const fetchStudentNotes = createAsyncThunk<
  StudentNote[],
  string,
  { rejectValue: string }
>('studentNotes/fetchStudentNotes', async (studentId, { rejectWithValue }) => {
  try {
    const response = await api.get<StudentNote[]>(`/api/students/${studentId}/notes`);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch notes');
  }
});

interface AddStudentNotePayload {
  studentId: string;
  content: string;
}

export const addStudentNote = createAsyncThunk<
  StudentNote,
  AddStudentNotePayload,
  { rejectValue: string }
>('studentNotes/addStudentNote', async ({ studentId, content }, { rejectWithValue }) => {
  try {
    const response = await api.post<StudentNote>(`/api/students/${studentId}/notes`, {
      content,
    });
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to add note');
  }
});

// Slice
const studentNotesSlice = createSlice({
  name: 'studentNotes',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudentNotes.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(
        fetchStudentNotes.fulfilled,
        (state, action: PayloadAction<StudentNote[]>) => {
          state.status = 'succeeded';
          state.notes = action.payload;
          state.error = null;
        },
      )
      .addCase(fetchStudentNotes.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'Unknown error';
      })
      .addCase(addStudentNote.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(
        addStudentNote.fulfilled,
        (state, action: PayloadAction<StudentNote>) => {
          state.status = 'succeeded';
          state.notes.unshift(action.payload);
          state.error = null;
        },
      )
      .addCase(addStudentNote.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const selectStudentNotes = (state: RootState) => state.studentNotes.notes;
export const selectStudentNotesStatus = (state: RootState) => state.studentNotes.status;
export const selectStudentNotesError = (state: RootState) => state.studentNotes.error;

export const studentNotesReducer = studentNotesSlice.reducer;
export default studentNotesSlice.reducer;
