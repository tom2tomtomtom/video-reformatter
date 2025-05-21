import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { addFocusPoint } from '../../store/slices/focusPointsSlice';
import Button from "../common/Button";
import {
  videoScannerService,
  subjectDetectionService
} from "../../services";
import {
  startScan,
  stopScan,
  updateProgress,
  scanComplete,
  exitReviewMode
} from '../../store/slices/videoScanSlice';
import ProgressIndicator from '../common/ProgressIndicator';

interface FocusSelectorProps {
  videoRef?: React.RefObject<HTMLVideoElement>;
  onStartObjectDetection?: () => void;
}

/**
 * FocusSelector component provides video scanning functionality to detect subjects
 * in the video that can be used as focus points for video reformatting.
 */
const FocusSelector: React.FC<FocusSelectorProps> = ({ videoRef: externalVideoRef, onStartObjectDetection }) => {
  const dispatch = useDispatch();
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const scanAttemptRef = useRef<number>(0);
  
  // Use external videoRef if provided, otherwise use internal
  const videoRef = externalVideoRef || internalVideoRef;
  
  // Local state
  const [error, setError] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  
  // Redux state
  const { url, duration, currentTime } = useSelector((state: RootState) => state.video);
  const { isScanning, progress, detectedSubjects, isReviewMode } = useSelector(
    (state: RootState) => state.videoScan
  );
  const { activeClip } = useSelector((state: RootState) => state.clips);
  
  // Reset errors
  const resetError = () => {
    setError(null);
  };
  
  // Find and monitor the video element
  useEffect(() => {
    // Clear error when URL changes
    resetError();
    
    // If we have an external videoRef, use that and trust it's ready
    if (externalVideoRef && externalVideoRef.current) {
      setIsVideoReady(true);
      console.log('Using external video reference');
      return () => {}; // No cleanup needed
    }
    
    const findVideoElement = () => {
      const videoElements = document.querySelectorAll('video');
      
      if (videoElements.length > 0) {
        const video = videoElements[0];
        internalVideoRef.current = video;
        
        // Check if video is actually ready
        const isReady = video.readyState >= 2;
        
        // Only update state and log if there's a change
        if (isReady !== isVideoReady) {
          setIsVideoReady(isReady);
          
          if (isReady) {
            console.log('Video element ready. Dimensions:', video.videoWidth, 'x', video.videoHeight);
          } else {
            console.log('Video element found but not ready yet. readyState:', video.readyState);
          }
        }
      } else {
        console.log('No video element found');
        internalVideoRef.current = null;
        setIsVideoReady(false);
      }
    };
    
    // Try to find video initially
    findVideoElement();
    
    // Set up interval to periodically check for video element
    const checkInterval = setInterval(() => {
      findVideoElement();
    }, 1000);
    
    // Cleanup interval on unmount
    return () => {
      clearInterval(checkInterval);
      
      // Also clean up any active scanning
      if (isScanning) {
        dispatch(stopScan());
      }
    };
  }, [dispatch, url, isScanning, externalVideoRef]);
  
  // Get the current clip for scanning
  const getCurrentClip = () => {
    if (!activeClip) return null;
    
    return {
      startTime: activeClip.startTime,
      endTime: activeClip.endTime
    };
  };
  
  // Function to scan the video for subjects
  const scanVideo = async () => {
    // If we have an external handler, use it
    if (onStartObjectDetection) {
      onStartObjectDetection();
      return;
    }
    // Reset any previous error
    resetError();
    
    // Check if video is available
    if (!videoRef.current) {
      setError('Video element not found. Please try reloading the page.');
      return;
    }
    
    if (!url) {
      setError('No video loaded.');
      return;
    }
    
    // Track this attempt
    scanAttemptRef.current += 1;
    const currentAttempt = scanAttemptRef.current;
    
    // Remember playback state to restore later
    const video = videoRef.current;
    const wasPlaying = !video.paused;
    if (wasPlaying) {
      video.pause();
    }
    
    try {
      // Start scanning process
      dispatch(startScan());
      
      // Try to load the detection model first
      try {
        await subjectDetectionService.loadModel();
        console.log('Detection model loaded successfully');
      } catch (modelError) {
        console.error('Failed to load detection model:', modelError);
        throw new Error('Failed to load detection model. Please check your internet connection and try again.');
      }
      
      // Initialize video scanner after model is loaded
      await videoScannerService.initialize(video);
      
      // Get current clip or scan entire video
      const currentClip = getCurrentClip();
      const clipSegments = currentClip ? [currentClip] : undefined;
      
      // Use reasonable default scanning options
      const subjects = await videoScannerService.scanVideo(duration, {
        interval: 1.0, // 1 second interval for simplicity
        minScore: 0.35, // Reasonable threshold for detection
        similarityThreshold: 0.5, // Slightly lower to catch more similar objects
        minDetections: 1, // Only require one detection to include a subject
        clipSegments,
        onProgress: (progress) => {
          // Only update progress if this is still the current scan attempt
          if (currentAttempt === scanAttemptRef.current) {
            dispatch(updateProgress(progress));
          }
        }
      });
      
      // Only process results if this is still the current scan attempt
      if (currentAttempt === scanAttemptRef.current) {
        console.log('Scan complete, found subjects:', subjects);
        dispatch(scanComplete(subjects));
        
        if (subjects.length === 0) {
          setError('No subjects found in the video. Try adjusting the playback position or using a different clip.');
        }
      }
    } catch (error) {
      console.error('Error scanning video:', error);
      
      // Only process errors if this is still the current scan attempt
      if (currentAttempt === scanAttemptRef.current) {
        dispatch(stopScan());
        
        // Provide helpful error messages
        if (error instanceof Error) {
          if (error.message.includes('Timeout waiting for video')) {
            setError('The video is taking too long to load. Please try pausing and then restarting the video, then try scanning again.');
          } else {
            setError(`Error scanning video: ${error.message}`);
          }
        } else {
          setError('An unknown error occurred while scanning the video.');
        }
      }
    } finally {
      // Restore previous playback state if this is still the current scan attempt
      // and the video element is still available
      if (currentAttempt === scanAttemptRef.current && videoRef.current) {
        if (wasPlaying) {
          try {
            // Use a timeout to give the browser a chance to recover
            setTimeout(() => {
              videoRef.current?.play().catch(playError => {
                console.warn('Failed to resume playback:', playError);
              });
            }, 100);
          } catch (playError) {
            console.warn('Error restoring playback:', playError);
          }
        }
      }
    }
  };
  
  // Function to stop an ongoing scan
  const stopVideoScan = () => {
    // Increment the attempt counter to invalidate the current scan
    scanAttemptRef.current += 1;
    
    // Stop scanning in the Redux store
    dispatch(stopScan());
    
    // Clear any errors
    resetError();
  };
  
  return (
    <div className="mb-4 p-4 border border-gray-300 rounded bg-gray-50">
      <h3 className="text-lg font-medium mb-3">Detect Focus Points</h3>
      
      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="space-y-4">
        {/* Main scan button */}
        {isScanning ? (
          <Button
            onClick={stopVideoScan}
            className="w-full py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Cancel Scan
          </Button>
        ) : (
          <Button
            onClick={scanVideo}
            disabled={isReviewMode || (!isVideoReady && !onStartObjectDetection)} 
            className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Scan Video for Subjects
          </Button>
        )}
        
        {/* Progress indicator - moved outside to avoid re-rendering this component too often */}
        {isScanning && (
          <div className="mt-3 mb-2">
            <div className="relative pt-1">
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                <div 
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500" 
                  style={{ width: `${progress.percentComplete}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-700 mb-1">
                Frame {progress.currentFrame} of {progress.totalFrames} ({progress.percentComplete.toFixed(1)}%)
              </p>
              <p className="text-xs text-gray-500">
                {Math.floor(progress.elapsedTime)}s elapsed | ~{Math.ceil(progress.estimatedTimeRemaining)}s remaining
              </p>
            </div>
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
            <div className="mt-2">
              <Button 
                onClick={resetError} 
                className="text-xs px-2 py-1 bg-white border border-gray-300 text-gray-700 rounded"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}
        
        {/* Video not ready message */}
        {!isVideoReady && !error && !isScanning && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
            Waiting for video to be ready for scanning...
          </div>
        )}
        
        {/* Review mode indicator */}
        {isReviewMode && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800 font-medium">
              {detectedSubjects.length} subjects found
            </p>
            <p className="text-blue-600 text-sm mt-1">
              Review and select subjects in the panel below
            </p>
          </div>
        )}
        
        {/* Simple instructions */}
        {!isScanning && !isReviewMode && !error && isVideoReady && (
          <div className="text-sm text-gray-600 bg-white p-3 border border-gray-200 rounded">
            <p>This will scan the video for subjects like people, animals, and objects.</p>
            <p className="mt-1">After scanning, you can select which subjects to use as focus points.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FocusSelector;
