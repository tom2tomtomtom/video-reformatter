import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { addFocusPoint } from '../../store/slices/focusPointsSlice';
import Button from "../common/Button";
import VideoScannerService from "../../services/VideoScannerService";
import {
  startScan,
  stopScan,
  updateProgress,
  scanComplete,
  exitReviewMode
} from '../../store/slices/videoScanSlice';
import ProgressIndicator from '../common/ProgressIndicator';

const FocusSelector: React.FC = () => {
  const dispatch = useDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string>('');
  
  // Get essential video and scan state information
  const { url, duration } = useSelector((state: RootState) => state.video);
  const { isScanning, progress, detectedSubjects, isReviewMode } = useSelector(
    (state: RootState) => state.videoScan
  );
  
  // Get the current clips for context
  const { activeClip } = useSelector((state: RootState) => state.clips);

  // Reset errors and clear UI state
  const resetError = () => {
    setError('');
  };
  
  // Get a reference to the video element when component mounts
  useEffect(() => {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      videoRef.current = videoElement;
    }
    
    // Clean up when component unmounts
    return () => {
      if (isScanning) {
        dispatch(stopScan());
      }
    };
  }, [dispatch, isScanning]);
  
  // Get the current clip for scanning
  const getCurrentClip = () => {
    if (!activeClip) return null;
    
    return {
      startTime: activeClip.startTime,
      endTime: activeClip.endTime
    };
  };
  
  // Simplified function to scan the entire video for subjects
  const scanVideo = async () => {
    resetError();
    
    if (!videoRef?.current) {
      setError('Video element not found');
      return;
    }
    
    if (!url) {
      setError('No video loaded');
      return;
    }
    
    // Remember playback state to restore later
    const wasPlaying = !videoRef.current.paused;
    if (wasPlaying) {
      videoRef.current.pause();
    }
    
    try {
      // Start scanning process
      dispatch(startScan());
      
      // Initialize video scanner
      const videoScanner = new VideoScannerService();
      await videoScanner.initialize(videoRef.current);
      
      // Get current clip or scan entire video
      const currentClip = getCurrentClip();
      const clipSegments = currentClip ? [currentClip] : undefined;
      
      // Use simplified scanning options
      const subjects = await videoScanner.scanVideo(duration, {
        interval: 1.0, // 1 second interval for simplicity
        minScore: 0.35, // Reasonable threshold
        clipSegments,
        onProgress: (progress) => dispatch(updateProgress(progress))
      });
      
      console.log('Scan complete, found subjects:', subjects);
      dispatch(scanComplete(subjects));
      
      if (subjects.length === 0) {
        setError('No subjects found in the video');
      }
    } catch (error) {
      console.error('Error scanning video:', error);
      dispatch(stopScan());
      setError('Error scanning video. Please try again.');
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
  
  // Render a simplified UI
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
            disabled={isReviewMode} 
            className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Scan Video for Subjects
          </Button>
        )}
        
        {/* Progress indicator */}
        {isScanning && (
          <div className="mt-3 mb-2">
            <ProgressIndicator
              percentComplete={progress.percentComplete}
              currentFrame={progress.currentFrame}
              totalFrames={progress.totalFrames}
              elapsedTime={progress.elapsedTime}
              estimatedTimeRemaining={progress.estimatedTimeRemaining}
            />
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
        {!isScanning && !isReviewMode && !error && (
          <div className="text-sm text-gray-600 bg-white p-3 border border-gray-200 rounded">
            <p>This will scan the entire video for subjects like people, animals, and objects.</p>
            <p className="mt-1">After scanning, you can select which subjects to use as focus points.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FocusSelector;
