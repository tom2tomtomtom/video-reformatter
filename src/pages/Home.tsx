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
  const [showOptions, setShowOptions] = useState(false)
  const [fileData, setFileData] = useState<{videoId: string, url: string, fileName: string} | null>(null)
  
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
    setShowOptions(false)
    
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
      
      // Store file data for later use
      setFileData({videoId, url, fileName: file.name})
      
      // Show options instead of auto-navigating
      setShowOptions(true)
      setIsUploading(false)
      
    } catch (error) {
      console.error("Error handling file:", error)
      setUploadError('Failed to process the video file. Please try again.')
      setIsUploading(false)
    }
  }, [dispatch])
  
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
  
  const navigateToPath = (path: string) => {
    console.log(`Navigating to ${path}...`)
    navigate(path)
  }
  
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Redbaez Reformatter</h1>
          <p className="text-xl text-gray-600 mb-8">
            Find perfect clips from TV drama footage and transform them into ideal formats for social media
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
            
            {!showOptions && (
              <>
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
              </>
            )}
            
            {/* Show options after upload */}
            {showOptions && fileData && (
              <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                <h2 className="text-xl font-semibold mb-4">Video Uploaded Successfully!</h2>
                <p className="text-gray-600 mb-4">
                  What would you like to do with "{fileData.fileName}"?
                </p>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Choose Your Workflow:</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={() => navigateToPath('/clips')}
                        className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg text-left hover:bg-blue-100 transition-colors"
                      >
                        <div className="font-medium">Find & Edit Clips</div>
                        <div className="text-sm text-gray-600">Automatically detect 8-15 second clips from longer videos</div>
                      </button>
                      
                      <button 
                        onClick={() => navigateToPath('/editor')}
                        className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg text-left hover:bg-blue-100 transition-colors"
                      >
                        <div className="font-medium">Start From Object Tracking</div>
                        <div className="text-sm text-gray-600">Skip to object detection for videos that are already short</div>
                      </button>
                    </div>
                  </div>
                  
                  <div className="pt-3 flex justify-between border-t border-gray-200">
                    <Button 
                      variant="secondary"
                      onClick={() => setShowOptions(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div onClick={() => navigateToPath('/clips')} className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:bg-blue-50 transition-colors">
            <h2 className="text-xl font-semibold mb-3">Step 1: Find Perfect Clips</h2>
            <p className="text-gray-600">
              Automatically detect and trim perfect 8-15 second clips from longer videos. Edit with frame-by-frame precision.
            </p>
            <div className="mt-4 text-blue-600 font-medium">
              Clip Finder
            </div>
          </div>
          
          <div onClick={() => navigateToPath('/editor')} className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:bg-blue-50 transition-colors">
            <h2 className="text-xl font-semibold mb-3">Step 2: Track Important Objects</h2>
            <p className="text-gray-600">
              Identify important subjects in your clips and set focus points for automatic tracking across different formats.
            </p>
            <div className="mt-4 text-blue-600 font-medium">
              Object Tracker
            </div>
          </div>
          
          <div onClick={() => navigateToPath('/export')} className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:bg-blue-50 transition-colors">
            <h2 className="text-xl font-semibold mb-3">Step 3: Export for Social</h2>
            <p className="text-gray-600">
              Generate videos in multiple formats simultaneously: 9:16 for Stories/TikTok, 1:1 for feed posts, and 4:5 for Instagram.
            </p>
            <div className="mt-4 text-blue-600 font-medium">
              Export Center
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 p-8 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Workflow Overview</h2>
          <ol className="list-decimal pl-5 space-y-3">
            <li className="text-gray-700">
              <span className="font-medium">Upload your video</span> - Start with your original TV or film footage (or upload pre-trimmed clips)
            </li>
            <li className="text-gray-700">
              <span className="font-medium">Find perfect clips</span> - Use our automatic clip detection to identify coherent 8-15 second segments
            </li>
            <li className="text-gray-700">
              <span className="font-medium">Trim with precision</span> - Use frame-by-frame controls to get the perfect in and out points
            </li>
            <li className="text-gray-700">
              <span className="font-medium">Set focus points</span> - Identify speakers, actions, and important elements that should remain in frame
            </li>
            <li className="text-gray-700">
              <span className="font-medium">Export for all platforms</span> - Generate videos in multiple aspect ratios ready for social media
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default Home
