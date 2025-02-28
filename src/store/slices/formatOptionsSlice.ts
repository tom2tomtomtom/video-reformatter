import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface FormatOptionsState {
  aspectRatio: '9:16' | '1:1' | '4:5';
  quality: 'low' | 'medium' | 'high';
  cropMode: 'auto' | 'manual';
}

const initialState: FormatOptionsState = {
  aspectRatio: '9:16',
  quality: 'medium',
  cropMode: 'auto'
};

const formatOptionsSlice = createSlice({
  name: 'formatOptions',
  initialState,
  reducers: {
    setAspectRatio: (state, action: PayloadAction<'9:16' | '1:1' | '4:5'>) => {
      state.aspectRatio = action.payload;
    },
    setQuality: (state, action: PayloadAction<'low' | 'medium' | 'high'>) => {
      state.quality = action.payload;
    },
    setCropMode: (state, action: PayloadAction<'auto' | 'manual'>) => {
      state.cropMode = action.payload;
    }
  }
});

export const { setAspectRatio, setQuality, setCropMode } = formatOptionsSlice.actions;

export default formatOptionsSlice.reducer;