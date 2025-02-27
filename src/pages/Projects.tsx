import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { RootState } from '../store'
import { removeProject, setCurrentProject } from '../store/slices/projectsSlice'
import Button from '../components/common/Button'

const Projects = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { projects } = useSelector((state: RootState) => state.projects)
  
  const [searchTerm, setSearchTerm] = useState('')
  
  const filteredProjects = searchTerm 
    ? projects.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : projects
  
  const handleOpenProject = (id: string) => {
    dispatch(setCurrentProject(id))
    navigate('/editor')
  }
  
  const handleDeleteProject = (id: string) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      dispatch(removeProject(id))
    }
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">My Projects</h1>
          <Button 
            onClick={() => navigate('/')} 
            variant="primary"
          >
            New Project
          </Button>
        </div>
        
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search projects..."
            className="w-full px-4 py-2 border border-gray-300 rounded"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {filteredProjects.length === 0 ? (
          <div className="bg-gray-50 p-8 text-center rounded-lg">
            <h2 className="text-xl font-medium mb-2">No Projects Found</h2>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 
                'No projects match your search. Try a different term.' : 
                'You haven\'t created any projects yet.'}
            </p>
            {!searchTerm && (
              <Button 
                onClick={() => navigate('/')} 
                variant="primary"
              >
                Create Your First Project
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredProjects.map(project => (
              <div 
                key={project.id} 
                className="bg-white rounded-lg shadow overflow-hidden border border-gray-200"
              >
                <div className="h-40 bg-gray-200 relative">
                  {project.thumbnail ? (
                    <img 
                      src={project.thumbnail} 
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <span className="text-gray-400">No thumbnail</span>
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-1">{project.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    Last edited: {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                  
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => handleOpenProject(project.id)}
                      variant="primary"
                      size="sm"
                    >
                      Open
                    </Button>
                    <Button 
                      onClick={() => handleDeleteProject(project.id)}
                      variant="danger"
                      size="sm"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Projects
