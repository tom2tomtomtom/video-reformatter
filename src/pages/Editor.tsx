import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { RootState } from '../store'
import VideoPlayer from '../components/video/VideoPlayer'
import VideoTimeline from '../components/video/VideoTimeline'
import FocusSelector from '../components/editor/FocusSelector'
import AspectRatioPreview from '../components/video/AspectRatioPreview'
import TestButtons from '../components/editor/TestButtons'
import ClickDiagnostic from '../components/editor/ClickDiagnostic'
import DirectHTMLButtons from '../components/editor/DirectHTMLButtons'
import DirectHtmlFocusSelector from '../components/editor/DirectHtmlFocusSelector'

const Editor = () => {
  const navigate = useNavigate()
  const { url } = useSelector((state: RootState) => state.video)
  
  if (!url) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-6">No Video Loaded</h1>
        <p className="text-gray-600 mb-6">Please upload a video to begin editing.</p>
        <button 
          onClick={() => navigate('/')} 
          className="px-4 py-2 bg-blue-600 text-white rounded-md"
        >
          Go to Upload
        </button>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Video Editor</h1>
        
        {/* Emergency Button for navigation */}
        <div style={{ margin: '20px 0', backgroundColor: '#fff3cd', padding: '15px', border: '2px solid #ffc107', borderRadius: '4px' }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '10px' }}>Emergency Navigation</h3>
          <button 
            onClick={() => navigate('/')} 
            style={{ backgroundColor: '#ffc107', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Go Back to Upload
          </button>
        </div>
        
        {/* Diagnostic tool */}
        <ClickDiagnostic />
        
        {/* Test components */}
        <TestButtons />
        <DirectHTMLButtons />
        <DirectHtmlFocusSelector />
        
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
              <button 
                onClick={() => navigate('/export')} 
                className="w-full px-6 py-3 bg-blue-600 text-white text-lg rounded-md hover:bg-blue-700"
              >
                Continue to Export
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Editor
