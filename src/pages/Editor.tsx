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
  const { url } = useSelector((state: RootState) => state.video)
  
  if (!url) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-6">No Video Loaded</h1>
        <p className="text-gray-600 mb-6">Please upload a video to begin editing.</p>
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
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <VideoPlayer />
            <VideoTimeline />
            <FocusSelector />
          </div>
          
          <div>
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
