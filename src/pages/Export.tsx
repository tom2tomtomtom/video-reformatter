import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { RootState } from '../store'
import VideoExporter from '../components/video/VideoExporter'
import AspectRatioPreview from '../components/video/AspectRatioPreview'
import Button from '../components/common/Button'

const Export = () => {
  const navigate = useNavigate()
  const { url } = useSelector((state: RootState) => state.video)
  
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
            <h2 className="text-xl font-semibold mb-4">Preview</h2>
            <div className="grid grid-cols-2 gap-4">
              <AspectRatioPreview ratio="9:16" width={180} />
              <AspectRatioPreview ratio="1:1" width={180} />
              <AspectRatioPreview ratio="4:5" width={180} />
              <AspectRatioPreview ratio="16:9" width={180} />
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
