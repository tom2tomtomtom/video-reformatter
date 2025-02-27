import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../store'
import { FocusPoint, updateFocusPoint } from '../../store/slices/focusPointsSlice'
import Button from '../common/Button'

interface KeyframeEditorProps {
  focusPoint: FocusPoint
  onClose: () => void
}

const KeyframeEditor = ({ focusPoint, onClose }: KeyframeEditorProps) => {
  const dispatch = useDispatch()
  const { url, duration } = useSelector((state: RootState) => state.video)
  
  const [editedPoint, setEditedPoint] = useState<FocusPoint>(focusPoint)
  const [currentFrameUrl, setCurrentFrameUrl] = useState('')
  const [previewTime, setPreviewTime] = useState(focusPoint.timeStart)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  
  // Capture video frame at the current time
  const captureVideoFrame = useCallback(() => {
    if (!videoRef.current || !url) return
    
    try {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg')
      setCurrentFrameUrl(dataUrl)
    } catch (err) {
      console.error('Error capturing video frame:', err)
    }
  }, [url])
  
  // Set up the video element and update it when the URL changes
  useEffect(() => {
    if (!url) {
      setCurrentFrameUrl('')
      return
    }
    
    if (videoRef.current) {
      videoRef.current.src = url
      videoRef.current.currentTime = previewTime
    }
  }, [url, previewTime])
  
  // Setup event listeners for video
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    
    const handleSeeked = () => {
      captureVideoFrame()
    }
    
    const handleLoadedData = () => {
      captureVideoFrame()
    }
    
    video.addEventListener('seeked', handleSeeked)
    video.addEventListener('loadeddata', handleLoadedData)
    
    return () => {
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('loadeddata', handleLoadedData)
    }
  }, [captureVideoFrame])
  
  const handleInputChange = (field: keyof FocusPoint, value: any) => {
    setEditedPoint(prev => ({
      ...prev,
      [field]: value
    }))
    
    // For time changes, update the preview
    if (field === 'timeStart') {
      setPreviewTime(value)
    }
  }
  
  const handleSave = () => {
    dispatch(updateFocusPoint(editedPoint))
    onClose()
  }
  
  // Format time display (seconds to MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Edit Focus Point</h2>
      
      {/* Hidden video element for frame capture */}
      <video 
        ref={videoRef} 
        style={{ display: 'none' }} 
        muted 
        playsInline
      ></video>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview section */}
        <div>
          <h3 className="text-lg font-medium mb-3">Preview</h3>
          
          <div className="relative aspect-video bg-black rounded overflow-hidden mb-4">
            {/* Video frame display */}
            {currentFrameUrl ? (
              <div className="relative w-full h-full">
                <img 
                  src={currentFrameUrl} 
                  alt="Focus point preview" 
                  className="w-full h-full object-cover"
                />
                {/* Focus point overlay */}
                <div 
                  className="absolute border-2 border-yellow-500 bg-yellow-500 bg-opacity-20 rounded"
                  style={{
                    left: `${editedPoint.x}%`,
                    top: `${editedPoint.y}%`,
                    width: `${editedPoint.width}%`,
                    height: `${editedPoint.height}%`,
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <p className="text-white">Loading preview...</p>
              </div>
            )}
          </div>
          
          {/* Time navigation */}
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">Preview at time: {formatTime(previewTime)}</p>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={previewTime}
              onChange={(e) => setPreviewTime(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{formatTime(editedPoint.timeStart)}</span>
              <span>{formatTime(editedPoint.timeEnd)}</span>
            </div>
          </div>
          
          <p className="text-sm text-gray-600">
            This focus point is active from {formatTime(editedPoint.timeStart)} to {formatTime(editedPoint.timeEnd)}
          </p>
        </div>
        
        {/* Edit form */}
        <div>
          <h3 className="text-lg font-medium mb-3">Focus Point Details</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input
                type="text"
                value={editedPoint.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Start Time (s)</label>
                <input
                  type="number"
                  min={0}
                  max={editedPoint.timeEnd}
                  step={0.1}
                  value={editedPoint.timeStart}
                  onChange={(e) => handleInputChange('timeStart', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Time (s)</label>
                <input
                  type="number"
                  min={editedPoint.timeStart}
                  max={duration}
                  step={0.1}
                  value={editedPoint.timeEnd}
                  onChange={(e) => handleInputChange('timeEnd', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Position X (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100 - editedPoint.width}
                  value={editedPoint.x}
                  onChange={(e) => handleInputChange('x', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Position Y (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100 - editedPoint.height}
                  value={editedPoint.y}
                  onChange={(e) => handleInputChange('y', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Width (%)</label>
                <input
                  type="number"
                  min={5}
                  max={100 - editedPoint.x}
                  value={editedPoint.width}
                  onChange={(e) => handleInputChange('width', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Height (%)</label>
                <input
                  type="number"
                  min={5}
                  max={100 - editedPoint.y}
                  value={editedPoint.height}
                  onChange={(e) => handleInputChange('height', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
            
            <div className="pt-4 flex space-x-3">
              <Button onClick={handleSave} variant="primary" fullWidth>
                Save Changes
              </Button>
              <Button onClick={onClose} variant="secondary" fullWidth>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KeyframeEditor