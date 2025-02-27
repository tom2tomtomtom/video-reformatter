import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { FocusPoint } from '../../store/slices/focusPointsSlice'

interface AspectRatioPreviewProps {
  ratio: string
  width: number
}

const AspectRatioPreview: React.FC<AspectRatioPreviewProps> = ({ ratio, width }) => {
  const { url } = useSelector((state: RootState) => state.video)
  const { selectedPointId, points } = useSelector((state: RootState) => state.focusPoints)
  
  const selectedPoint = points.find(p => p.id === selectedPointId) || null
  
  if (!url) {
    return (
      <div 
        className="bg-gray-200 rounded flex items-center justify-center"
        style={{ width: `${width}px`, aspectRatio: ratio.replace(':', '/') }}
      >
        <p className="text-center text-sm text-gray-500">No video loaded</p>
      </div>
    )
  }
  
  // Extract ratio values
  const [ratioWidth, ratioHeight] = ratio.split(':').map(Number)
  
  // Calculate container dimensions
  const aspectRatio = ratioWidth / ratioHeight
  const height = width / aspectRatio
  
  // Calculate crop values based on selected focus point
  const getCropStyles = () => {
    if (!selectedPoint) return {}
    
    // For 16:9 source to other aspect ratios
    const sourceRatio = 16 / 9
    const targetRatio = ratioWidth / ratioHeight
    
    // Calculate scaling and positioning
    let scale, offsetX, offsetY
    
    if (targetRatio < sourceRatio) {
      // Target is taller than source (e.g., 9:16 vertical video)
      scale = sourceRatio / targetRatio
      offsetX = selectedPoint.x * scale - (scale - 1) * 50 // Center by default
      offsetY = selectedPoint.y
    } else {
      // Target is wider than source (e.g., 1:1 square)
      scale = targetRatio / sourceRatio
      offsetX = selectedPoint.x
      offsetY = selectedPoint.y * scale - (scale - 1) * 50 // Center by default
    }
    
    return {
      transform: `scale(${scale})`,
      transformOrigin: `${offsetX}% ${offsetY}%`
    }
  }
  
  return (
    <div className="relative overflow-hidden rounded border border-gray-300">
      <div className="absolute top-0 left-0 text-xs bg-black bg-opacity-50 text-white px-2 py-1 z-10">
        {ratio}
      </div>
      
      <div 
        className="overflow-hidden"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        {/* This would be your actual video frame, using an image for example */}
        {url && (
          <img 
            src={url} 
            alt="Video frame"
            className="object-cover w-full h-full"
            style={getCropStyles()}
          />
        )}
      </div>
    </div>
  )
}

export default AspectRatioPreview
