import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface VideoState {
  url: string | null
  duration: number
  currentTime: number
  isPlaying: boolean
  volume: number
  originalFileName: string | null 
  videoId: string | null 
}

const initialState: VideoState = {
  url: null,
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  volume: 1,
  originalFileName: null,
  videoId: null,
}

export const videoSlice = createSlice({
  name: 'video',
  initialState,
  reducers: {
    setVideoUrl: (state, action: PayloadAction<string>) => {
      state.url = action.payload
    },
    setVideoMetadata: (state, action: PayloadAction<{ url: string, fileName: string, videoId: string }>) => {
      state.url = action.payload.url
      state.originalFileName = action.payload.fileName
      state.videoId = action.payload.videoId
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
  setVideoMetadata,
  setDuration,
  setCurrentTime,
  setIsPlaying,
  setVolume,
  resetVideo,
} = videoSlice.actions

export default videoSlice.reducer
