import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface FocusPoint {
  id: string
  timeStart: number
  timeEnd: number
  x: number
  y: number
  width: number
  height: number
  description: string
}

interface FocusPointsState {
  points: FocusPoint[]
  selectedPointId: string | null
}

const initialState: FocusPointsState = {
  points: [],
  selectedPointId: null,
}

export const focusPointsSlice = createSlice({
  name: 'focusPoints',
  initialState,
  reducers: {
    addFocusPoint: (state, action: PayloadAction<FocusPoint>) => {
      state.points.push(action.payload)
    },
    updateFocusPoint: (state, action: PayloadAction<FocusPoint>) => {
      const index = state.points.findIndex(point => point.id === action.payload.id)
      if (index !== -1) {
        state.points[index] = action.payload
      }
    },
    removeFocusPoint: (state, action: PayloadAction<string>) => {
      state.points = state.points.filter(point => point.id !== action.payload)
    },
    setSelectedPoint: (state, action: PayloadAction<string | null>) => {
      state.selectedPointId = action.payload
    },
    resetFocusPoints: (state) => {
      return initialState
    },
  },
})

export const {
  addFocusPoint,
  updateFocusPoint,
  removeFocusPoint,
  setSelectedPoint,
  resetFocusPoints,
} = focusPointsSlice.actions

export default focusPointsSlice.reducer

