import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { RootState } from '../store'
import VideoExporter from '../components/video/VideoExporter'
import DynamicVideoPreview from '../components/video/DynamicVideoPreview'
import Button from '../components/common/Button'
import { useEffect, useRef, useState } from 'react'

const Export = () => {
  const navigate = useNavigate()
  const { url, currentTime, isPlaying } = useSelector((state: RootState) => state.video)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isVideoReady, setIsVideoReady] = useState(false)
  
  // Set up video event listeners
  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement || !url) return
    
    const handleCanPlay = () => {
      setIsVideoReady(true)
      videoElement.currentTime = currentTime
    }
    
    videoElement.addEventListener('canplay', handleCanPlay)
    
    // Clean up
    return () => {
      videoElement.removeEventListener('canplay', handleCanPlay)
    }
  }, [url])
  
  // Keep the video in sync with the current time
  useEffect(() => {
    if (videoRef.current && isVideoReady && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime
    }
  }, [currentTime, isVideoReady])
  
  // Handle play/pause state
  useEffect(() => {
    if (videoRef.current && isVideoReady) {
      if (isPlaying) {
        videoRef.current.play().catch(err => console.error("Failed to play:", err))
      } else {
        videoRef.current.pause()
      }
    }
  }, [isPlaying, isVideoReady])
  
  if (!url) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-6">No Video Loaded</h1>
        <p className="text-gray-600 mb-6">Please upload a video before accessing the export page.</p>
        <Button onClick={() => navigate('/')} variant="primary">
          Go to Upload
        </Button>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Export Video</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <VideoExporter />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
            <p className="text-sm text-gray-600 mb-4">
              These previews show how your video will appear in each format, 
              based on active focus points at the current timeline position.
            </p>
            
            <div className="mb-6">
              <div className="aspect-video bg-black relative mb-2 rounded overflow-hidden">
                <video 
                  ref={videoRef}
                  src={url}
                  className="w-full h-full"
                  muted
                  playsInline
                  preload="auto"
                />
              </div>
              <p className="text-xs text-gray-500 text-center">Original 16:9 Video</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <DynamicVideoPreview ratio="9:16" width={180} />
              <DynamicVideoPreview ratio="1:1" width={180} />
              <DynamicVideoPreview ratio="4:5" width={180} />
              <DynamicVideoPreview ratio="16:9" width={180} />
            </div>
            
            <div className="mt-8">
              <Button 
                onClick={() => navigate('/editor')} 
                variant="secondary"
                size="lg"
              >
                Back to Editor
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Export