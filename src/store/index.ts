import { configureStore } from "@reduxjs/toolkit"
import { useDispatch, useSelector } from "react-redux"

import authReducer from "@/store/auth-slice"
import schoolReducer from "@/store/school-slice"
import subjectsReducer from "@/store/subjects-slice"
import labelsReducer from "@/store/labels-slice"

export const store = configureStore({
  reducer: {
    auth: authReducer,
    school: schoolReducer,
    subjects: subjectsReducer,
    labels: labelsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
