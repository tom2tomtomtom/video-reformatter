import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { setVideoUrl } from '../store/slices/videoSlice'
import Button from '../components/common/Button'

const Home = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // For demonstration, create a local URL for the video file
    const url = URL.createObjectURL(file)
    dispatch(setVideoUrl(url))
    
    // Navigate to editor
    navigate('/editor')
  }, [dispatch, navigate])
  
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Video Reformatter</h1>
          <p className="text-xl text-gray-600 mb-8">
            Transform 16:9 TV drama footage into perfect formats for Instagram, Facebook, TikTok and more
          </p>
          
          <div className="max-w-md mx-auto">
            <label className="block w-full">
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button variant="primary" size="lg" fullWidth>
                Upload Video
              </Button>
            </label>
            <p className="text-sm text-gray-500 mt-2">Supported formats: MP4, MOV, WebM (max 1GB)</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-3">Smart Focus Tracking</h2>
            <p className="text-gray-600">
              Identify important subjects in your 16:9 footage and automatically track them when reformatting to vertical or square formats.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-3">Multi-Format Export</h2>
            <p className="text-gray-600">
              Export your videos in multiple aspect ratios simultaneously, including 9:16 for Stories/TikTok, 1:1 for feed posts, and 4:5 for Instagram.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-3">Preserve Narrative</h2>
            <p className="text-gray-600">
              Maintain the narrative focus of your dramatic content by intelligently following speakers and key action in every scene.
            </p>
          </div>
        </div>
        
        <div className="bg-blue-50 p-8 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
          <ol className="list-decimal pl-5 space-y-3">
            <li className="text-gray-700">
              <span className="font-medium">Upload your 16:9 video</span> - Start with your original landscape TV or film footage.
            </li>
            <li className="text-gray-700">
              <span className="font-medium">Mark focal points</span> - Identify speakers, actions, and important elements in your timeline.
            </li>
            <li className="text-gray-700">
              <span className="font-medium">Preview all formats</span> - See how your content will look across different platforms.
            </li>
            <li className="text-gray-700">
              <span className="font-medium">Export</span> - Generate optimized videos for all your social media channels.
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default Home
