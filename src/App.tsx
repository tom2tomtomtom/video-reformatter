import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Editor from './pages/Editor'
import Export from './pages/Export'
import ClipDetection from './pages/ClipDetection'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/clips" element={<ClipDetection />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/export" element={<Export />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
