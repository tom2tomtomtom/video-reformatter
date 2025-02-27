import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { FocusPoint } from './focusPointsSlice'

interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  videoUrl: string
  focusPoints: FocusPoint[]
  thumbnail?: string
}

interface ProjectsState {
  projects: Project[]
  currentProjectId: string | null
}

const initialState: ProjectsState = {
  projects: [],
  currentProjectId: null,
}

export const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    addProject: (state, action: PayloadAction<Project>) => {
      state.projects.push(action.payload)
      state.currentProjectId = action.payload.id
    },
    updateProject: (state, action: PayloadAction<Project>) => {
      const index = state.projects.findIndex(project => project.id === action.payload.id)
      if (index !== -1) {
        state.projects[index] = action.payload
      }
    },
    removeProject: (state, action: PayloadAction<string>) => {
      state.projects = state.projects.filter(project => project.id !== action.payload)
      if (state.currentProjectId === action.payload) {
        state.currentProjectId = null
      }
    },
    setCurrentProject: (state, action: PayloadAction<string | null>) => {
      state.currentProjectId = action.payload
    },
  },
})

export const {
  addProject,
  updateProject,
  removeProject,
  setCurrentProject,
} = projectsSlice.actions

export default projectsSlice.reducer
