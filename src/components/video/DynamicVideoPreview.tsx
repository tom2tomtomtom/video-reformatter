import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { FocusPoint } from '../../store/slices/focusPointsSlice'

interface DynamicVideoPreviewProps {
  ratio: string
  width: number
}

const DynamicVideoPreview: React.FC<DynamicVideoPreviewProps> = ({ ratio, width }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { url, currentTime, isPlaying } = useSelector((state: RootState) => state.video)
  const { points } = useSelector((state: RootState) => state.focusPoints)
  const [activeFocusPoint, setActiveFocusPoint] = useState<FocusPoint | null>(null)
  const [isVideoReady, setIsVideoReady] = useState(false)
  const [isInitialRender, setIsInitialRender] = useState(true)
  
  // Calculate height based on aspect ratio
  const [ratioWidth, ratioHeight] = ratio.split(':').map(Number)
  const aspectRatio = ratioWidth / ratioHeight
  const height = width / aspectRatio
  
  // For debugging - log when props or state changes
  useEffect(() => {
    console.log(`[${ratio}] Preview - Current focus points: `, points.length);
    
    // On initial render, log the video URL
    if (isInitialRender) {
      console.log(`[${ratio}] Preview - Video URL: `, url);
      console.log(`[${ratio}] Preview - Current time: `, currentTime);
      setIsInitialRender(false);
    }
  }, [ratio, points.length, url, isInitialRender, currentTime]);
  
  // Update active focus point when current time changes
  useEffect(() => {
    const activePoint = points.find(
      point => currentTime >= point.timeStart && currentTime <= point.timeEnd
    ) || null
    
    if (activePoint) {
      console.log(`[${ratio}] Active focus point at ${currentTime}s:`, activePoint.description);
    }
    
    setActiveFocusPoint(activePoint)
  }, [currentTime, points, ratio])
  
  // Set up video element and event listeners
  useEffect(() => {
    if (!videoRef.current || !url) return;
    
    const videoElement = videoRef.current;
    
    const handleCanPlay = () => {
      console.log(`[${ratio}] Video can play!`);
      setIsVideoReady(true);
      videoElement.currentTime = currentTime;
    };
    
    const handleError = (e: Event) => {
      console.error(`[${ratio}] Video error:`, e);
    };
    
    // Reset state when URL changes
    setIsVideoReady(false);
    
    // Add event listeners
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('error', handleError);
    
    // Load the video
    videoElement.src = url;
    videoElement.load();
    
    // Clean up
    return () => {
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('error', handleError);
    };
  }, [url, ratio]);
  
  // Sync video time with player
  useEffect(() => {
    if (videoRef.current && isVideoReady && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      console.log(`[${ratio}] Updating time to ${currentTime}s`);
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime, isVideoReady, ratio]);
  
  // Handle play/pause state
  useEffect(() => {
    if (videoRef.current && isVideoReady) {
      if (isPlaying) {
        videoRef.current.play().catch(err => console.error(`[${ratio}] Failed to play:`, err));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, isVideoReady, ratio]);
  
  // Calculate crop styles based on focus point
  const getCropStyles = () => {
    if (!activeFocusPoint) {
      return { transform: 'scale(1)', transformOrigin: '50% 50%' };
    }
    
    // For 16:9 source to other aspect ratios
    const sourceRatio = 16 / 9;
    const targetRatio = ratioWidth / ratioHeight;
    
    // Calculate scaling and positioning
    let scale, offsetX, offsetY;
    
    if (targetRatio < sourceRatio) {
      // Target is taller than source (e.g., 9:16 vertical video)
      scale = sourceRatio / targetRatio;
      offsetX = Math.max(0, Math.min(100, (activeFocusPoint.x * scale - (scale - 1) * 50)));
      offsetY = activeFocusPoint.y;
    } else if (targetRatio > sourceRatio) {
      // Target is wider than source
      scale = targetRatio / sourceRatio;
      offsetX = activeFocusPoint.x;
      offsetY = Math.max(0, Math.min(100, (activeFocusPoint.y * scale - (scale - 1) * 50)));
    } else {
      // Same aspect ratio, no scaling needed
      scale = 1;
      offsetX = activeFocusPoint.x;
      offsetY = activeFocusPoint.y;
    }
    
    console.log(`[${ratio}] Applying transform: scale(${scale}), origin: ${offsetX}% ${offsetY}%`);
    
    return {
      transform: `scale(${scale})`,
      transformOrigin: `${offsetX}% ${offsetY}%`
    };
  };
  
  if (!url) {
    return (
      <div 
        className="bg-gray-200 rounded flex items-center justify-center"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <p className="text-center text-sm text-gray-500">No video loaded</p>
      </div>
    );
  }
  
  return (
    <div className="relative overflow-hidden rounded-md border border-gray-300">
      <div className="absolute top-0 left-0 text-xs bg-black bg-opacity-50 text-white px-2 py-1 z-10">
        {ratio}
      </div>
      
      {activeFocusPoint && (
        <div className="absolute bottom-0 left-0 right-0 text-xs bg-black bg-opacity-50 text-white px-2 py-1 z-10 truncate">
          Focus: {activeFocusPoint.description}
        </div>
      )}
      
      <div 
        className="overflow-hidden bg-gray-800"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        {!isVideoReady ? (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-white text-xs">Loading preview...</p>
          </div>
        ) : (
          <div className="relative w-full h-full overflow-hidden">
            <video
              ref={videoRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                ...getCropStyles()
              }}
              className="absolute inset-0"
              muted
              playsInline
              preload="auto"
            />
          </div>
        )}
        
        {/* Keep the video element present but hidden when not ready */}
        {!isVideoReady && (
          <video
            ref={videoRef}
            className="hidden"
            muted
            playsInline
            preload="auto"
          />
        )}
      </div>
    </div>
  );
};

export default DynamicVideoPreview;