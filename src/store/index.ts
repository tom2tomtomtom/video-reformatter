import { configureStore } from '@reduxjs/toolkit';
import videoReducer from './slices/videoSlice';
import focusPointsReducer from './slices/focusPointsSlice';
import formatOptionsReducer from './slices/formatOptionsSlice'; 
import videoScanReducer from './slices/videoScanSlice';

export const store = configureStore({
  reducer: {
    video: videoReducer,
    focusPoints: focusPointsReducer,
    formatOptions: formatOptionsReducer,
    videoScan: videoScanReducer
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
