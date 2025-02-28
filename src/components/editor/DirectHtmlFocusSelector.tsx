import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { 
  addFocusPoint
} from '../../store/slices/focusPointsSlice';
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

const DirectHtmlFocusSelector: React.FC = () => {
  const dispatch = useDispatch();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  
  const { url, currentTime, duration } = useSelector((state: RootState) => state.video);
  const { 
    isScanning, 
    progress, 
    scanOptions 
  } = useSelector((state: RootState) => state.videoScan);
  
  // Create canvas element on mount
  useEffect(() => {
    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    canvasRef.current = canvas;
    
    // Find video element
    const findVideoElement = () => {
      const videoElements = document.querySelectorAll('video');
      console.log('Direct HTML: Found video elements:', videoElements.length);
      
      if (videoElements.length > 0) {
        videoRef.current = videoElements[0];
        console.log('Direct HTML: Video element found');
      }
    };
    
    findVideoElement();
    
    // Clean up on unmount
    return () => {
      if (canvasRef.current) {
        document.body.removeChild(canvasRef.current);
      }
    };
  }, []);
  
  // Update video reference when URL changes
  useEffect(() => {
    const videoElements = document.querySelectorAll('video');
    if (videoElements.length > 0) {
      videoRef.current = videoElements[0];
    }
  }, [url]);
  
  const detectSubjects = async () => {
    alert("Direct HTML: Detect Subjects clicked!");
    console.log("Direct HTML: Detect Subjects clicked!");
    
    if (!videoRef.current || !canvasRef.current) {
      alert("Direct HTML: Video or canvas not found");
      return;
    }
    
    try {
      setIsDetecting(true);
      
      // Load model
      await subjectDetectionService.loadModel();
      
      // Capture current frame
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      const ctx = canvasRef.current.getContext('2d');
      
      if (!ctx) {
        alert("Direct HTML: Could not get canvas context");
        return;
      }
      
      // Draw frame to canvas
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      
      // Detect objects
      const detectionResult = await subjectDetectionService.detectObjects(canvasRef.current);
      alert(`Direct HTML: Detected ${detectionResult.objects.length} objects`);
      
      // Add focus points for detected objects
      detectionResult.objects.forEach(obj => {
        const { bbox, class: className, score } = obj;
        
        if (score >= 0.5) {
          const [x, y, width, height] = bbox;
          
          dispatch(addFocusPoint({
            id: `${className}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timeStart: Math.max(0, currentTime - 0.5),
            timeEnd: Math.min(duration, currentTime + 1.5),
            x: x + width / 2,
            y: y + height / 2,
            width,
            height,
            description: className
          }));
        }
      });
    } catch (error) {
      alert(`Direct HTML: Error - ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDetecting(false);
    }
  };
  
  const startVideoScan = async () => {
    alert("Direct HTML: Scan Entire Video clicked!");
    console.log("Direct HTML: Scan Entire Video clicked!");
    
    if (!videoRef.current) {
      alert("Direct HTML: Video not found");
      return;
    }
    
    try {
      dispatch(startScan());
      
      const videoScanner = new VideoScannerService();
      videoScanner.initialize(videoRef.current);
      
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
      alert(`Direct HTML: Error - ${error instanceof Error ? error.message : String(error)}`);
      dispatch(stopScan());
    }
  };
  
  const stopVideoScan = () => {
    dispatch(stopScan());
  };
  
  const wrapperStyle: React.CSSProperties = {
    padding: '20px',
    marginTop: '20px',
    marginBottom: '20px',
    border: '3px solid #f00',
    borderRadius: '8px',
    backgroundColor: '#fff8f8',
    position: 'relative',
    zIndex: 999
  };
  
  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px'
  };
  
  const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '4px',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold',
    position: 'relative',
    zIndex: 1000
  };
  
  const detectButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: isDetecting ? '#4e95d9' : '#0069d9'
  };
  
  const scanButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: isScanning ? '#dc3545' : '#28a745'
  };
  
  const errorStyle: React.CSSProperties = {
    padding: '10px',
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    border: '1px solid rgba(255, 0, 0, 0.3)',
    borderRadius: '4px',
    color: '#dc3545',
    marginBottom: '10px'
  };
  
  return (
    <div style={wrapperStyle}>
      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
        Direct HTML Focus Points Controls
      </h3>
      
      <div style={buttonContainerStyle}>
        <button
          style={detectButtonStyle}
          disabled={isDetecting || isScanning}
          onClick={detectSubjects}
        >
          {isDetecting ? 'Detecting...' : 'Detect Subjects (Direct HTML)'}
        </button>
        
        {isScanning ? (
          <button
            style={{ ...scanButtonStyle, backgroundColor: '#dc3545' }}
            onClick={stopVideoScan}
          >
            Stop Scanning
          </button>
        ) : (
          <button
            style={scanButtonStyle}
            disabled={isDetecting}
            onClick={startVideoScan}
          >
            Scan Entire Video (Direct HTML)
          </button>
        )}
      </div>
      
      {detectError && (
        <div style={errorStyle}>
          {detectError}
        </div>
      )}
      
      <div style={{ 
        marginTop: '10px', 
        fontSize: '14px', 
        color: '#666'
      }}>
        Direct HTML implementation that bypasses React components
      </div>
    </div>
  );
};

export default DirectHtmlFocusSelector;