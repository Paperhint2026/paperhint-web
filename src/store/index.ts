import { configureStore } from "@reduxjs/toolkit"
import { useDispatch, useSelector } from "react-redux"

import authReducer from "@/store/auth-slice"
import schoolReducer from "@/store/school-slice"
import subjectsReducer from "@/store/subjects-slice"
import studentNotesReducer from "@/store/studentNotes-slice"

export const store = configureStore({
  reducer: {
    auth: authReducer,
    school: schoolReducer,
    subjects: subjectsReducer,
    studentNotes: studentNotesReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
