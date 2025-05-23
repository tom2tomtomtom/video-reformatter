import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import DynamicVideoPreview from './DynamicVideoPreview'

interface AspectRatioPreviewProps {
  ratio: string
  width: number
}

const AspectRatioPreview: React.FC<AspectRatioPreviewProps> = ({ ratio, width }) => {
  const { selectedPointId, points } = useSelector((state: RootState) => state.focusPoints)
  const { url } = useSelector((state: RootState) => state.video)
  
  const selectedPoint = points.find(p => p.id === selectedPointId) || null
  const hasScannedData = points.length > 0
  
  // Calculate height based on ratio
  const [ratioWidth, ratioHeight] = ratio.split(':').map(Number)
  const aspectRatio = ratioWidth / ratioHeight
  const height = Math.round(width / aspectRatio)
  
  return (
    <div className="aspect-ratio-preview mb-6">
      <div className="mb-1">
        <h3 className="text-lg font-medium">{ratio} ratio</h3>
      </div>
      
      {/* First preview without letterboxing */}
      <div className="mb-2">
        <p className="text-sm text-gray-500 mb-1">Fill and Crop:</p>
        {hasScannedData ? (
          <DynamicVideoPreview 
            ratio={ratio}
            width={width}
            manualFocusPoint={selectedPoint}
            letterboxEnabled={false}
          />
        ) : (
          <div className="flex flex-col items-center justify-center bg-gray-200 rounded"
               style={{ width: `${width}px`, height: `${height}px` }}>
            <div className="text-center p-4">
              <p className="text-gray-600 text-sm mb-2">
                {url ? "Scan video to see preview" : "Upload and scan a video"}
              </p>
              <p className="text-gray-500 text-xs">
                {ratio} ratio (fill)
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Second preview with letterboxing */}
      <div>
        <p className="text-sm text-gray-500 mb-1">With Letterboxing:</p>
        {hasScannedData ? (
          <DynamicVideoPreview 
            ratio={ratio}
            width={width}
            manualFocusPoint={selectedPoint}
            letterboxEnabled={true}
          />
        ) : (
          <div className="flex flex-col items-center justify-center bg-gray-200 rounded"
               style={{ width: `${width}px`, height: `${height}px` }}>
            <div className="text-center p-4">
              <p className="text-gray-600 text-sm mb-2">
                {url ? "Scan video to see preview" : "Upload and scan a video"}
              </p>
              <p className="text-gray-500 text-xs">
                {ratio} ratio (letterbox)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AspectRatioPreview

