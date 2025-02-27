import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../store'
import { addFocusPoint, FocusPoint, removeFocusPoint } from '../../store/slices/focusPointsSlice'
import Button from '../common/Button'

const FocusSelector = () => {
  const dispatch = useDispatch()
  const { url, currentTime } = useSelector((state: RootState) => state.video)
  const { points } = useSelector((state: RootState) => state.focusPoints)
  
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 })
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 })
  const [focusDescription, setFocusDescription] = useState('')
  
  const containerRef = useRef<HTMLDivElement>(null)
  
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
  
  const { left, top, width, height } = calculateSelectionCoords()
  const showSelectionForm = !isSelecting && width > 5 && height > 5
  
  // Simple marker to represent a focus point (in real app you'd use FocusPointMarker component)
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
  
  return (
    <div className="mt-4">
      <h2 className="text-lg font-semibold mb-2">Focus Points</h2>
      
      {!url ? (
        <p className="text-gray-500">Please load a video to add focus points.</p>
      ) : (
        <>
          <p className="text-sm mb-3">
            Click and drag on the video to define focus areas for different aspect ratios.
          </p>
          
          <div 
            ref={containerRef}
            className="relative bg-black rounded overflow-hidden aspect-video cursor-crosshair"
            onMouseDown={handleContainerMouseDown}
            onMouseMove={handleContainerMouseMove}
            onMouseUp={handleContainerMouseUp}
            onMouseLeave={handleContainerMouseUp}
          >
            {/* Video placeholder - in a real implementation, this would be the actual video frame */}
            {url && (
              <img 
                src={url} 
                alt="Video frame"
                className="w-full h-full object-contain"
              />
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
          </div>
          
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
