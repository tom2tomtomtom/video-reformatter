import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { setVideoMetadata } from '../store/slices/videoSlice'
import Button from '../components/common/Button'
import FileUploader from '../components/common/FileUploader'
import { storeVideo } from '../utils/videoStorage'

const Home = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showFallbackButton, setShowFallbackButton] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  
  // After 3 seconds, show the fallback button in case the main button has issues
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFallbackButton(true)
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [])
  
  const handleFileSelect = useCallback(async (file: File) => {
    // Reset any previous errors
    setUploadError(null)
    setIsUploading(true)
    
    console.log("File selected:", file.name, file.type) // Debug log
    
    // Check if the file is a video
    if (!file.type.startsWith('video/')) {
      setUploadError('Please select a valid video file.')
      setIsUploading(false)
      return
    }
    
    try {
      // Store the video file in IndexedDB for persistence
      console.log("About to store video in IndexedDB...")
      const { videoId, url } = await storeVideo(file)
      console.log("Video stored successfully with ID:", videoId)
      console.log("Generated URL:", url)
      
      // Dispatch to Redux with full metadata
      console.log("Dispatching to Redux...")
      dispatch(setVideoMetadata({
        url,
        fileName: file.name,
        videoId
      }))
      console.log("Redux dispatch complete")
      
      // Navigate to editor
      console.log("Preparing to navigate to editor...")
      window.setTimeout(() => {
        console.log("Now navigating to editor...")
        navigate('/editor')
      }, 500) // Add a slight delay to ensure Redux state is updated
    } catch (error) {
      console.error("Error handling file:", error)
      setUploadError('Failed to process the video file. Please try again.')
      setIsUploading(false)
    }
  }, [dispatch, navigate])
  
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }, [handleFileSelect])
  
  const handleButtonClick = useCallback(() => {
    console.log("Upload button clicked") // Debug log
    // Reset file input value to ensure onChange fires even if the same file is selected
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      // Trigger the file input click
      fileInputRef.current.click()
    }
  }, [])
  
  const navigateToClips = () => {
    navigate('/clips');
  };
  
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Redbaez Reformatter</h1>
          <p className="text-xl text-gray-600 mb-8">
            Transform 16:9 TV drama footage into perfect formats for Instagram, Facebook, TikTok and more
          </p>
          
          <div className="max-w-md mx-auto">
            {/* Original approach (if it doesn't work, it will be supplemented by the components below) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            
            {/* Primary Upload Button - Custom FileUploader component */}
            <div className="mb-4">
              <FileUploader
                onFileSelected={handleFileSelect}
                accept="video/*"
                label="Upload Video"
                className="mb-2"
              />
              <p className="text-sm text-gray-500">
                Supported formats: MP4, MOV, WebM (max 1GB)
              </p>
            </div>
            
            {/* Original Button implementation as backup */}
            <div className="hidden">
              <Button 
                id="upload-button"
                variant="primary" 
                size="lg" 
                fullWidth
                onClick={handleButtonClick}
              >
                Upload Video
              </Button>
            </div>
            
            {uploadError && (
              <p className="text-red-500 mt-2">{uploadError}</p>
            )}
            
            {isUploading && (
              <p className="text-gray-500 mt-2">Uploading...</p>
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
          
          <div onClick={navigateToClips} className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:bg-blue-50 transition-colors border-2 border-blue-200">
            <h2 className="text-xl font-semibold mb-3">NEW! Clip Detection & Editing</h2>
            <p className="text-gray-600">
              Automatically find and trim perfect clips from your source footage. Extract 8-15 second clips for social media with frame-perfect controls.
            </p>
            <div className="mt-4 text-blue-600 font-medium flex items-center">
              Try Now
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 p-8 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
          <ol className="list-decimal pl-5 space-y-3">
            <li className="text-gray-700">
              <span className="font-medium">Upload your 16:9 video</span> - Start with your original landscape TV or film footage.
            </li>
            <li className="text-gray-700">
              <span className="font-medium">Find perfect clips</span> - Use our automatic clip detection to identify coherent segments.
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
