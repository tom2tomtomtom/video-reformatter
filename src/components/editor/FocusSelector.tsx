import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { 
  addFocusPoint, 
  removeFocusPoint, 
  updateFocusPoint 
} from '../../store/slices/focusPointsSlice';
import { updateCurrentTime } from '../../store/slices/videoSlice';
import Button from "../common/Button";
import SubjectDetectionService from "../../services/SubjectDetectionService";
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

interface FocusSelectorProps {
  videoElement: HTMLVideoElement | null;
}

const FocusSelector: React.FC<FocusSelectorProps> = ({ videoElement }) => {
  const dispatch = useDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  
  const currentTime = useSelector((state: RootState) => state.video.currentTime);
  const isPlaying = useSelector((state: RootState) => state.video.isPlaying);
  const duration = useSelector((state: RootState) => state.video.duration);
  const { 
    isScanning, 
    progress, 
    detectedSubjects, 
    isReviewMode, 
    scanOptions 
  } = useSelector((state: RootState) => state.videoScan);
  
  // Function to detect subjects in the current frame
  const detectSubjects = async () => {
    if (!videoElement || !canvasRef.current) {
      setDetectError('Video not loaded');
      return;
    }
    
    try {
      setIsDetecting(true);
      setDetectError(null);
      
      const detectionService = new SubjectDetectionService();
      await detectionService.initialize();
      
      // Capture the current frame to canvas
      const canvas = canvasRef.current;
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        setDetectError('Could not get canvas context');
        return;
      }
      
      // Draw current frame to canvas
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // Detect objects in canvas
      const detectedObjects = await detectionService.detectObjectsInCanvas(canvas);
      
      // Add detected objects as focus points
      detectedObjects.forEach(obj => {
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
    } catch (error) {
      console.error('Error detecting subjects:', error);
      setDetectError('Error detecting subjects');
    } finally {
      setIsDetecting(false);
    }
  };
  
  // Function to start scanning the entire video
  const startVideoScan = async () => {
    if (!videoElement) {
      return;
    }
    
    const wasPlaying = !videoElement.paused;
    if (wasPlaying) {
      videoElement.pause();
    }
    
    try {
      dispatch(startScan());
      
      const videoScanner = new VideoScannerService();
      videoScanner.initialize(videoElement);
      
      const subjects = await videoScanner.scanVideo(duration, {
        interval: scanOptions.interval,
        minScore: scanOptions.minScore,
        similarityThreshold: scanOptions.similarityThreshold,
        minDetections: scanOptions.minDetections,
        onProgress: (progress) => {
          dispatch(updateProgress(progress));
        }
      });
      
      dispatch(scanComplete(subjects));
    } catch (error) {
      console.error('Error scanning video:', error);
      dispatch(stopScan());
    } finally {
      // Restore previous playback state
      if (wasPlaying) {
        videoElement.play();
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
    <div className="mb-4">
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
            disabled={isDetecting || !videoElement || isScanning}
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            {isDetecting ? 'Detecting...' : 'Detect Subjects'}
          </Button>
          
          {isScanning ? (
            <Button
              onClick={stopVideoScan}
              className="px-4 py-2 bg-red-600 text-white rounded-md"
            >
              Stop Scanning
            </Button>
          ) : (
            <Button
              onClick={startVideoScan}
              disabled={!videoElement || isDetecting || isReviewMode}
              className="px-4 py-2 bg-green-600 text-white rounded-md"
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
      </div>
      
      {/* Scanning configuration */}
      {!isScanning && !isReviewMode && (
        <ScanConfigPanel />
      )}
      
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
        <ScanReviewPanel
          videoElement={videoElement}
          onFinalize={handleScanFinalized}
        />
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