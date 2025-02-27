import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Subject } from '../../services/VideoScannerService';

export interface VideoScanState {
  isScanning: boolean;
  progress: {
    currentFrame: number;
    totalFrames: number;
    elapsedTime: number; // in seconds
    estimatedTimeRemaining: number; // in seconds
    percentComplete: number; // 0-100
  };
  detectedSubjects: Subject[];
  scanOptions: {
    interval: number; // in seconds
    minScore: number; // 0-1
    similarityThreshold: number; // 0-1
    minDetections: number;
  };
  isReviewMode: boolean;
  acceptedSubjectsIds: string[];
  rejectedSubjectsIds: string[];
}

const initialState: VideoScanState = {
  isScanning: false,
  progress: {
    currentFrame: 0,
    totalFrames: 0,
    elapsedTime: 0,
    estimatedTimeRemaining: 0,
    percentComplete: 0
  },
  detectedSubjects: [],
  scanOptions: {
    interval: 1.0,
    minScore: 0.5,
    similarityThreshold: 0.6,
    minDetections: 2
  },
  isReviewMode: false,
  acceptedSubjectsIds: [],
  rejectedSubjectsIds: []
};

const videoScanSlice = createSlice({
  name: 'videoScan',
  initialState,
  reducers: {
    startScan: (state) => {
      state.isScanning = true;
      state.progress = {
        currentFrame: 0,
        totalFrames: 0,
        elapsedTime: 0,
        estimatedTimeRemaining: 0,
        percentComplete: 0
      };
      state.detectedSubjects = [];
      state.acceptedSubjectsIds = [];
      state.rejectedSubjectsIds = [];
      state.isReviewMode = false;
    },
    stopScan: (state) => {
      state.isScanning = false;
    },
    updateProgress: (state, action: PayloadAction<{
      currentFrame: number;
      totalFrames: number;
      elapsedTime: number;
      estimatedTimeRemaining: number;
      percentComplete: number;
    }>) => {
      state.progress = action.payload;
    },
    scanComplete: (state, action: PayloadAction<Subject[]>) => {
      state.isScanning = false;
      state.detectedSubjects = action.payload;
      state.isReviewMode = true;
    },
    updateScanOptions: (state, action: PayloadAction<{
      interval?: number;
      minScore?: number;
      similarityThreshold?: number;
      minDetections?: number;
    }>) => {
      state.scanOptions = {
        ...state.scanOptions,
        ...action.payload
      };
    },
    acceptSubject: (state, action: PayloadAction<string>) => {
      const subjectId = action.payload;
      state.acceptedSubjectsIds = [...state.acceptedSubjectsIds, subjectId];
      // Remove from rejected if it was there
      state.rejectedSubjectsIds = state.rejectedSubjectsIds.filter(id => id !== subjectId);
    },
    rejectSubject: (state, action: PayloadAction<string>) => {
      const subjectId = action.payload;
      state.rejectedSubjectsIds = [...state.rejectedSubjectsIds, subjectId];
      // Remove from accepted if it was there
      state.acceptedSubjectsIds = state.acceptedSubjectsIds.filter(id => id !== subjectId);
    },
    acceptAllSubjects: (state) => {
      state.acceptedSubjectsIds = state.detectedSubjects.map(subject => subject.id);
      state.rejectedSubjectsIds = [];
    },
    rejectAllSubjects: (state) => {
      state.rejectedSubjectsIds = state.detectedSubjects.map(subject => subject.id);
      state.acceptedSubjectsIds = [];
    },
    exitReviewMode: (state) => {
      state.isReviewMode = false;
      state.detectedSubjects = [];
      state.acceptedSubjectsIds = [];
      state.rejectedSubjectsIds = [];
    }
  }
});

export const {
  startScan,
  stopScan,
  updateProgress,
  scanComplete,
  updateScanOptions,
  acceptSubject,
  rejectSubject,
  acceptAllSubjects,
  rejectAllSubjects,
  exitReviewMode
} = videoScanSlice.actions;

export default videoScanSlice.reducer;