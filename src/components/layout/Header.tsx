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
          <nav className="flex space-x-6">
            <Link 
              to="/" 
              className={`hover:text-blue-200 ${isActive('/') ? 'font-semibold border-b-2 border-white' : ''}`}
            >
              Home
            </Link>
            <Link 
              to="/editor" 
              className={`hover:text-blue-200 ${isActive('/editor') ? 'font-semibold border-b-2 border-white' : ''}`}
            >
              Editor
            </Link>
            <Link 
              to="/export" 
              className={`hover:text-blue-200 ${isActive('/export') ? 'font-semibold border-b-2 border-white' : ''}`}
            >
              Export
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}

export default Header

