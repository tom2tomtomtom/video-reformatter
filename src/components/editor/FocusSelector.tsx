import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../store'
import { addFocusPoint, FocusPoint, removeFocusPoint } from '../../store/slices/focusPointsSlice'
import Button from '../common/Button'
import SubjectDetectionService, { DetectionResult } from '../../services/SubjectDetectionService'

const FocusSelector = () => {
  const dispatch = useDispatch()
  const { url, currentTime, duration } = useSelector((state: RootState) => state.video)
  const { points } = useSelector((state: RootState) => state.focusPoints)
  
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 })
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 })
  const [focusDescription, setFocusDescription] = useState('')
  const [currentFrameUrl, setCurrentFrameUrl] = useState('')
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectedObjects, setDetectedObjects] = useState<DetectionResult | null>(null)
  const [detectionError, setDetectionError] = useState<string | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Function to capture the current frame from the video
  const captureVideoFrame = useCallback(() => {
    if (!videoRef.current || !url) return
    
    try {
      const video = videoRef.current
      
      // Initialize canvas if needed
      if (!canvasRef.current) {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        canvasRef.current = canvas
      } else {
        // Update canvas dimensions if needed
        canvasRef.current.width = video.videoWidth
        canvasRef.current.height = video.videoHeight
      }
      
      const ctx = canvasRef.current.getContext('2d')
      if (!ctx) return
      
      ctx.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height)
      const dataUrl = canvasRef.current.toDataURL('image/jpeg')
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
      videoRef.current.currentTime = currentTime
    }
  }, [url])
  
  // Update video time when currentTime changes
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.2) {
      videoRef.current.currentTime = currentTime
    }
  }, [currentTime])
  
  // Capture frame when the video is ready or time changes
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    
    const handleTimeUpdate = () => {
      captureVideoFrame()
    }
    
    const handleSeeked = () => {
      captureVideoFrame()
    }
    
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('seeked', handleSeeked)
    video.addEventListener('loadeddata', captureVideoFrame)
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('loadeddata', captureVideoFrame)
    }
  }, [captureVideoFrame])

  // Reset detected objects when time changes
  useEffect(() => {
    setDetectedObjects(null)
    setDetectionError(null)
  }, [currentTime])
  
  const handleDelete = useCallback((id: string) => {
    dispatch(removeFocusPoint(id))
  }, [dispatch])
  
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current || !url) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    
    setIsSelecting(true)
    setSelectionStart({ x, y })
    setSelectionEnd({ x, y })
  }
  
  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    
    setSelectionEnd({ x, y })
  }
  
  const handleContainerMouseUp = () => {
    if (isSelecting) {
      setIsSelecting(false)
      
      // Only create selection if it's a meaningful size (> 5% in both dimensions)
      const width = Math.abs(selectionEnd.x - selectionStart.x)
      const height = Math.abs(selectionEnd.y - selectionStart.y)
      
      if (width > 5 && height > 5) {
        setFocusDescription('') // Reset and prepare for user input
      } else {
        // Reset selection if too small
        setSelectionStart({ x: 0, y: 0 })
        setSelectionEnd({ x: 0, y: 0 })
      }
    }
  }
  
  const calculateSelectionCoords = () => {
    const left = Math.min(selectionStart.x, selectionEnd.x)
    const top = Math.min(selectionStart.y, selectionEnd.y)
    const width = Math.abs(selectionEnd.x - selectionStart.x)
    const height = Math.abs(selectionEnd.y - selectionStart.y)
    
    return { left, top, width, height }
  }
  
  const handleCreateFocusPoint = () => {
    if (!url || (selectionStart.x === 0 && selectionStart.y === 0)) return
    
    const { left, top, width, height } = calculateSelectionCoords()
    
    const newFocusPoint: FocusPoint = {
      id: `focus-${Date.now()}`,
      timeStart: currentTime,
      timeEnd: currentTime + 5, // Default 5 seconds duration
      x: left,
      y: top,
      width,
      height,
      description: focusDescription || 'Unnamed focus point'
    }
    
    dispatch(addFocusPoint(newFocusPoint))
    
    // Reset selection
    setSelectionStart({ x: 0, y: 0 })
    setSelectionEnd({ x: 0, y: 0 })
    setFocusDescription('')
  }
  
  const cancelSelection = () => {
    setSelectionStart({ x: 0, y: 0 })
    setSelectionEnd({ x: 0, y: 0 })
    setFocusDescription('')
  }

  // Handle AI subject detection
  const handleDetectSubjects = async () => {
    if (!canvasRef.current || !url) return

    try {
      setIsDetecting(true)
      setDetectionError(null)

      // Ensure we have the latest frame
      captureVideoFrame()

      // Wait for the canvas to be updated
      await new Promise(resolve => setTimeout(resolve, 100))

      // Load TF.js model if not already loaded
      await SubjectDetectionService.loadModel()

      // Perform detection
      const result = await SubjectDetectionService.detectObjects(canvasRef.current)
      
      if (result.error) {
        setDetectionError(result.error)
        setDetectedObjects(null)
      } else {
        setDetectedObjects(result)
      }
    } catch (error) {
      console.error('Error detecting subjects:', error)
      setDetectionError('Failed to detect subjects. Please try again.')
      setDetectedObjects(null)
    } finally {
      setIsDetecting(false)
    }
  }

  // Add detected objects as focus points
  const handleAcceptDetection = (objectId?: string) => {
    if (!detectedObjects) return

    const focusPointsToAdd = detectedObjects.objects
      // Filter by objectId if provided
      .filter(obj => !objectId || obj.id === objectId)
      // Convert to focus points format
      .map(obj => {
        const [x, y, width, height] = obj.bbox
        
        return {
          id: `focus-${Date.now()}-${obj.id}`,
          timeStart: currentTime,
          timeEnd: currentTime + 5, // Default 5 seconds duration
          x: (x / detectedObjects.imageWidth) * 100,
          y: (y / detectedObjects.imageHeight) * 100,
          width: (width / detectedObjects.imageWidth) * 100,
          height: (height / detectedObjects.imageHeight) * 100,
          description: `${obj.class} (${Math.round(obj.score * 100)}% confidence)`
        }
      })

    // Add each focus point to the store
    focusPointsToAdd.forEach(point => {
      dispatch(addFocusPoint(point))
    })

    // If we added the specific object or all objects, clear the detection
    if (objectId || focusPointsToAdd.length === detectedObjects.objects.length) {
      setDetectedObjects(null)
    }
  }

  // Handle rejecting AI suggestions
  const handleRejectDetection = () => {
    setDetectedObjects(null)
  }
  
  const { left, top, width, height } = calculateSelectionCoords()
  const showSelectionForm = !isSelecting && width > 5 && height > 5
  
  // Simple marker to represent a focus point
  const FocusPointMarker = ({ point }: { point: FocusPoint }) => (
    <div 
      className="absolute border-2 border-yellow-500 rounded cursor-move"
      style={{
        left: `${point.x}%`,
        top: `${point.y}%`,
        width: `${point.width}%`,
        height: `${point.height}%`,
      }}
    >
      <button 
        className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
        onClick={() => handleDelete(point.id)}
      >
        ×
      </button>
    </div>
  )

  // Component to display detected objects
  const DetectedObjectMarker = ({ 
    object, 
    onAccept 
  }: { 
    object: { id: string; class: string; score: number; bbox: [number, number, number, number] }; 
    onAccept: () => void
  }) => {
    const [x, y, width, height] = object.bbox
    const confidence = Math.round(object.score * 100)
    
    return (
      <div 
        className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 rounded-md"
        style={{
          left: `${(x / detectedObjects!.imageWidth) * 100}%`,
          top: `${(y / detectedObjects!.imageHeight) * 100}%`,
          width: `${(width / detectedObjects!.imageWidth) * 100}%`,
          height: `${(height / detectedObjects!.imageHeight) * 100}%`,
        }}
      >
        <div className="absolute top-0 left-0 -mt-7 bg-blue-600 text-white text-xs p-1 rounded">
          {object.class} ({confidence}%)
          <button 
            className="ml-2 bg-green-500 text-white rounded px-1"
            onClick={onAccept}
          >
            Add
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="mt-4">
      <h2 className="text-lg font-semibold mb-2">Focus Points</h2>
      
      {/* Hidden video element for frame capture */}
      <video 
        ref={videoRef} 
        style={{ display: 'none' }} 
        muted 
        playsInline
      ></video>
      
      {!url ? (
        <p className="text-gray-500">Please load a video to add focus points.</p>
      ) : (
        <>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm">
              Click and drag on the video to define focus areas for different aspect ratios.
            </p>
            <Button 
              onClick={handleDetectSubjects} 
              variant="primary"
              disabled={isDetecting}
            >
              {isDetecting ? 'Detecting...' : 'Detect Subjects'}
            </Button>
          </div>
          
          <div 
            ref={containerRef}
            className="relative bg-black rounded overflow-hidden aspect-video cursor-crosshair"
            onMouseDown={handleContainerMouseDown}
            onMouseMove={handleContainerMouseMove}
            onMouseUp={handleContainerMouseUp}
            onMouseLeave={handleContainerMouseUp}
          >
            {/* Video frame display */}
            {currentFrameUrl ? (
              <img 
                src={currentFrameUrl} 
                alt="Current video frame" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <p className="text-white text-center p-4">
                  Current frame at {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
                </p>
              </div>
            )}
            
            {/* Active selection rectangle */}
            {isSelecting && (
              <div 
                className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                }}
              />
            )}
            
            {/* Existing focus points */}
            {points.map(point => (
              <FocusPointMarker 
                key={point.id}
                point={point}
              />
            ))}

            {/* AI detected objects */}
            {detectedObjects && detectedObjects.objects.map(obj => (
              <DetectedObjectMarker
                key={obj.id}
                object={obj}
                onAccept={() => handleAcceptDetection(obj.id)}
              />
            ))}
          </div>

          {/* Detection error message */}
          {detectionError && (
            <div className="mt-2 p-2 bg-red-100 border border-red-300 text-red-700 rounded">
              {detectionError}
            </div>
          )}

          {/* Accept/Reject All Detections */}
          {detectedObjects && detectedObjects.objects.length > 0 && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm">
                {detectedObjects.objects.length} {detectedObjects.objects.length === 1 ? 'subject' : 'subjects'} detected.
              </p>
              <div className="flex mt-2 space-x-2">
                <Button 
                  onClick={() => handleAcceptDetection()} 
                  variant="primary"
                  className="text-sm"
                >
                  Accept All
                </Button>
                <Button 
                  onClick={handleRejectDetection} 
                  variant="secondary"
                  className="text-sm"
                >
                  Reject All
                </Button>
              </div>
            </div>
          )}
          
          {/* Selection form */}
          {showSelectionForm && (
            <div className="mt-4 p-4 bg-gray-100 rounded">
              <h3 className="text-md font-medium mb-2">Add Focus Point</h3>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={focusDescription}
                  onChange={(e) => setFocusDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="E.g., Character speaking, Important action"
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleCreateFocusPoint} variant="primary">
                  Add Focus Point
                </Button>
                <Button onClick={cancelSelection} variant="secondary">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default FocusSelector