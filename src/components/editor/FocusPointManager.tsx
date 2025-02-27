import { useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import FocusSelector from './FocusSelector'
import KeyframeEditor from './KeyframeEditor'
import { FocusPoint } from '../../store/slices/focusPointsSlice'

const FocusPointManager = () => {
  const { points, selectedPointId } = useSelector((state: RootState) => state.focusPoints)
  const [editingPoint, setEditingPoint] = useState<FocusPoint | null>(null)
  
  // Find the selected focus point
  const selectedPoint = selectedPointId 
    ? points.find(p => p.id === selectedPointId) 
    : null
  
  // Handle editing a focus point
  const handleEditPoint = (point: FocusPoint) => {
    setEditingPoint(point)
  }
  
  // Close the editor
  const handleCloseEditor = () => {
    setEditingPoint(null)
  }
  
  return (
    <div>
      {editingPoint ? (
        <KeyframeEditor 
          focusPoint={editingPoint} 
          onClose={handleCloseEditor} 
        />
      ) : (
        <FocusSelector />
      )}
      
      {/* Focus point list */}
      {points.length > 0 && !editingPoint && (
        <div className="mt-6 bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium mb-3">Defined Focus Points</h3>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {points.map(point => (
              <div 
                key={point.id}
                className={`p-3 rounded border cursor-pointer transition-colors ${
                  selectedPointId === point.id
                    ? 'bg-blue-50 border-blue-300'
                    : 'hover:bg-gray-50 border-gray-200'
                }`}
                onClick={() => handleEditPoint(point)}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{point.description}</span>
                  <span className="text-sm text-gray-500">
                    {Math.floor(point.timeStart / 60)}:{Math.floor(point.timeStart % 60).toString().padStart(2, '0')} - 
                    {Math.floor(point.timeEnd / 60)}:{Math.floor(point.timeEnd % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FocusPointManager