import { Link, useLocation } from 'react-router-dom'

const Header = () => {
  const location = useLocation()
  
  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <header className="bg-blue-600 text-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold">Redbaez Reformatter</Link>
          <nav className="flex space-x-2 md:space-x-4">
            {/* Step 1: Upload Video */}
            <Link 
              to="/" 
              className={`px-2 py-1 hover:text-blue-200 ${isActive('/') ? 'font-semibold border-b-2 border-white' : ''}`}
            >
              <span className="mr-1 text-blue-300">1.</span> Upload
            </Link>
            
            {/* Step 2: Find Clips */}
            <Link 
              to="/clips" 
              className={`px-2 py-1 hover:text-blue-200 ${isActive('/clips') ? 'font-semibold border-b-2 border-white' : ''}`}
            >
              <span className="mr-1 text-blue-300">2.</span> Clip Finder
            </Link>
            
            {/* Step 3: Object Detection */}
            <Link 
              to="/editor" 
              className={`px-2 py-1 hover:text-blue-200 ${isActive('/editor') ? 'font-semibold border-b-2 border-white' : ''}`}
            >
              <span className="mr-1 text-blue-300">3.</span> Object Detector
            </Link>
            
            {/* Step 4: Export */}
            <Link 
              to="/export" 
              className={`px-2 py-1 hover:text-blue-200 ${isActive('/export') ? 'font-semibold border-b-2 border-white' : ''}`}
            >
              <span className="mr-1 text-blue-300">4.</span> Export
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}

export default Header
