import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { store } from './store'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  // StrictMode removed - causes double rendering in development which affects video performance
  <Provider store={store}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Provider>
)
