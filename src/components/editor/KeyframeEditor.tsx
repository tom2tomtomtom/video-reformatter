import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../store'
import { FocusPoint, updateFocusPoint } from '../../store/slices/focusPointsSlice'
import Button from '../common/Button'

const KeyframeEditor = () => {
  const dispatch = useDispatch()
  const { selectedPointId, points } = useSelector((state: RootState) => state.focusPoints)
  const { duration } = useSelector((state: RootState) => state.video)
  
  const selectedPoint = points.find(p => p.id === selectedPointId)
  
  const [editedPoint, setEditedPoint] = useState<FocusPoint | null>(null)
  
  // Initialize edit form when selected point changes
  useState(() => {
    if (selectedPoint) {
      setEditedPoint({ ...selectedPoint })
    } else {
      setEditedPoint(null)
    }
  }, [selectedPoint])
  
  if (!selectedPoint || !editedPoint) {
    return (
      <div className="bg-gray-100 p-4 rounded">
        <p className="text-gray-500 text-center">
          Select a focus point to edit its properties.
        </p>
      </div>
    )
  }
  
  const handleChange = (field: keyof FocusPoint, value: string | number) => {
    setEditedPoint(prev => {
      if (!prev) return null
      return { ...prev, [field]: value }
    })
  }
  
  const handleSave = () => {
    if (editedPoint) {
      dispatch(updateFocusPoint(editedPoint))
    }
  }
  
  const formatTimeForInput = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    const milliseconds = Math.floor((timeInSeconds % 1) * 1000)
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
  }
  
  return (
    <div className="bg-white p-4 border rounded shadow-sm">
      <h3 className="text-lg font-medium mb-4">Edit Focus Point</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input
            type="text"
            value={editedPoint.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Time</label>
            <input
              type="range"
              min={0}
              max={editedPoint.timeEnd}
              step={0.01}
              value={editedPoint.timeStart}
              onChange={(e) => handleChange('timeStart', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">
              {formatTimeForInput(editedPoint.timeStart)}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">End Time</label>
            <input
              type="range"
              min={editedPoint.timeStart}
              max={duration}
              step={0.01}
              value={editedPoint.timeEnd}
              onChange={(e) => handleChange('timeEnd', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">
              {formatTimeForInput(editedPoint.timeEnd)}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Width (%)</label>
            <input
              type="number"
              min={10}
              max={100}
              value={editedPoint.width}
              onChange={(e) => handleChange('width', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Height (%)</label>
            <input
              type="number"
              min={10}
              max={100}
              value={editedPoint.height}
              onChange={(e) => handleChange('height', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">X Position (%)</label>
            <input
              type="number"
              min={0}
              max={100 - editedPoint.width}
              value={editedPoint.x}
              onChange={(e) => handleChange('x', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Y Position (%)</label>
            <input
              type="number"
              min={0}
              max={100 - editedPoint.height}
              value={editedPoint.y}
              onChange={(e) => handleChange('y', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button onClick={handleSave} variant="primary">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}

export default KeyframeEditor
