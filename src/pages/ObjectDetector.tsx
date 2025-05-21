import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { RootState } from '../store'
import { ClipSegment } from '../services/ClipDetectionService'
import { setCurrentTime } from '../store/slices/videoSlice'
import Button from '../components/common/Button'
import AspectRatioPreview from '../components/video/AspectRatioPreview'
import ClipPreview from '../components/clips/ClipPreview'

// Configuration panel for object detection
const ScanConfigPanel: React.FC = () => {
  const [interval, setInterval] = useState(1.0);
  const [minScore, setMinScore] = useState(0.5);
  const [minDetections, setMinDetections] = useState(2);
  
  // Handle changes to scan interval
  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      setInterval(value);
    }
  };
  
  // Handle changes to minimum score threshold
  const handleMinScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 1) {
      setMinScore(value);
    }
  };
  
  // Handle changes to minimum detections
  const handleMinDetectionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      setMinDetections(value);
    }
  };
  
  return (
    <div className="bg-gray-50 p-3 rounded-md border mb-4">
      <h4 className="text-sm font-medium text-gray-800 mb-2">
        Object Detection Configuration
      </h4>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="interval" className="block text-xs text-gray-600 mb-1">
            Sampling Interval (seconds)
          </label>
          <input
            id="interval"
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={interval}
            onChange={handleIntervalChange}
            className="w-full p-2 text-sm border rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">
            Time between sampled frames (smaller = more accurate, slower)
          </p>
        </div>
        
        <div>
          <label htmlFor="minScore" className="block text-xs text-gray-600 mb-1">
            Minimum Confidence Score (0-1)
          </label>
          <input
            id="minScore"
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={minScore}
            onChange={handleMinScoreChange}
            className="w-full p-2 text-sm border rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">
            Minimum confidence for object detection
          </p>
        </div>
        
        <div>
          <label htmlFor="minDetections" className="block text-xs text-gray-600 mb-1">
            Minimum Detections
          </label>
          <input
            id="minDetections"
            type="number"
            min="1"
            max="20"
            step="1"
            value={minDetections}
            onChange={handleMinDetectionsChange}
            className="w-full p-2 text-sm border rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">
            Minimum number of frames an object must appear in
          </p>
        </div>
      </div>
    </div>
  );
};

const ObjectDetector = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const { url } = useSelector((state: RootState) => state.video)
  const { clipBatch } = useSelector((state: RootState) => state.clips)
  
  // State for scanning
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, percent: 0 })
  const [detectedObjects, setDetectedObjects] = useState<Array<{
    id: string;
    class: string;
    positions: { time: number; bbox: number[]; score: number; }[];
  }>>([])
    
  // State for managing batch and clip selection
  const [currentBatch, setCurrentBatch] = useState<any>(null)
  const [currentClipIndex, setCurrentClipIndex] = useState(0)
  const [clips, setClips] = useState<ClipSegment[]>([])
  
  // Get batch ID from URL query parameters
  const queryParams = new URLSearchParams(location.search)
  const batchId = queryParams.get('batchId')
  
  // Redirect to home if no video URL is available
  // Explicitly prevent default browser loading indicator
  useEffect(() => {
    // Add a style to hide any loading spinners site-wide
    const style = document.createElement('style');
    style.innerHTML = `
      body.loading-disabled * {
        -webkit-animation: none !important;
        animation: none !important;
      }
    `;
    document.head.appendChild(style);
    document.body.classList.add('loading-disabled');
    
    return () => {
      document.body.classList.remove('loading-disabled');
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (!url) {
      // Redirect to home if no video is loaded
      const redirectTimer = setTimeout(() => {
        navigate('/')
      }, 500)
      
      return () => clearTimeout(redirectTimer)
    }
    
    // Find the batch that matches the batchId
    if (batchId && clipBatch && clipBatch.length > 0) {
      const batch = clipBatch.find(batch => batch.id === batchId)
      if (batch) {
        setCurrentBatch(batch)
        setClips(batch.clips)
        
        // If we have clips, go to the first one's start time
        if (batch.clips.length > 0 && batch.clips[0].startTime) {
          dispatch(setCurrentTime(batch.clips[0].startTime))
        }
        
        console.log('Found batch with', batch.clips.length, 'clips')
      } else {
        console.warn('Could not find batch with ID:', batchId)
      }
    }
  }, [url, navigate, batchId, clipBatch, dispatch])
  
  if (!url) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-6">No Video Loaded</h1>
        <p className="text-gray-600 mb-6">Please upload a video to begin object detection.</p>
        <div className="animate-pulse">
          <p className="text-sm text-gray-500 mb-4">Redirecting to upload page...</p>
        </div>
        <Button onClick={() => navigate('/')} variant="primary">
          Go to Upload
        </Button>
      </div>
    )
  }
  
  // Function to navigate to a specific clip
  const goToClip = (index: number) => {
    if (index >= 0 && index < clips.length) {
      setCurrentClipIndex(index)
      const clip = clips[index]
      dispatch(setCurrentTime(clip.startTime))
    }
  }
  
  // Go to the next clip
  const nextClip = () => {
    goToClip(currentClipIndex + 1)
  }
  
  // Go to the previous clip
  const prevClip = () => {
    goToClip(currentClipIndex - 1)
  }
  
  // Start the scanning process using our real scanning services
  const startScanning = useCallback(async () => {
    try {
      console.log('Starting real object detection with our services');
      setIsScanning(true);
      setDetectedObjects([]);
      setScanProgress({ current: 0, total: 100, percent: 0 });
      
      // Import the video scanner service
      const { videoScannerService } = await import('../services/VideoScannerService');
      
      // Get the current video element
      const videoElement = document.querySelector('video') as HTMLVideoElement;
      if (!videoElement) {
        throw new Error('No video element found for scanning');
      }
      
      // Initialize video scanner
      await videoScannerService.initialize(videoElement);
      
      // Get current clip details
      const currentClip = clips[currentClipIndex];
      const duration = currentClip.endTime - currentClip.startTime;
      
      // Set up scan options with progress tracking
      const scanOptions = {
        interval: 1.0, // Scan every second
        minScore: 0.3, // Lower threshold for better detection
        clipSegments: [currentClip],
        onProgress: (progress: any) => {
          setScanProgress({ 
            current: progress.currentFrame, 
            total: progress.totalFrames, 
            percent: progress.percentComplete 
          });
        }
      };
      
      // Start actual scanning
      console.log('Scanning video with duration:', duration);
      const detectedSubjects = await videoScannerService.scanVideo(duration, scanOptions);
      
      // Update with real detection results
      console.log('Scan complete, found subjects:', detectedSubjects);
      setDetectedObjects(detectedSubjects);
    } catch (error) {
      console.error('Error during object detection:', error);
    } finally {
      setIsScanning(false);
    }
  }, [clips, currentClipIndex]);

  return (
    <div className="container mx-auto px-4 py-8 overflow-y-auto max-h-screen">
      <div className="max-w-6xl mx-auto pb-16">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Object Detector</h1>
            <p className="text-gray-600 text-sm mt-1">Step 4: Detect and track objects in your clips before exporting</p>
          </div>
          {currentBatch && (
            <div className="bg-blue-50 px-4 py-2 rounded-lg">
              <p className="text-blue-800 font-medium">Processing batch: {currentBatch.name}</p>
            </div>
          )}
        </div>
        
        {/* Clip navigation */}
        {clips.length > 0 && (
          <div className="mb-6 bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-medium">Clips ({currentClipIndex + 1} of {clips.length})</h2>
              <div className="flex space-x-2">
                <Button 
                  onClick={prevClip} 
                  disabled={currentClipIndex === 0}
                  variant="secondary"
                  size="sm"
                >
                  Previous Clip
                </Button>
                <Button 
                  onClick={nextClip} 
                  disabled={currentClipIndex === clips.length - 1}
                  variant="secondary"
                  size="sm"
                >
                  Next Clip
                </Button>
              </div>
            </div>
            
            {/* Clip thumbnails */}
            <div className="flex overflow-x-auto space-x-2 pb-2">
              {clips.map((clip, index) => (
                <div 
                  key={clip.id} 
                  onClick={() => goToClip(index)}
                  className={`flex-shrink-0 cursor-pointer p-1 rounded ${index === currentClipIndex ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-gray-100'}`}
                >
                  <div className="w-24 h-16 bg-gray-200 flex items-center justify-center rounded overflow-hidden">
                    {clip.thumbnail ? (
                      <img src={clip.thumbnail} alt={`Clip ${index + 1}`} className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-xs text-gray-500">Clip {index + 1}</span>
                    )}
                  </div>
                  <p className="text-xs mt-1 truncate w-24 text-center">{clip.name || `Clip ${clip.startTime.toFixed(1)}-${clip.endTime.toFixed(1)}`}</p>
                </div>
              ))}
            </div>
            
            {/* Current clip info */}
            {clips[currentClipIndex] && (
              <div className="mt-3 bg-white p-3 rounded-md shadow-sm">
                <p className="text-sm text-gray-600">Current Clip: <span className="font-medium text-gray-800">{clips[currentClipIndex].name || `Clip ${currentClipIndex + 1}`}</span></p>
                <p className="text-xs text-gray-500">Time Range: {clips[currentClipIndex].startTime.toFixed(2)}s - {clips[currentClipIndex].endTime.toFixed(2)}s</p>
              </div>
            )}
          </div>
        )}
        
        {/* Scan configuration */}
        {!isScanning && <ScanConfigPanel />}
        
        {/* Scan status */}
        {!isScanning ? (
          <div className="mb-6 flex justify-center">
            <div className="text-center p-3 rounded-md bg-blue-50 text-blue-800">
              <p className="font-medium">Detection starts automatically when the clip is ready</p>
              <p className="text-sm text-blue-600 mt-1">Please wait a moment...</p>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-blue-700 font-medium">Scanning in progress...</span>
                <span className="text-blue-600">{Math.round(scanProgress.percent)}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                  style={{ width: `${scanProgress.percent}%` }}
                ></div>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Processed {scanProgress.current} of {scanProgress.total} frames
              </p>
              {detectedObjects.length > 0 && (
                <p className="text-sm text-blue-800 mt-2 font-medium">
                  {detectedObjects.length} objects detected so far
                </p>
              )}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          <div className="lg:col-span-2 relative">
            {/* Clip tabs */}
            <div className="mb-4 border-b">
              <div className="flex overflow-x-auto">
                {clips.map((clip, index) => (
                  <button
                    key={clip.id}
                    onClick={() => goToClip(index)}
                    className={`px-4 py-2 whitespace-nowrap ${currentClipIndex === index 
                      ? 'border-b-2 border-blue-500 text-blue-600 font-medium' 
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
                  >
                    Clip {index + 1}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="relative z-10">
              {clips.length > 0 && currentClipIndex < clips.length && (
                <ClipPreview
                  clip={clips[currentClipIndex]}
                  videoUrl={url}
                  autoPlay={true}
                  muted={true}
                  controls={true}
                  loop={true}
                />
              )}
            </div>
          </div>
          
          <div className="relative z-10">
            <h2 className="text-xl font-semibold mb-4">Format Preview</h2>
            <div className="space-y-6">
              <AspectRatioPreview ratio="9:16" width={240} />
              <AspectRatioPreview ratio="1:1" width={240} />
              <AspectRatioPreview ratio="4:5" width={240} />
            </div>
            
            <div className="mt-8">
              <Button 
                onClick={() => navigate('/export', { state: { clips, batch: currentBatch } })} 
                variant="primary"
                size="lg"
                fullWidth
              >
                Continue to Export
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ObjectDetector
