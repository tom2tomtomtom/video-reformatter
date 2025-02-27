import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../store'
import { setCurrentTime, setIsPlaying } from '../../store/slices/videoSlice'
import { setSelectedPoint } from '../../store/slices/focusPointsSlice'
import Button from '../common/Button'

const VideoTimeline = () => {
  const dispatch = useDispatch()
  const { duration, currentTime, isPlaying } = useSelector((state: RootState) => state.video)
  const { points } = useSelector((state: RootState) => state.focusPoints)
  
  const [isDragging, setIsDragging] = useState(false)
  const timelineRef = useRef<HTMLDivElement>(null)

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration === 0) return
    
    const rect = timelineRef.current.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const newTime = (offsetX / rect.width) * duration
    
    dispatch(setCurrentTime(Math.max(0, Math.min(newTime, duration))))
  }

  const handleMouseDown = () => {
    if (isPlaying) {
      dispatch(setIsPlaying(false))
    }
    setIsDragging(true)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !timelineRef.current || duration === 0) return
    
    const rect = timelineRef.current.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const newTime = (offsetX / rect.width) * duration
    
    dispatch(setCurrentTime(Math.max(0, Math.min(newTime, duration))))
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const handlePlayPause = () => {
    dispatch(setIsPlaying(!isPlaying))
  }

  const getContinuousFocusPoint = () => {
    return points.find(point => currentTime >= point.timeStart && currentTime <= point.timeEnd) || null
  }

  const currentFocusPoint = getContinuousFocusPoint()

  useEffect(() => {
    const pointId = currentFocusPoint?.id || null
    dispatch(setSelectedPoint(pointId))
  }, [currentTime, points])

  return (
    <div className="mt-4">
      <div className="flex items-center mb-2">
        <Button
          variant="primary"
          onClick={handlePlayPause}
          className="mr-3"
          size="sm"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        <span className="text-sm font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>
      
      <div 
        ref={timelineRef}
        className="h-8 bg-gray-200 rounded-md cursor-pointer relative"
        onClick={handleTimelineClick}
      >
        {/* Timeline progress */}
        <div 
          className="absolute top-0 left-0 h-full bg-blue-500 rounded-l-md"
          style={{ width: `${(currentTime / duration) * 100}%` }}
        />
        
        {/* Focus points markers */}
        {points.map(point => (
          <div 
            key={point.id}
            className="absolute top-0 h-full border-r-2 border-r-yellow-500"
            style={{ left: `${(point.timeStart / duration) * 100}%` }}
            title={point.description}
          />
        ))}
        
        {/* Current time cursor */}
        <div 
          className="absolute top-0 w-1 h-full bg-white border-l border-r border-gray-400 cursor-ew-resize"
          style={{ left: `${(currentTime / duration) * 100}%` }}
          onMouseDown={handleMouseDown}
        />
      </div>
      
      {currentFocusPoint && (
        <div className="mt-2 text-xs bg-yellow-100 p-2 rounded">
          Current focus: {currentFocusPoint.description}
        </div>
      )}
    </div>
  )
}

export default VideoTimeline
