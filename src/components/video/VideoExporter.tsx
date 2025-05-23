import React, { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import Button from '../common/Button'
import videoExportService, { ExportProgress, VideoExportService } from '../../services/VideoExportService'
import { debugLog } from "../../utils/debug"

// Available export formats
const EXPORT_FORMATS = [
  '16:9', // Landscape HD
  '9:16', // Portrait/Mobile
  '1:1',  // Square
  '4:5'   // Instagram optimal
]

const VideoExporter = () => {
  const { url, videoId } = useSelector((state: RootState) => state.video)
  const { points } = useSelector((state: RootState) => state.focusPoints)
  
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['9:16'])
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportProgress, setExportProgress] = useState<Record<string, number>>({})
  const [exportErrors, setExportErrors] = useState<Record<string, string>>({})
  const [isFFmpegLoaded, setIsFFmpegLoaded] = useState(false)
  const [useLetterboxing, setUseLetterboxing] = useState(true)
  const [isPending, setIsPending] = useState(false)
  
  // Reference to video export service
  const videoExportServiceRef = useRef<VideoExportService | null>(null);

  // Initialize on component mount
  useEffect(() => {
    const initializeExportService = async () => {
      try {
        // Create and initialize service
        const service = new VideoExportService();
        await service.initialize();
        videoExportServiceRef.current = service;
        setIsFFmpegLoaded(true);
        debugLog('Video export service initialised');
      } catch (error) {
        console.error('Failed to initialise video export service:', error);
        setExportErrors({ init: `Failed to initialise video export service: ${error}` });
      }
    };

    initializeExportService();

    // Cleanup on unmount
    return () => {
      videoExportServiceRef.current = null;
    };
  }, []);

  // Handle the export process
  useEffect(() => {
    if (!isPending) return;
    
    const exportVideos = async () => {
      if (!url || selectedFormats.length === 0) {
        setError('No video to export or no format selected. Please upload a video and select at least one format.');
        setIsPending(false);
        return;
      }
      
      debugLog('Starting export with letterboxing:', useLetterboxing);
      
      if (!videoExportServiceRef.current || !isFFmpegLoaded) {
        try {
          // Try to initialise again if not loaded
          const service = new VideoExportService();
          await service.initialize();
          videoExportServiceRef.current = service;
          setIsFFmpegLoaded(true);
          debugLog('Video export service initialised on demand');
        } catch (error) {
          console.error('Failed to initialise video export service:', error);
          setExportErrors({ init: `Failed to initialise FFmpeg: ${error}` });
          return;
        }
      }
      
      setIsExporting(true);
      setError(null);
      setExportErrors({});
      
      // Initialise progress tracking for each format
      const initialProgress: Record<string, number> = {};
      selectedFormats.forEach(format => {
        initialProgress[format] = 0;
      });
      
      setExportProgress(initialProgress);
      
      try {
        // Process formats sequentially to avoid memory issues
        for (const format of selectedFormats) {
          // Find focus point for this format and video
          const focusPoint = points.find(p => p.ratio === format && p.videoId === videoId);
          
          // Use the focus point or default to centre
          const focusX = focusPoint ? focusPoint.x : 0.5;
          const focusY = focusPoint ? focusPoint.y : 0.5;
          
          debugLog(`Exporting ${format} with focus point:`, { x: focusX, y: focusY });
          
          // Export the video
          debugLog(`Exporting ${format} with letterboxing=${useLetterboxing} (${typeof useLetterboxing})`);
          const videoUrl = await videoExportServiceRef.current.exportVideo(
            url,
            {
              ratio: format,
              focusX: focusX || 0.5,
              focusY: focusY || 0.5,
              quality: 'medium',
              letterbox: useLetterboxing === true,
            },
            (progress) => {
              setExportProgress(prev => ({
                ...prev,
                [format]: progress.progress
              }));
            }
          );
          
          // Download the exported video
          const a = document.createElement('a');
          a.href = videoUrl;
          a.download = `video-${format.replace(':', '_')}.mp4`;
          document.body.appendChild(a);
          a.click();
          
          // Clean up
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(videoUrl);
          }, 100);
          
          // Mark as complete
          setExportProgress(prev => ({
            ...prev,
            [format]: 100
          }));
        }
      } catch (err) {
        console.error('Export failed:', err);
        setError(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsExporting(false);
        setIsPending(false);
      }
    };
    
    exportVideos();
  }, [isPending, url, videoId, selectedFormats, points, useLetterboxing]);
  
  const toggleFormat = (format: string) => {
    if (selectedFormats.includes(format)) {
      setSelectedFormats(selectedFormats.filter(f => f !== format));
    } else {
      setSelectedFormats([...selectedFormats, format]);
    }
  };
  
  // Toggle letterboxing option
  const toggleLetterboxing = (value: boolean) => {
    debugLog(`Setting letterboxing to: ${value} (${typeof value})`);
    setUseLetterboxing(value);
  };
  
  // Calculate overall progress
  const calculateOverallProgress = (): number => {
    if (selectedFormats.length === 0) return 0;
    
    const totalProgress = Object.values(exportProgress).reduce((sum, progress) => sum + progress, 0);
    return Math.round(totalProgress / selectedFormats.length);
  };
  
  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h2 className="text-xl font-bold mb-4">Export Video</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {Object.values(exportErrors).length > 0 && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {Object.values(exportErrors).map((error, index) => (
            <p key={index}>{error}</p>
          ))}
        </div>
      )}
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Export Formats
        </label>
        
        <div className="space-y-2">
          {EXPORT_FORMATS.map(format => (
            <div key={format} className="flex items-center">
              <input
                type="checkbox"
                id={`format-${format}`}
                checked={selectedFormats.includes(format)}
                onChange={() => toggleFormat(format)}
                disabled={isExporting}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={`format-${format}`} className="ml-2 block text-sm text-gray-900">
                {format} {format === '9:16' ? '(Portrait/Mobile)' : format === '1:1' ? '(Square)' : format === '16:9' ? '(Landscape HD)' : '(Instagram optimal)'}
              </label>
              
              {exportProgress[format] > 0 && exportProgress[format] < 100 && (
                <div className="ml-4 flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${exportProgress[format]}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {exportProgress[format] === 100 && (
                <span className="ml-4 text-green-600 text-sm">Complete</span>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Export Style
        </label>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
          <div 
            className={`border p-3 rounded-lg cursor-pointer flex items-start ${useLetterboxing ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
            onClick={() => toggleLetterboxing(true)}
          >
            <input
              id="letterboxing-on"
              name="export-style"
              type="radio"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 mt-1"
              checked={useLetterboxing}
              onChange={() => toggleLetterboxing(true)}
            />
            <div className="ml-3">
              <label htmlFor="letterboxing-on" className="font-medium text-gray-700">
                Letterboxed
              </label>
              <p className="text-sm text-gray-500">
                Maintains entire focus area and adds black bars as needed to fit the aspect ratio.
              </p>
            </div>
          </div>
          
          <div 
            className={`border p-3 rounded-lg cursor-pointer flex items-start ${!useLetterboxing ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
            onClick={() => toggleLetterboxing(false)}
          >
            <input
              id="letterboxing-off"
              name="export-style"
              type="radio"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 mt-1"
              checked={!useLetterboxing}
              onChange={() => toggleLetterboxing(false)}
            />
            <div className="ml-3">
              <label htmlFor="letterboxing-off" className="font-medium text-gray-700">
                Cropped (No Letterboxing)
              </label>
              <p className="text-sm text-gray-500">
                Uses your focus point to crop the video to fit the aspect ratio perfectly without black bars.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {isExporting ? (
        <div>
          <div className="mb-2">
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className="bg-blue-600 h-4 rounded-full" 
                style={{ width: `${calculateOverallProgress()}%` }}
              ></div>
            </div>
          </div>
          
          <div className="text-center text-sm text-gray-500 mb-4">
            Exporting... {calculateOverallProgress()}%
          </div>
          
          <div className="mt-4">
            <Button
              disabled
              fullWidth
              size="lg"
            >
              Exporting...
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setIsPending(true)}
          disabled={selectedFormats.length === 0}
          fullWidth
          size="lg"
        >
          Export Selected Formats
        </Button>
      )}
    </div>
  )
}

export default VideoExporter

