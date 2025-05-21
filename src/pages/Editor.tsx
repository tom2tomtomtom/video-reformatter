import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { RootState, store } from '../store'
import { ClipSegment } from '../services/ClipDetectionService'
import { setCurrentTime } from '../store/slices/videoSlice'
import { startScan, stopScan, updateProgress, scanComplete } from '../store/slices/videoScanSlice'
import VideoPlayer from '../components/video/VideoPlayer'
import VideoTimeline from '../components/video/VideoTimeline'
import { FocusSelector, ScanReviewPanel } from '../components/editor'
import AspectRatioPreview from '../components/video/AspectRatioPreview'
import ScanConfigPanel from '../components/editor/ScanConfigPanel'
import Button from '../components/common/Button'
import { videoScannerService, thumbnailService } from '../services'

const Editor = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const { url, videoId } = useSelector((state: RootState) => state.video)
  const { clipBatch } = useSelector((state: RootState) => state.clips)
  
  // State for managing batch and clip selection
  const [currentBatch, setCurrentBatch] = useState<any>(null)
  const [currentClipIndex, setCurrentClipIndex] = useState(0)
  const [clips, setClips] = useState<ClipSegment[]>([])
  
  // Video element reference for scanning
  const videoRef = useRef<HTMLVideoElement | null>(null)
  
  // Scanning state
  const { isScanning, isReviewMode, progress, scanOptions } = useSelector(
    (state: RootState) => state.videoScan
  )
  
  // Get batch ID from URL query parameters
  const queryParams = new URLSearchParams(location.search)
  const batchId = queryParams.get('batchId')
  
  // Set the video element reference
  const setVideoElement = useCallback((element: HTMLVideoElement | null) => {
    if (element && clips.length > 0 && clips[currentClipIndex]) {
      const startTime = clips[currentClipIndex].startTime;
      // Force the video to the start position when first set
      element.currentTime = startTime;
      console.log(`Editor: Set video element to clip start time: ${startTime}s`);
      // Also update the Redux store
      dispatch(setCurrentTime(startTime));
      
      // Add event handler for when video is ready
      const handleCanPlay = () => {
        // Double-check position when the video is actually ready to play
        if (Math.abs(element.currentTime - startTime) > 0.5) {
          console.log(`Editor: Correcting clip position to ${startTime}s (was at ${element.currentTime}s)`);
          element.currentTime = startTime;
          dispatch(setCurrentTime(startTime));
        }
        element.removeEventListener('canplay', handleCanPlay);
      };
      
      element.addEventListener('canplay', handleCanPlay);
    }
    
    videoRef.current = element;
  }, [clips, currentClipIndex, dispatch]);
  
  // Fetch batch data when component mounts or batchId changes
  useEffect(() => {
    if (!batchId) {
      console.error('No batch ID provided');
      const redirectTimer = setTimeout(() => {
        navigate('/');
      }, 2000);
      
      return () => clearTimeout(redirectTimer);
    }
    
    if (clipBatch) {
      console.log('Loading batch:', batchId);
      const batch = clipBatch.find(batch => batch.id === batchId);
      
      if (!batch) {
        console.error('Batch not found:', batchId);
        navigate('/');
        return;
      }
      
      const needsThumbnails = batch.clips.some(clip => !clip.thumbnail);
      if (needsThumbnails) {
        console.log('Generating missing thumbnails');
        // Generate thumbnails if needed
        batch.clips.forEach(clip => {
          if (!clip.thumbnail) {
            thumbnailService.generateThumbnail(clip, url);
          }
        });
      }
      
      setCurrentBatch(batch);
      setClips(batch.clips);
      console.log('Batch loaded with', batch.clips.length, 'clips');
    }
  }, [batchId, clipBatch, navigate, url]);
  
  // Initialize video scanner service when component mounts
  useEffect(() => {
    // Initialize video scanner when video ref is available
    if (videoRef.current) {
      console.log('Initializing video scanner service');
      videoScannerService.initialize(videoRef.current);
    }
  }, [videoRef]);
  
  // Effect to handle video positioning when current clip changes
  useEffect(() => {
    if (videoRef.current && clips && clips.length > 0 && clips[currentClipIndex]) {
      const clipStartTime = clips[currentClipIndex].startTime;
      
      // Update video position and Redux store
      videoRef.current.currentTime = clipStartTime;
      dispatch(setCurrentTime(clipStartTime));
      
      console.log(`Editor useEffect: Updated video position to ${clipStartTime}s for clip ${currentClipIndex + 1}`);
    }
  }, [currentClipIndex, clips, dispatch]);
  
  // Go to a specific clip by index
  const goToClip = (index: number) => {
    if (index >= 0 && index < clips.length) {
      console.log(`Navigating to clip ${index + 1}`);
      const clip = clips[index];
      
      setCurrentClipIndex(index);
      
      console.log(`Selected clip with trim points: ${clip.startTime}s - ${clip.endTime}s`);
    }
  };
  
  // Navigate to next clip
  const nextClip = () => {
    if (currentClipIndex < clips.length - 1) {
      goToClip(currentClipIndex + 1);
    }
  };
  
  // Navigate to previous clip
  const prevClip = () => {
    if (currentClipIndex > 0) {
      goToClip(currentClipIndex - 1);
    }
  };
  
  // Start object detection process
  const startObjectDetection = async () => {
    if (!videoRef.current) {
      console.error('Video element not available');
      return;
    }
    
    console.log('Starting object detection process...');
    
    try {
      // Set initial states to prepare for scanning
      console.log('Preparing for object detection scan');
      
      // Get the current clip
      const currentClip = clips[currentClipIndex];
      if (!currentClip) {
        console.error('No current clip to scan');
        return;
      }
      
      const clipDuration = videoRef.current.duration || (currentClip.endTime - currentClip.startTime);
      console.log('Clip duration for scanning:', clipDuration, 'seconds');
      
      // Initialize scanner with video element - await the initialization to ensure it's ready
      console.log('Initializing video scanner with current video element');
      await videoScannerService.initialize(videoRef.current);
      
      // Start scanning - this updates the UI to show scanning state
      dispatch(startScan());
      
      // Use a simple approach - just start scanning from wherever the video currently is
      console.log('Starting video scan with duration:', clipDuration);
      
      // Simple scan options that focus on reliability
      const simpleScanOptions = {
        interval: 1.0, // Scan every second - more reliable
        minDetections: 1, // Only need to detect objects once
        minScore: 0.40, // Slightly higher threshold for better quality detections
        clipSegments: [currentClip],
        onProgress: (scanProgress) => {
          dispatch(updateProgress(scanProgress));
        }
      };
      
      // Start scanning process
      console.log('Starting scan with options:', simpleScanOptions);
      const detectedSubjects = await videoScannerService.scanVideo(
        clipDuration,
        simpleScanOptions
      );
      
      console.log('Scan completed. Found', detectedSubjects.length, 'subjects');
      
      // Scan complete - transition to review mode without page navigation
      dispatch(scanComplete(detectedSubjects));
      
    } catch (error) {
      console.error('Error during scanning:', error);
      dispatch(stopScan());
      
      // More informative error handling that doesn't rely on popups
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Scan error details:', errorMessage);
    }
  };
  
  // Handle click on finish review button
  const handleFinishReview = () => {
    // Clean up any scanning state
    console.log('Exiting review mode and finishing object selection');
    
    // Get the selected focus points from the redux store
    const focusPoints = store.getState().focusPoints.points;
    console.log('Selected focus points:', focusPoints);
    
    // We want to delay the refresh to ensure that state updates 
    // have been processed before rendering changes
    setTimeout(() => {
      // Schedule a clip refresh after a short delay
      // This ensures we have fresh IDs and thumbnails for clips after focus points are selected
      setTimeout(() => {
        if (clips) {
          // Force clip refresh with updated data
          const refreshedClips = clips.map(clip => ({
            ...clip,
            // Generate new ID to ensure components fully reset
            id: `${clip.id}_refreshed_${Date.now()}`,
            // Ensure thumbnails are properly prepared
            thumbnail: clip.thumbnail || thumbnailService.getPlaceholderThumbnail()
          }));
          
          // Update the clips with the refreshed data
          setClips(refreshedClips);
          console.log('Clips fully refreshed with focus points');
        }
      }, 200);
    }, 300);
  }

  return (
    <div className="container mx-auto px-4 py-8 overflow-y-auto max-h-screen">
      <div className="max-w-6xl mx-auto pb-16">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Object Detector</h1>
            <p className="text-gray-600 text-sm mt-1">Step 3: Trim clips and detect objects</p>
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
          </div>
        )}
        
        {/* Main editor area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: Video player */}
          <div className="lg:col-span-2">
            <div className="sticky top-4">
              {clips.length > 0 && currentClipIndex < clips.length ? (
                <VideoPlayer
                  key={`player-${currentClipIndex}-${clips[currentClipIndex]?.id || 'no-id'}`}
                  videoUrl={url}
                  clipToPlay={clips[currentClipIndex]}
                  onSetVideoElement={setVideoElement}
                  onStartObjectDetection={startObjectDetection}
                  autoStartScan={false}
                />
              ) : (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">No clips available</p>
                </div>
              )}
              
              {/* Timeline showing trim points */}
              {clips.length > 0 && clips[currentClipIndex] && (
                <VideoTimeline 
                  clipSegment={clips[currentClipIndex]} 
                />
              )}
            </div>
          </div>
          
          {/* Right column: Configuration and controls */}
          <div className="lg:col-span-1">
            {/* Show scanning status when active */}
            {isScanning && (
              <div className="bg-blue-50 p-6 rounded-lg mb-6">
                <h2 className="text-xl font-bold text-blue-800 mb-2">
                  Scanning Video...
                </h2>
                <div className="relative pt-1">
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                    <div 
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500" 
                      style={{ width: `${progress.percentComplete}%` }}
                    ></div>
                  </div>
                  <p className="text-blue-800">
                    {progress.percentComplete.toFixed(1)}% complete
                  </p>
                </div>
                <p className="text-blue-600 mt-2">
                  Please wait while we analyze the video frame by frame.
                </p>
              </div>
            )}
            
            {/* Review panel for after scanning */}
            {isReviewMode && (
              <ScanReviewPanel 
                onFinishReview={handleFinishReview}
              />
            )}
            
            {/* Focus selector and object detection */}
            <div className="relative z-30 mb-6">
              <FocusSelector videoRef={videoRef} onStartObjectDetection={startObjectDetection} />
            </div>
            
            {/* Aspect ratio preview */}
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4">Aspect Ratio Preview</h3>
              <div className="space-y-4">
                <AspectRatioPreview ratio="9:16" width={200} />
                <AspectRatioPreview ratio="4:5" width={200} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Editor
