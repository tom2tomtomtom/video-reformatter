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
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Redbaez Reformatter</h1>
          <p className="text-xl text-gray-600 mb-4">
            Find perfect clips from TV drama footage and transform them into ideal formats for social media
          </p>
          
          <div className="bg-blue-50 p-4 rounded-lg mb-8 text-center">
            <p className="mb-2 text-blue-800 font-medium">Complete Video Workflow:</p>
            <div className="flex justify-center">
              <div className="flex items-center text-blue-700 text-sm">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
                  <span className="mt-1">Upload</span>
                </div>
                <div className="w-8 border-t border-blue-300 mx-1"></div>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
                  <span className="mt-1">Find Clips</span>
                </div>
                <div className="w-8 border-t border-blue-300 mx-1"></div>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
                  <span className="mt-1">Track Objects</span>
                </div>
                <div className="w-8 border-t border-blue-300 mx-1"></div>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
                  <span className="mt-1">Export</span>
                </div>
              </div>
            </div>
          </div>
          
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
                        <div className="font-medium">Find & Edit Clips <span className="text-blue-600">(Recommended)</span></div>
                        <div className="text-sm text-gray-600">Automatically detect 8-15 second clips from longer videos</div>
                      </button>
                      
                      <button 
                        onClick={() => navigateToPath('/editor')}
                        className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg text-left hover:bg-blue-100 transition-colors"
                      >
                        <div className="font-medium">Skip to Object Tracking</div>
                        <div className="text-sm text-gray-600">For videos that are already short and don't need trimming</div>
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
            <div className="mb-2 flex justify-between items-start">
              <h2 className="text-xl font-semibold">Step 1: Find Clips</h2>
              <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Required</div>
            </div>
            <p className="text-gray-600 mb-3">
              Automatically detect and trim perfect 8-15 second clips from longer videos. Edit with frame-by-frame precision.
            </p>
            <div className="mt-4 text-blue-600 font-medium flex items-center">
              Clip Finder
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          
          <div onClick={() => navigateToPath('/editor')} className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:bg-blue-50 transition-colors">
            <div className="mb-2 flex justify-between items-start">
              <h2 className="text-xl font-semibold">Step 2: Set Focus</h2>
              <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Required</div>
            </div>
            <p className="text-gray-600 mb-3">
              Identify important subjects in your clips and set focus points for automatic tracking across different formats.
            </p>
            <div className="mt-4 text-blue-600 font-medium flex items-center">
              Object Tracker
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          
          <div onClick={() => navigateToPath('/export')} className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:bg-blue-50 transition-colors">
            <div className="mb-2 flex justify-between items-start">
              <h2 className="text-xl font-semibold">Step 3: Export</h2>
              <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Final Step</div>
            </div>
            <p className="text-gray-600 mb-3">
              Generate videos in multiple formats simultaneously: 9:16 for Stories/TikTok, 1:1 for feed posts, and 4:5 for Instagram.
            </p>
            <div className="mt-4 text-blue-600 font-medium flex items-center">
              Export Center
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
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
          
          <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
            <h3 className="font-medium text-yellow-800 mb-1">Pro Tip: Complete Workflow</h3>
            <p className="text-sm text-yellow-700">
              For the best results, follow the complete workflow: Upload → Find Clips → Track Objects → Export. 
              Each step builds on the previous and helps create the perfect social media videos!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
