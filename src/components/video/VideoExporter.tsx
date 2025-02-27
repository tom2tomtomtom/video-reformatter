import { useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import Button from '../common/Button'

const ASPECT_RATIOS = [
  { label: 'Instagram/TikTok Story (9:16)', value: '9:16' },
  { label: 'Instagram Feed (1:1)', value: '1:1' },
  { label: 'Instagram Feed Optimal (4:5)', value: '4:5' },
  { label: 'Original (16:9)', value: '16:9' },
]

const VideoExporter = () => {
  const { url } = useSelector((state: RootState) => state.video)
  const { points } = useSelector((state: RootState) => state.focusPoints)
  
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['9:16'])
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  
  const toggleFormat = (format: string) => {
    if (selectedFormats.includes(format)) {
      setSelectedFormats(selectedFormats.filter(f => f !== format))
    } else {
      setSelectedFormats([...selectedFormats, format])
    }
  }
  
  const handleExport = async () => {
    if (!url || selectedFormats.length === 0) return
    
    setIsExporting(true)
    setExportProgress(0)
    
    try {
      // Simulate export process
      for (let i = 1; i <= 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500))
        setExportProgress(i * 10)
      }
      
      // In a real implementation, we would use FFmpeg here to process the video
      // based on the selected formats and focus points
      
      alert('Export completed! In a real implementation, files would be downloaded.')
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Export Video</h2>
      
      {!url ? (
        <p className="text-gray-500">Please load a video before exporting.</p>
      ) : (
        <>
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Select Export Formats</h3>
            <div className="space-y-2">
              {ASPECT_RATIOS.map(ratio => (
                <label key={ratio.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedFormats.includes(ratio.value)}
                    onChange={() => toggleFormat(ratio.value)}
                    className="mr-2 h-5 w-5"
                  />
                  {ratio.label}
                </label>
              ))}
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Focus Points</h3>
            {points.length === 0 ? (
              <p className="text-yellow-600">No focus points defined. Export will use center cropping.</p>
            ) : (
              <p className="text-green-600">{points.length} focus points will be used for intelligent framing.</p>
            )}
          </div>
          
          {isExporting ? (
            <div className="mb-4">
              <div className="h-2 bg-gray-200 rounded overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <p className="text-sm text-center mt-2">Exporting... {exportProgress}%</p>
            </div>
          ) : (
            <Button
              onClick={handleExport}
              disabled={selectedFormats.length === 0}
              fullWidth
              size="lg"
            >
              Export Selected Formats
            </Button>
          )}
        </>
      )}
    </div>
  )
}

export default VideoExporter
