import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../store'
import { setVideoUrl } from '../store/slices/videoSlice'
import DynamicVideoPreview from '../components/video/DynamicVideoPreview'

const DebugPage = () => {
  const dispatch = useDispatch()
  const { url } = useSelector((state: RootState) => state.video)
  const [isLoaded, setIsLoaded] = useState(false)
  
  // Sample video URL
  const sampleVideoUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  
  // Set video URL on component mount
  useEffect(() => {
    if (!url) {
      console.log('Setting sample video URL in Redux store')
      dispatch(setVideoUrl(sampleVideoUrl))
      setIsLoaded(true)
    } else {
      setIsLoaded(true)
    }
  }, [dispatch, url])
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Video Preview Debug Page</h1>
      
      <div className="mb-4">
        <p>Video URL: {url || 'No URL set'}</p>
        <p>Loading State: {isLoaded ? 'Loaded' : 'Loading'}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">16:9 Preview</h2>
          <DynamicVideoPreview 
            ratio="16:9"
            width={320}
          />
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">9:16 Preview</h2>
          <DynamicVideoPreview 
            ratio="9:16"
            width={180}
          />
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">1:1 Preview</h2>
          <DynamicVideoPreview 
            ratio="1:1"
            width={320}
          />
        </div>
      </div>
    </div>
  )
}

export default DebugPage
