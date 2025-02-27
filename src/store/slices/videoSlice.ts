import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface VideoState {
  url: string | null
  duration: number
  currentTime: number
  isPlaying: boolean
  volume: number
}

const initialState: VideoState = {
  url: null,
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  volume: 1,
}

export const videoSlice = createSlice({
  name: 'video',
  initialState,
  reducers: {
    setVideoUrl: (state, action: PayloadAction<string>) => {
      state.url = action.payload
    },
    setDuration: (state, action: PayloadAction<number>) => {
      state.duration = action.payload
    },
    setCurrentTime: (state, action: PayloadAction<number>) => {
      state.currentTime = action.payload
    },
    setIsPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload
    },
    setVolume: (state, action: PayloadAction<number>) => {
      state.volume = action.payload
    },
    resetVideo: (state) => {
      return initialState
    },
  },
})

export const {
  setVideoUrl,
  setDuration,
  setCurrentTime,
  setIsPlaying,
  setVolume,
  resetVideo,
} = videoSlice.actions

export default videoSlice.reducer
