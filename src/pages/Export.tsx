import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { RootState } from '../store'
import VideoExporter from '../components/video/VideoExporter'
import DynamicVideoPreview from '../components/video/DynamicVideoPreview'
import Button from '../components/common/Button'
import { useState } from 'react'

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
            <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
            <p className="text-sm text-gray-600 mb-4">
              These previews show how your video will appear in each format, 
              based on active focus points at the current timeline position.
            </p>
            
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Letterboxed</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <div className="preview-container" style={{ width: '150px', aspectRatio: '9/16', overflow: 'hidden' }}>
                    <DynamicVideoPreview ratio="9:16" width={150} height={267} letterboxEnabled={true} />
                  </div>
                  <p className="text-xs text-center mt-1">9:16 Portrait</p>
                </div>
                <div>
                  <div className="preview-container" style={{ width: '150px', aspectRatio: '1/1', overflow: 'hidden' }}>
                    <DynamicVideoPreview ratio="1:1" width={150} height={150} letterboxEnabled={true} />
                  </div>
                  <p className="text-xs text-center mt-1">1:1 Square</p>
                </div>
                <div>
                  <div className="preview-container" style={{ width: '150px', aspectRatio: '4/5', overflow: 'hidden' }}>
                    <DynamicVideoPreview ratio="4:5" width={150} height={188} letterboxEnabled={true} />
                  </div>
                  <p className="text-xs text-center mt-1">4:5 Instagram</p>
                </div>
              </div>
            </div>
            
            <div className="mb-8">
              <h3 className="text-sm font-medium mb-2">Non-letterboxed</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <div className="preview-container" style={{ width: '150px', aspectRatio: '9/16', overflow: 'hidden' }}>
                    <DynamicVideoPreview ratio="9:16" width={150} height={267} letterboxEnabled={false} />
                  </div>
                  <p className="text-xs text-center mt-1">9:16 Portrait</p>
                </div>
                <div>
                  <div className="preview-container" style={{ width: '150px', aspectRatio: '1/1', overflow: 'hidden' }}>
                    <DynamicVideoPreview ratio="1:1" width={150} height={150} letterboxEnabled={false} />
                  </div>
                  <p className="text-xs text-center mt-1">1:1 Square</p>
                </div>
                <div>
                  <div className="preview-container" style={{ width: '150px', aspectRatio: '4/5', overflow: 'hidden' }}>
                    <DynamicVideoPreview ratio="4:5" width={150} height={188} letterboxEnabled={false} />
                  </div>
                  <p className="text-xs text-center mt-1">4:5 Instagram</p>
                </div>
              </div>
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