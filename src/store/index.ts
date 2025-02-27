import { configureStore } from '@reduxjs/toolkit'
import videoReducer from './slices/videoSlice'
import focusPointsReducer from './slices/focusPointsSlice'
import projectsReducer from './slices/projectsSlice'

export const store = configureStore({
  reducer: {
    video: videoReducer,
    focusPoints: focusPointsReducer,
    projects: projectsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
