import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { 
  addFocusPoint, 
  removeFocusPoint, 
  updateFocusPoint 
} from '../../store/slices/focusPointsSlice';
import Button from "../common/Button";
import subjectDetectionService from "../../services/SubjectDetectionService";
import VideoScannerService from "../../services/VideoScannerService";
import {
  startScan,
  stopScan,
  updateProgress,
  scanComplete,
  updateScanOptions,
  exitReviewMode
} from '../../store/slices/videoScanSlice';
import ProgressIndicator from '../common/ProgressIndicator';
import ScanConfigPanel from './ScanConfigPanel';
import ScanReviewPanel from './ScanReviewPanel';

const FocusSelector: React.FC = () => {
  const dispatch = useDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  
  const { url, currentTime, isPlaying, duration } = useSelector((state: RootState) => state.video);
  const { 
    isScanning, 
    progress, 
    detectedSubjects, 
    isReviewMode, 
    scanOptions 
  } = useSelector((state: RootState) => state.videoScan);

  // Added reset function to unstick any problematic states
  const resetStates = () => {
    setIsDetecting(false);
    setDetectError(null);
    dispatch(stopScan());
  };
  
  // Get a reference to the video element
  useEffect(() => {
    // Reset error when URL changes
    setDetectError(null);
    
    // Find the video element on the page
    const findVideoElement = () => {
      // Try to find the video element by checking all video tags on the page
      const videoElements = document.querySelectorAll('video');
      console.log('Found video elements:', videoElements.length);
      
      if (videoElements.length > 0) {
        videoRef.current = videoElements[0];
        console.log('Video element found:', videoRef.current);
        
        // Reset review mode if it's stuck
        if (isReviewMode && detectedSubjects.length === 0) {
          console.log('Review mode was active but no subjects detected - resetting state');
          dispatch(exitReviewMode());
        }
      } else {
        console.warn('No video element found on the page');
        videoRef.current = null;
      }
    };
    
    // Try immediately and then retry after a delay to ensure the player has mounted
    findVideoElement();
    const timerId = setTimeout(findVideoElement, 1000);
    
    return () => {
      clearTimeout(timerId);
    };
  }, [url, dispatch, isReviewMode, detectedSubjects.length]);

  // Reset any stuck states when component mounts
  useEffect(() => {
    // If we're in review mode with no subjects, reset the state
    if (isReviewMode && detectedSubjects.length === 0) {
      dispatch(exitReviewMode());
    }
    
    // If scanning is stuck, reset it
    if (isScanning && progress.percentComplete === 0 && progress.elapsedTime > 10) {
      dispatch(stopScan());
    }
    
    // Clean up when component unmounts
    return () => {
      if (isScanning) {
        dispatch(stopScan());
      }
    };
  }, [dispatch, isReviewMode, detectedSubjects.length, isScanning, progress]);

  // Function to detect subjects in the current frame
  const detectSubjects = async () => {
    // Check if the video is loaded
    if (!url) {
      setDetectError('No video loaded. Please upload a video first.');
      return;
    }
    
    // Re-attempt to find the video element if it's not currently available
    if (!videoRef.current) {
      const videoElements = document.querySelectorAll('video');
      if (videoElements.length > 0) {
        videoRef.current = videoElements[0];
      } else {
        setDetectError('Video element not found. Please reload the page.');
        return;
      }
    }
    
    if (!videoRef.current || !canvasRef.current) {
      setDetectError('Video not loaded or properly initialized');
      return;
    }
    
    try {
      setIsDetecting(true);
      setDetectError(null);
      
      // Load model if needed
      await subjectDetectionService.loadModel();
      
      // Capture the current frame to canvas
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        setDetectError('Could not get canvas context');
        return;
      }
      
      // Draw current frame to canvas
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      // Detect objects in canvas
      const detectionResult = await subjectDetectionService.detectObjects(canvas);
      
      if (detectionResult.error) {
        setDetectError(`Detection error: ${detectionResult.error}`);
        return;
      }
      
      // Add detected objects as focus points
      detectionResult.objects.forEach(obj => {
        const { bbox, class: className, score } = obj;
        
        // Only add objects with score higher than 0.5
        if (score >= 0.5) {
          const [x, y, width, height] = bbox;
          
          // Create a new focus point
          dispatch(addFocusPoint({
            id: `${className}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timeStart: Math.max(0, currentTime - 0.5), // Start 0.5s before current time
            timeEnd: Math.min(duration, currentTime + 1.5), // End 1.5s after current time
            x: x + width / 2, // Center X
            y: y + height / 2, // Center Y
            width,
            height,
            description: className
          }));
        }
      });
      
      if (detectionResult.objects.length === 0) {
        setDetectError('No objects detected in this frame.');
      }
    } catch (error) {
      console.error('Error detecting subjects:', error);
      setDetectError('Error detecting subjects: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsDetecting(false);
    }
  };
  
  // Function to start scanning the entire video
  const startVideoScan = async () => {
    // Reset any errors
    setDetectError(null);
    
    // Check if the video is loaded
    if (!url) {
      setDetectError('No video loaded. Please upload a video first.');
      return;
    }
    
    // Re-attempt to find the video element if it's not currently available
    if (!videoRef.current) {
      const videoElements = document.querySelectorAll('video');
      if (videoElements.length > 0) {
        videoRef.current = videoElements[0];
        console.log('Found video element for scanning:', videoRef.current);
      } else {
        setDetectError('Video element not found. Please reload the page.');
        return;
      }
    }
    
    if (!videoRef.current) {
      setDetectError('Video not loaded or properly initialized');
      return;
    }
    
    const wasPlaying = !videoRef.current.paused;
    if (wasPlaying) {
      videoRef.current.pause();
    }
    
    try {
      dispatch(startScan());
      
      const videoScanner = new VideoScannerService();
      console.log('Initializing scanner with video element:', videoRef.current);
      videoScanner.initialize(videoRef.current);
      
      console.log('Starting video scan with duration:', duration);
      const subjects = await videoScanner.scanVideo(duration, {
        interval: scanOptions.interval,
        minScore: scanOptions.minScore,
        similarityThreshold: scanOptions.similarityThreshold,
        minDetections: scanOptions.minDetections,
        onProgress: (progress) => {
          dispatch(updateProgress(progress));
        }
      });
      
      console.log('Scan complete, detected subjects:', subjects);
      dispatch(scanComplete(subjects));
    } catch (error) {
      console.error('Error scanning video:', error);
      dispatch(stopScan());
      setDetectError('Error scanning video: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      // Restore previous playback state
      if (wasPlaying && videoRef.current) {
        videoRef.current.play();
      }
    }
  };
  
  // Function to stop an ongoing scan
  const stopVideoScan = () => {
    dispatch(stopScan());
  };
  
  // Function called when scan review is finalized
  const handleScanFinalized = () => {
    dispatch(exitReviewMode());
  };
  
  // Create a hidden canvas for frame capture
  return (
    <div className="mb-4 p-4 border border-gray-300 rounded">
      <h3 className="text-lg font-medium mb-2">Focus Points</h3>
      
      {/* Canvas for frame capture (hidden) */}
      <canvas 
        ref={canvasRef} 
        className="hidden"
      />
      
      {/* Subject detection controls */}
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <Button
            onClick={detectSubjects}
            disabled={isDetecting || isScanning}
            className="px-4 py-2 bg-blue-600 text-white rounded-md relative z-10"
          >
            {isDetecting ? 'Detecting...' : 'Detect Subjects'}
          </Button>
          
          {isScanning ? (
            <Button
              onClick={stopVideoScan}
              className="px-4 py-2 bg-red-600 text-white rounded-md relative z-10"
            >
              Stop Scanning
            </Button>
          ) : (
            <Button
              onClick={startVideoScan}
              disabled={isDetecting} 
              className="px-4 py-2 bg-green-600 text-white rounded-md relative z-10"
            >
              Scan Entire Video
            </Button>
          )}
        </div>
        
        {detectError && (
          <div className="text-red-500 text-sm mb-2">
            {detectError}
          </div>
        )}
        
        {isReviewMode && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Available Focus Points: {detectedSubjects.length || 0}
            </label>
          </div>
        )}
        
        {/* Scanning configuration */}
        {!isScanning && !isReviewMode && (
          <ScanConfigPanel />
        )}
      </div>
      
      {/* Scan progress indicator */}
      {isScanning && (
        <div className="mb-4">
          <ProgressIndicator
            percentComplete={progress.percentComplete}
            currentFrame={progress.currentFrame}
            totalFrames={progress.totalFrames}
            elapsedTime={progress.elapsedTime}
            estimatedTimeRemaining={progress.estimatedTimeRemaining}
          />
        </div>
      )}
      
      {/* Results review panel */}
      {isReviewMode && (
        <div className="mb-4">
          <ScanReviewPanel
            videoElement={videoRef.current}
            onFinalize={handleScanFinalized}
          />
        </div>
      )}
      
      {/* Instructions */}
      <div className="text-sm text-gray-600 mt-2">
        <p>
          Click "Detect Subjects" to find subjects in the current frame, or
          "Scan Entire Video" to automatically detect subjects throughout the video.
        </p>
      </div>
    </div>
  );
};

export default FocusSelector;
