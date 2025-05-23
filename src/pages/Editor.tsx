import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { RootState } from '../store'
import VideoPlayer from '../components/video/VideoPlayer'
import VideoTimeline from '../components/video/VideoTimeline'
import FocusSelector from '../components/editor/FocusSelector'
import AspectRatioPreview from '../components/video/AspectRatioPreview'
import Button from '../components/common/Button'

const Editor = () => {
  const navigate = useNavigate()
  const { url, videoId } = useSelector((state: RootState) => state.video)
  
  // Redirect to home if no video URL is available
  useEffect(() => {
    if (!url) {
      // Redirect to home if no video is loaded
      const redirectTimer = setTimeout(() => {
        navigate('/')
      }, 500)
      
      return () => clearTimeout(redirectTimer)
    }
  }, [url, navigate])
  
  if (!url) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-6">No Video Loaded</h1>
        <p className="text-gray-600 mb-6">Please upload a video to begin editing.</p>
        <div className="animate-pulse">
          <p className="text-sm text-gray-500 mb-4">Redirecting to upload page...</p>
        </div>
        <Button onClick={() => navigate('/')} variant="primary">
          Go to Upload
        </Button>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Video Editor</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          <div className="lg:col-span-2 relative">
            <div className="relative z-10">
              <VideoPlayer />
            </div>
            <div className="relative z-20">
              <VideoTimeline />
            </div>
            <div className="relative z-30">
              <FocusSelector />
            </div>
          </div>
          
          <div className="relative z-10">
            <h2 className="text-xl font-semibold mb-4">Format Preview</h2>
            <div className="space-y-6">
              <AspectRatioPreview ratio="9:16" width={240} />
              <AspectRatioPreview ratio="1:1" width={240} />
              <AspectRatioPreview ratio="4:5" width={240} />
            </div>
            
            <div className="mt-8">
              <Button 
                onClick={() => navigate('/export')} 
                variant="primary"
                size="lg"
                fullWidth
              >
                Continue to Export
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Editor

