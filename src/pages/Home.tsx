import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { setVideoUrl } from '../store/slices/videoSlice'
import Button from '../components/common/Button'

const Home = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Reset any previous errors
    setUploadError(null)
    
    const file = e.target.files?.[0]
    if (!file) return
    
    console.log("File selected:", file.name, file.type) // Debug log
    
    // Check if the file is a video
    if (!file.type.startsWith('video/')) {
      setUploadError('Please select a valid video file.')
      return
    }
    
    try {
      // For demonstration, create a local URL for the video file
      const url = URL.createObjectURL(file)
      console.log("File URL created:", url) // Debug log
      dispatch(setVideoUrl(url))
      
      // Navigate to editor
      navigate('/editor')
    } catch (error) {
      console.error("Error handling file:", error)
      setUploadError('Failed to process the video file. Please try again.')
    }
  }, [dispatch, navigate])
  
  const handleButtonClick = useCallback(() => {
    console.log("Upload button clicked") // Debug log
    // Reset file input value to ensure onChange fires even if the same file is selected
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      // Trigger the file input click
      fileInputRef.current.click()
    }
  }, [])
  
  // Add direct DOM event listener as a fallback
  useEffect(() => {
    const buttonElement = document.getElementById('upload-button')
    if (buttonElement) {
      const clickHandler = () => {
        console.log("Direct click handler")
        fileInputRef.current?.click()
      }
      
      buttonElement.addEventListener('click', clickHandler)
      return () => {
        buttonElement.removeEventListener('click', clickHandler)
      }
    }
  }, [])
  
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Video Reformatter</h1>
          <p className="text-xl text-gray-600 mb-8">
            Transform 16:9 TV drama footage into perfect formats for Instagram, Facebook, TikTok and more
          </p>
          
          <div className="max-w-md mx-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            
            {/* Regular button implementation */}
            <Button 
              id="upload-button"
              variant="primary" 
              size="lg" 
              fullWidth
              onClick={handleButtonClick}
            >
              Upload Video
            </Button>
            
            {/* Fallback HTML button in case the Button component has issues */}
            <button 
              className="hidden mt-2 bg-green-600 text-white px-4 py-2 rounded"
              onClick={() => fileInputRef.current?.click()}
            >
              Alternative Upload Button
            </button>
            
            <p className="text-sm text-gray-500 mt-2">Supported formats: MP4, MOV, WebM (max 1GB)</p>
            
            {uploadError && (
              <p className="text-red-500 mt-2">{uploadError}</p>
            )}
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
