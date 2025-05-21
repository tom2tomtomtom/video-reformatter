import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ClipSegment } from '../../services/ClipDetectionService';

interface ClipState {
  detectedClips: ClipSegment[];
  selectedClips: ClipSegment[];
  currentClipId: string | null;
  isDetecting: boolean;
  error: string | null;
  playheadPosition: number;
  isPlaying: boolean;
  clipBatch: {
    id: string;
    clips: ClipSegment[];
    name: string;
    created: string;
  }[];
}

const initialState: ClipState = {
  detectedClips: [],
  selectedClips: [],
  currentClipId: null,
  isDetecting: false,
  error: null,
  playheadPosition: 0,
  isPlaying: false,
  clipBatch: []
};

const clipSlice = createSlice({
  name: 'clips',
  initialState,
  reducers: {
    setDetectedClips: (state, action: PayloadAction<ClipSegment[]>) => {
      state.detectedClips = action.payload;
    },
    addSelectedClip: (state, action: PayloadAction<ClipSegment>) => {
      state.selectedClips.push(action.payload);
    },
    removeSelectedClip: (state, action: PayloadAction<string>) => {
      state.selectedClips = state.selectedClips.filter(clip => clip.id !== action.payload);
    },
    setCurrentClip: (state, action: PayloadAction<string | null>) => {
      state.currentClipId = action.payload;
    },
    setIsDetecting: (state, action: PayloadAction<boolean>) => {
      state.isDetecting = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    updateClipTrim: (state, action: PayloadAction<{ 
      clipId: string, 
      startTime?: number, 
      endTime?: number 
    }>) => {
      const { clipId, startTime, endTime } = action.payload;
      
      // Update in detectedClips
      const clipIndex = state.detectedClips.findIndex(c => c.id === clipId);
      if (clipIndex >= 0) {
        if (startTime !== undefined) {
          state.detectedClips[clipIndex].startTime = startTime;
        }
        if (endTime !== undefined) {
          state.detectedClips[clipIndex].endTime = endTime;
        }
      }
      
      // Update in selectedClips if present
      const selectedIndex = state.selectedClips.findIndex(c => c.id === clipId);
      if (selectedIndex >= 0) {
        if (startTime !== undefined) {
          state.selectedClips[selectedIndex].startTime = startTime;
        }
        if (endTime !== undefined) {
          state.selectedClips[selectedIndex].endTime = endTime;
        }
      }
    },
    setPlayheadPosition: (state, action: PayloadAction<number>) => {
      state.playheadPosition = action.payload;
    },
    setIsPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload;
    },
    createClipBatch: (state, action: PayloadAction<{
      id?: string;
      name: string;
      clips: ClipSegment[];
    }>) => {
      const newBatch = {
        id: action.payload.id || `batch-${Date.now()}`,
        clips: action.payload.clips,
        name: action.payload.name,
        created: new Date().toISOString()
      };
      state.clipBatch.push(newBatch);
    },
    removeClipBatch: (state, action: PayloadAction<string>) => {
      state.clipBatch = state.clipBatch.filter(batch => batch.id !== action.payload);
    },
    clearSelectedClips: (state) => {
      state.selectedClips = [];
    },
    resetClipState: (state) => {
      return initialState;
    }
  }
});

export const { 
  setDetectedClips,
  addSelectedClip,
  removeSelectedClip,
  setCurrentClip,
  setIsDetecting,
  setError,
  updateClipTrim,
  setPlayheadPosition,
  setIsPlaying,
  createClipBatch,
  removeClipBatch,
  clearSelectedClips,
  resetClipState
} = clipSlice.actions;

export default clipSlice.reducer;
