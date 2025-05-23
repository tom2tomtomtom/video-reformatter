import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../store'
import { FocusPoint, updateFocusPoint } from '../../store/slices/focusPointsSlice'

interface FocusPointMarkerProps {
  focusPoint: FocusPoint
  onDelete: (id: string) => void
}

const FocusPointMarker: React.FC<FocusPointMarkerProps> = ({ focusPoint, onDelete }) => {
  const dispatch = useDispatch()
  const { selectedPointId } = useSelector((state: RootState) => state.focusPoints)
  const [isDragging, setIsDragging] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [startDims, setStartDims] = useState({ x: focusPoint.x, y: focusPoint.y })
  
  const isSelected = selectedPointId === focusPoint.id
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDragging(true)
    setStartPos({ x: e.clientX, y: e.clientY })
    setStartDims({ x: focusPoint.x, y: focusPoint.y })
  }
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    
    const deltaX = e.clientX - startPos.x
    const deltaY = e.clientY - startPos.y
    
    // Calculate new position within 0-100% bounds
    const newX = Math.max(0, Math.min(100 - focusPoint.width, startDims.x + deltaX * 0.1))
    const newY = Math.max(0, Math.min(100 - focusPoint.height, startDims.y + deltaY * 0.1))
    
    dispatch(updateFocusPoint({
      ...focusPoint,
      x: newX,
      y: newY
    }))
  }
  
  const handleMouseUp = () => {
    setIsDragging(false)
  }
  
  const handleResize = (direction: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // Implement resize logic here
  }

  // Add event listeners for drag
  useState(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return (
    <div 
      className={`absolute border-2 ${isSelected ? 'border-blue-500' : 'border-yellow-500'} rounded cursor-move`}
      style={{
        left: `${focusPoint.x}%`,
        top: `${focusPoint.y}%`,
        width: `${focusPoint.width}%`,
        height: `${focusPoint.height}%`,
      }}
      onMouseDown={handleMouseDown}
    >
      {isSelected && (
        <div className="absolute top-0 right-0 -mt-2 -mr-2 flex space-x-1">
          <button 
            className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
            onClick={() => onDelete(focusPoint.id)}
          >
            ×
          </button>
        </div>
      )}
      
      {/* Resize handles - can be implemented as needed */}
    </div>
  )
}

export default FocusPointMarker

