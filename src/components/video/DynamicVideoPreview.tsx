import React, { useRef, useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { FocusPoint as StoreFocusPoint } from '../../store/slices/focusPointsSlice'
import { store } from '../../store'
import { recoverVideo } from '../../utils/videoStorage'

interface DynamicVideoPreviewProps {
  ratio: string
  width: number
  manualFocusPoint?: {
    x: number
    y: number
  }
  letterboxEnabled?: boolean
}

/**
 * A component that displays a video preview with the specified aspect ratio
 * and properly centers content based on focus points
 */
const DynamicVideoPreview: React.FC<DynamicVideoPreviewProps> = ({
  ratio,
  width,
  manualFocusPoint,
  letterboxEnabled = true,
}) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // State
  const [isVideoReady, setIsVideoReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadAttempts, setLoadAttempts] = useState(0)
  const [activeFocusPoint, setActiveFocusPoint] = useState<StoreFocusPoint | null>(null)
  const [canPlayFired, setCanPlayFired] = useState(false)
  const [videoWidth, setVideoWidth] = useState(1280) // Default width
  const [videoHeight, setVideoHeight] = useState(720) // Default height
  
  // Redux state
  const { url, currentTime, videoId } = useSelector((state: RootState) => state.video)
  const points = useSelector((state: RootState) => state.focusPoints.points)
  
  // Debug Redux state
  useEffect(() => {
    console.log(`[${ratio}] Redux state:`, {
      url,
      videoId,
      currentTime,
      pointsCount: points.length
    });
  }, [url, videoId, currentTime, points.length, ratio]);
  
  // Calculate height based on aspect ratio
  const [ratioWidth, ratioHeight] = ratio.split(':').map(Number)
  const aspectRatio = ratioWidth / ratioHeight
  const height = Math.round(width / aspectRatio)
  
  // For source to target aspect ratios
  const sourceRatio = 16 / 9; // Assuming source videos are 16:9
  const targetRatio = ratioWidth / ratioHeight;
  
  // Declare scale outside functions so it can be shared
  let scaleFactor = 1;
  
  // Check if we have focus points to work with
  const hasFocusPoints = points.length > 0 || !!manualFocusPoint;
  
  // For debugging - log when props or state changes
  useEffect(() => {
    console.log(`[${ratio}] Preview - Current focus points: `, points.length);
    console.log(`[${ratio}] Preview - Current time: `, currentTime);
  }, [points, currentTime, ratio])
  
  // Update active focus point when current time changes
  useEffect(() => {
    const activePoint = points.find(
      (point) => currentTime >= point.startTime && currentTime <= point.endTime
    ) || null
    
    if (activePoint) {
      console.log(`[${ratio}] Active focus point at ${currentTime}s:`, activePoint.description);
    }
    
    setActiveFocusPoint(activePoint)
  }, [currentTime, points, ratio])
  
  // Reset video when URL changes
  useEffect(() => {
    console.log(`[${ratio}] URL changed, resetting video state`);
    
    // Reset video state
    setIsVideoReady(false);
    setIsPlaying(false);
    setIsLoading(true);
    setLoadAttempts(0);
    
    // Also directly reset video element if available
    if (videoRef.current) {
      const video = videoRef.current;
      try {
        video.pause();
        video.currentTime = 0;
        video.removeAttribute('src');
        video.load();
      } catch (e) {
        console.error(`[${ratio}] Error resetting video element:`, e);
      }
    }
  }, [url, ratio]);
  
  // Determine if we should letterbox for this ratio
  const shouldLetterbox = () => {
    // For square (1:1), never letterbox
    if (ratio === '1:1') {
      return false;
    }
    
    // For other aspect ratios, use the letterboxEnabled prop
    return letterboxEnabled;
  };

  // Calculate the square crop dimensions for all letterboxed versions
  // This ensures all previews use the same square crop
  const getSquareCrop = () => {
    // Get the focus point to use (explicit prop or from store)
    const focusToUse = manualFocusPoint || (activeFocusPoint ? {
      x: activeFocusPoint.x,
      y: activeFocusPoint.y
    } : { x: 0.5, y: 0.5 }); // Default to center
    
    // Calculate the dimension of the square crop
    // For 16:9 video, the square height is the full height
    // and width is the same as the height (creating a square)
    const squareSize = Math.min(videoWidth, videoHeight);
    
    // Calculate position of the square crop centered on the focus point
    // but constrained to remain within the video bounds
    const cropCenterX = Math.max(squareSize/2, Math.min(videoWidth - squareSize/2, focusToUse.x * videoWidth));
    const cropCenterY = Math.max(squareSize/2, Math.min(videoHeight - squareSize/2, focusToUse.y * videoHeight));
    
    // Calculate the crop as percentage of the original video
    const cropLeft = (cropCenterX - squareSize/2) / videoWidth * 100;
    const cropTop = (cropCenterY - squareSize/2) / videoHeight * 100;
    const cropWidth = squareSize / videoWidth * 100;
    const cropHeight = squareSize / videoHeight * 100;
    
    return {
      cropLeft,
      cropTop,
      cropWidth,
      cropHeight,
    };
  };

  // Calculate crop styles based on focus point
  const getCropStyles = () => {
    // Get the focus point to use (explicit prop or from store)
    const focusToUse = manualFocusPoint || (activeFocusPoint ? {
      x: activeFocusPoint.x,
      y: activeFocusPoint.y
    } : { x: 0.5, y: 0.5 }); // Default to center
    
    if (letterboxEnabled) {
      // For letterboxing mode:
      // First crop to a consistent square around focus point
      
      // We'll use object-position to position the video
      // so that our target square is visible
      const { cropLeft, cropTop, cropWidth, cropHeight } = getSquareCrop();
      
      // Increase the scale to ensure we only see the square crop
      // For example, if cropWidth is 50% of the original, scale by 2x
      const scaleX = 100 / cropWidth;
      const scaleY = 100 / cropHeight;
      
      // Position is the center of our crop within the original video
      // Use percentages for responsive sizing
      const posX = (cropLeft + cropWidth/2);
      const posY = (cropTop + cropHeight/2);
      
      return {
        objectFit: 'cover' as const,
        width: '100%',
        height: '100%',
        // Scale and position to show only our square crop
        transform: `scale(${Math.max(scaleX, scaleY)})`,
        transformOrigin: `${posX}% ${posY}%`,
      };
    } else {
      // For non-letterboxing mode (fill and crop)
      // Calculate the maximum safe zoom factor to prevent excessive cropping
      const MAX_ZOOM = 1.5; // Limiting max zoom to prevent excessive cropping
      
      let xOffset, yOffset;
      
      if (targetRatio < sourceRatio) {
        // Target is taller than source (e.g., 9:16 vertical video)
        // Scale height to fit and crop width
        scaleFactor = Math.min(MAX_ZOOM, sourceRatio / targetRatio);
        
        // Calculate x-offset based on focus point (0-1)
        const adjustedX = (focusToUse.x - 0.5) * scaleFactor + 0.5;
        xOffset = adjustedX * 100;
        yOffset = 50; // Keep y centered
      } else if (targetRatio > sourceRatio) {
        // Target is wider than source (e.g., 16:9 from 1:1)
        // Scale width to fit and crop height
        scaleFactor = Math.min(MAX_ZOOM, targetRatio / sourceRatio);
        
        xOffset = 50; // Keep x centered
        
        // Calculate y-offset based on focus point (0-1)
        const adjustedY = (focusToUse.y - 0.5) * scaleFactor + 0.5;
        yOffset = adjustedY * 100;
      } else {
        // Same aspect ratio, no scaling needed
        scaleFactor = 1;
        xOffset = 50;
        yOffset = 50;
      }
      
      return {
        position: 'absolute',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: `scale(${scaleFactor})`,
        transformOrigin: `${xOffset}% ${yOffset}%`,
      };
    }
  };
  
  // Calculate letterbox container style based on target aspect ratio
  const getLetterboxContainerStyle = () => {
    // Calculate how a square should be letterboxed into the target aspect ratio
    if (targetRatio < 1) {
      // Tall container (e.g. 9:16) - square needs horizontal letterboxing
      return {
        width: `${targetRatio * 100}%`, // Width is scaled down
        height: '100%',
        margin: '0 auto',
        background: 'black',
      };
    } else if (targetRatio > 1) {
      // Wide container (e.g. 16:9) - square needs vertical letterboxing
      return {
        width: '100%',
        height: `${(1/targetRatio) * 100}%`, // Height is scaled down
        margin: 'auto 0',
        background: 'black',
      };
    } else {
      // Square container - no letterboxing needed
      return {
        width: '100%',
        height: '100%',
        background: 'black',
      };
    }
  };
  
  // Set up video element and event listeners
  useEffect(() => {
    if (!videoRef.current) {
      console.log(`[${ratio}] Video ref not available`);
      return;
    }
    
    if (!url) {
      console.log(`[${ratio}] No URL provided`);
      setIsLoading(false);
      return;
    }
    
    const videoElement = videoRef.current;
    let isMounted = true;
    
    // Show loading state
    setIsLoading(true);
    setIsVideoReady(false);
    setIsPlaying(false);
    
    // Create one-time event handlers that clean up after themselves
    const handleCanPlay = () => {
      if (!isMounted) return;
      
      console.log(`[${ratio}] Video can play! (one-time event)`);
      
      // Reset to beginning
      videoElement.currentTime = 0;
      
      // Update video dimensions
      if (videoElement.videoWidth && videoElement.videoHeight) {
        setVideoWidth(videoElement.videoWidth);
        setVideoHeight(videoElement.videoHeight);
        console.log(`[${ratio}] Video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
      }
      
      // Update state
      setIsVideoReady(true);
      setIsLoading(false);
      
      // Remove this listener immediately to prevent loops
      videoElement.removeEventListener('canplay', handleCanPlay);
    };
    
    const handlePlay = () => {
      if (!isMounted) return;
      console.log(`[${ratio}] Video playing event`);
      setIsPlaying(true);
    };
    
    const handlePause = () => {
      if (!isMounted) return;
      console.log(`[${ratio}] Video paused event`);
      setIsPlaying(false);
    };
    
    const handleEnded = () => {
      if (!isMounted) return;
      console.log(`[${ratio}] Video ended event`);
      setIsPlaying(false);
    };
    
    const handleError = (e) => {
      if (!isMounted) return;
      
      console.error(`[${ratio}] Video error:`, videoElement.error);
      
      // Try to reload up to 3 times on error
      if (loadAttempts < 3) {
        console.log(`[${ratio}] Retrying video load (attempt ${loadAttempts + 1})`);
        setLoadAttempts(prev => prev + 1);
        
        setTimeout(() => {
          if (!isMounted) return;
          try {
            videoElement.src = url;
            videoElement.load();
          } catch (err) {
            console.error(`[${ratio}] Failed to reload on error:`, err);
          }
        }, 500);
      } else {
        console.error(`[${ratio}] Failed to load video after ${loadAttempts} attempts`);
        try {
          // Try to recover from storage as last resort
          recoverVideo(videoId).then(recoveredUrl => {
            if (recoveredUrl && isMounted) {
              console.log(`[${ratio}] Recovered video from storage`);
              videoElement.src = recoveredUrl;
              videoElement.load();
            }
          }).catch(err => {
            console.error(`[${ratio}] Failed to recover video:`, err);
          });
        } catch (err) {
          console.error(`[${ratio}] Error in recovery:`, err);
        }
      }
    };
    
    // Add minimal event listeners
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('ended', handleEnded);
    
    // Set source and load the video
    console.log(`[${ratio}] Setting video src:`, url);
    try {
      videoElement.crossOrigin = "anonymous";
      videoElement.src = url;
      videoElement.load();
    } catch (err) {
      console.error(`[${ratio}] Error setting video source:`, err);
    }
    
    // Clean up
    return () => {
      isMounted = false;
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('ended', handleEnded);
      
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load();
      }
    };
  }, [url, ratio, videoId, loadAttempts, currentTime]);
  
  // Handle play/pause
  const togglePlayPause = () => {
    if (!videoRef.current || !isVideoReady) {
      console.log(`[${ratio}] Cannot play/pause - video not ready`);
      return;
    }

    try {
      if (isPlaying) {
        console.log(`[${ratio}] Pausing video`);
        videoRef.current.pause();
      } else {
        console.log(`[${ratio}] Playing video`);
        
        // Always reset to beginning when starting playback
        videoRef.current.currentTime = 0;
        
        const playPromise = videoRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log(`[${ratio}] Play successful`);
            })
            .catch(err => {
              console.error(`[${ratio}] Play failed:`, err);
              // Try again with user interaction flag
              const userInteractionPlay = () => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0; // Reset time again for retry
                  videoRef.current.play()
                    .then(() => {
                      console.log(`[${ratio}] Play after user interaction successful`);
                    })
                    .catch(e => {
                      console.error(`[${ratio}] Play after user interaction failed:`, e);
                    });
                }
              };
              
              // Try immediate retry
              userInteractionPlay();
            });
        }
      }
    } catch (err) {
      console.error(`[${ratio}] Error toggling play state:`, err);
    }
    
    setIsPlaying(!isPlaying);
  };
  
  if (!url) {
    return (
      <div
        className="bg-gray-100 rounded flex items-center justify-center"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <p className="text-gray-500 text-sm">No video uploaded</p>
      </div>
    );
  }
  
  if (!hasFocusPoints) {
    return (
      <div
        className="bg-gray-200 rounded flex items-center justify-center"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <p className="text-gray-500 text-sm">Scan video to see preview</p>
      </div>
    );
  }
  
  // Render with letterboxing container
  return (
    <div className="relative overflow-hidden rounded-md border border-gray-300">
      <div className="absolute top-0 right-0 text-xs bg-black bg-opacity-50 text-white px-2 py-1">
        {ratio}
      </div>
      
      <div 
        className="overflow-hidden bg-black"
        style={{ width: `${width}px`, height: `${height}px` }}
        ref={containerRef}
      >
        <div className="relative w-full h-full flex justify-center items-center bg-black">
          {letterboxEnabled ? (
            // LETTERBOXED VERSION
            // First, create a square container centered in the viewport
            <div 
              style={{
                // Fixed square container
                width: Math.min(width, height) + 'px',
                height: Math.min(width, height) + 'px',
                backgroundColor: 'transparent',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Inside this square, we place our video */}
              <video
                ref={videoRef}
                className={`${isVideoReady ? '' : 'hidden'}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 
                    manualFocusPoint 
                      ? `${manualFocusPoint.x * 100}% ${manualFocusPoint.y * 100}%` 
                      : activeFocusPoint
                      ? `${activeFocusPoint.x * 100}% ${activeFocusPoint.y * 100}%`
                      : '50% 50%',
                }}
                preload="metadata"
                muted
                playsInline
              />
            </div>
          ) : (
            // FILL VERSION (non-letterboxed)
            <video
              ref={videoRef}
              className={`${isVideoReady ? '' : 'hidden'}`}
              style={getCropStyles()}
              preload="metadata"
              muted
              playsInline
            />
          )}
          
          {isLoading && !isVideoReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}
          
          {isVideoReady && (
            <button
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-20 transition-opacity"
              onClick={togglePlayPause}
            >
              {!isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DynamicVideoPreview;