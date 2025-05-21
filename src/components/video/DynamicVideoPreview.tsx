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
  clipTimeStart?: number
  clipTimeEnd?: number
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
  clipTimeStart,
  clipTimeEnd,
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
    // If we have a manual focus point, always use that instead of time-based focus points
    if (manualFocusPoint) {
      console.log(`[${ratio}] Using manual focus point:`, manualFocusPoint);
      return;
    }
    
    // Find the focus point for the current time
    const activePoint = points.find(
      (point) => {
        // Check if current time is within this focus point's time range
        const isWithinTimeRange = currentTime >= point.timeStart && currentTime <= point.timeEnd;
        
        // If we have a clip time start/end, also verify the point is within clip boundaries
        if (clipTimeStart !== undefined && clipTimeEnd !== undefined) {
          const isWithinClipBounds = 
            point.timeStart <= clipTimeEnd && 
            point.timeEnd >= clipTimeStart;
          return isWithinTimeRange && isWithinClipBounds;
        }
        
        return isWithinTimeRange;
      }
    ) || null;
    
    if (activePoint) {
      console.log(`[${ratio}] Active focus point at ${currentTime}s:`, activePoint.description);
    } else if (points.length > 0 && videoRef.current && !videoRef.current.paused) {
      // If we're playing but don't have an active point, log this for debugging
      console.log(`[${ratio}] No active focus point at time ${currentTime}s (out of ${points.length} points)`);
    }
    
    setActiveFocusPoint(activePoint);
  }, [currentTime, points, ratio, manualFocusPoint, clipTimeStart, clipTimeEnd])
  
  // Reset video when URL changes
  useEffect(() => {
    console.log(`[${ratio}] URL changed to: ${url}`);
    console.log(`[${ratio}] Current points:`, points);
    console.log(`[${ratio}] Manual focus point:`, manualFocusPoint);
    
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
    const rawFocusPoint = manualFocusPoint || (activeFocusPoint ? {
      x: activeFocusPoint.x,
      y: activeFocusPoint.y
    } : { x: 0.5, y: 0.5 }); // Default to center
    
    // Ensure focus point is normalized (0-1 range)
    // We need to handle both cases: already normalized or pixel values
    const focusToUse = {
      // If x is > 1, it's probably in pixels, so normalize it
      x: rawFocusPoint.x > 1 ? rawFocusPoint.x / videoWidth : rawFocusPoint.x,
      y: rawFocusPoint.y > 1 ? rawFocusPoint.y / videoHeight : rawFocusPoint.y
    };
    
    // Add debug logging for export troubleshooting
    console.log(`[${ratio}] Raw focus point:`, rawFocusPoint);
    console.log(`[${ratio}] Normalized focus point: x=${focusToUse.x}, y=${focusToUse.y}`);
    console.log(`[${ratio}] Source dimensions: ${videoWidth}x${videoHeight}, ratio=${videoWidth/videoHeight}`);
    console.log(`[${ratio}] Target ratio: ${targetRatio}`);
    
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
      
      // Log detailed crop information for export troubleshooting
      console.log(`[${ratio}] LETTERBOX MODE - Square crop: ${cropWidth}% x ${cropHeight}% at (${cropLeft}%, ${cropTop}%)`);
      console.log(`[${ratio}] Scale: ${Math.max(scaleX, scaleY)}, Position: ${posX}%, ${posY}%`);
      
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
      
      // Log detailed crop information for export troubleshooting
      console.log(`[${ratio}] FILL MODE - Scale: ${scaleFactor}, Position: ${xOffset}%, ${yOffset}%`);
      
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
  
  // Set a unique key based on URL to prevent unnecessary reloads
  const videoKey = url || 'no-video';
  
  // Track if we've already loaded this URL to prevent unnecessary reloads
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  
  // Set up video element and event listeners
  useEffect(() => {
    // Skip reloading if it's the same video URL already loaded correctly
    if (url === loadedUrl && isVideoReady && !isLoading) {
      console.log(`[${ratio}] Skipping reload of already loaded video:`, url);
      return;
    }
    
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
    
    // Add timeouts to prevent infinite loading
    let primaryTimeoutId: number | null = null;
    let failsafeTimeoutId: number | null = null;
    
    // Primary timeout - most videos should load within 1 second
    primaryTimeoutId = window.setTimeout(() => {
      if (!isMounted) return;
      
      if (!isVideoReady) {
        console.log(`[${ratio}] Primary timeout: forcing video ready state`);
        
        // Try to ensure the video is at the correct time
        try {
          if (clipTimeStart !== undefined) {
            videoElement.currentTime = clipTimeStart;
          }
        } catch (err) {
          console.error(`[${ratio}] Error in timeout currentTime set:`, err);
        }
        
        // Force the ready state
        setIsVideoReady(true);
        setIsLoading(false);
        setLoadedUrl(url); // Mark this URL as loaded
      }
    }, 1000);
    
    // Failsafe timeout - absolute maximum wait time (3 seconds)
    failsafeTimeoutId = window.setTimeout(() => {
      if (!isMounted) return;
      
      if (!isVideoReady) {
        console.log(`[${ratio}] Failsafe timeout: forcing video ready state`);
        setIsVideoReady(true);
        setIsLoading(false);
        setLoadedUrl(url); // Mark this URL as loaded
      }
    }, 3000);
    
    // Create one-time event handlers that clean up after themselves
    const handleCanPlay = () => {
      if (!isMounted) return;
      
      console.log(`[${ratio}] Video can play! (one-time event)`);
      
      // Set to clip start time if provided, otherwise reset to beginning
      try {
        // Ensure the clip starts at the right time
        if (clipTimeStart !== undefined) {
          videoElement.currentTime = clipTimeStart;
          console.log(`[${ratio}] Set video currentTime to clip start:`, clipTimeStart);
        } else {
          videoElement.currentTime = 0;
          console.log(`[${ratio}] No clip start time, set to beginning`);
        }
      } catch (err) {
        console.error(`[${ratio}] Error setting currentTime:`, err);
      }
      
      // Update video dimensions
      if (videoElement.videoWidth && videoElement.videoHeight) {
        setVideoWidth(videoElement.videoWidth);
        setVideoHeight(videoElement.videoHeight);
        console.log(`[${ratio}] Video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
      }
      
      // Update state
      setIsVideoReady(true);
      setIsLoading(false);
      setCanPlayFired(true);
      setLoadedUrl(url); // Mark this URL as loaded
      
      // Clear timeouts as we don't need them anymore
      if (primaryTimeoutId) window.clearTimeout(primaryTimeoutId);
      if (failsafeTimeoutId) window.clearTimeout(failsafeTimeoutId);
      
      // Remove this listener immediately to prevent loops
      videoElement.removeEventListener('canplay', handleCanPlay);
    };
    
    // Additional event to help with loading detection
    const handleLoadedData = () => {
      if (!isMounted) return;
      console.log(`[${ratio}] loadeddata event fired`);
      
      // Ensure clip time is set correctly
      if (clipTimeStart !== undefined) {
        try {
          // Double-check position again
          if (Math.abs(videoElement.currentTime - clipTimeStart) > 0.1) {
            console.log(`[${ratio}] Correcting time in loadeddata handler: ${videoElement.currentTime} -> ${clipTimeStart}`);
            videoElement.currentTime = clipTimeStart;
          }
        } catch (err) {
          console.error(`[${ratio}] Error in loadeddata currentTime set:`, err);
        }
      }
    };
    
    const handleLoad = () => {
      console.log(`[${ratio}] Load event fired`);
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
        // Even on error, eventually show something rather than loading wheel
        setIsVideoReady(true);
        setIsLoading(false);
        
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
    
    // Add event listeners
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('loadeddata', handleLoadedData);
    videoElement.addEventListener('load', handleLoad);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('ended', handleEnded);
    
    // Set source and load the video only if we need to
    if (url !== loadedUrl || !isVideoReady) {
      console.log(`[${ratio}] Setting video src:`, url);
      try {
        videoElement.crossOrigin = "anonymous";
        videoElement.src = url;
        videoElement.currentTime = clipTimeStart || 0; // Start at clip time
        videoElement.load();
      } catch (err) {
        console.error(`[${ratio}] Error setting video source:`, err);
      }
    } else {
      console.log(`[${ratio}] Reusing existing video, adjusting position to:`, clipTimeStart);
      try {
        // Just update the position without reloading
        if (clipTimeStart !== undefined) {
          videoElement.currentTime = clipTimeStart;
        }
      } catch (err) {
        console.error(`[${ratio}] Error adjusting position:`, err);
      }
    }
    
    // Clean up
    return () => {
      isMounted = false;
      
      // Clear all timeouts
      if (primaryTimeoutId) window.clearTimeout(primaryTimeoutId);
      if (failsafeTimeoutId) window.clearTimeout(failsafeTimeoutId);
      
      // Remove all event listeners
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      videoElement.removeEventListener('load', handleLoad);
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
  }, [url, ratio, videoId, loadAttempts, currentTime, isVideoReady, loadedUrl, clipTimeStart, clipTimeEnd]);
  
  // Use requestAnimationFrame for more efficient time boundary enforcement
  useEffect(() => {
    // Skip if no video or no clip time boundaries
    if (!videoRef.current || !clipTimeStart) return;
    
    console.log(`[${ratio}] Setting up clip boundaries: ${clipTimeStart} to ${clipTimeEnd}`);
    
    // Use requestAnimationFrame for smoother update cycle
    let animationFrameId: number;
    let lastUpdate = 0;
    
    // More efficient time update handler using rAF
    const checkTimeInRaf = (timestamp: number) => {
      const video = videoRef.current;
      if (!video) return;
      
      // Only check every 50ms instead of every frame for more responsive boundaries
      if (timestamp - lastUpdate > 50 && !video.paused) {
        lastUpdate = timestamp;
        
        // Throttle Redux updates to avoid excessive dispatches
        const shouldUpdateRedux = Math.abs(video.currentTime - currentTime) > 0.1;
        
        // Update the Redux store with the current time for proper focus point tracking
        // This ensures focus points update at the proper rate during playback
        if (shouldUpdateRedux) {
          store.dispatch({
            type: 'video/setCurrentTime',
            payload: video.currentTime
          });
        }
        
        // If we've gone past the end of the clip, loop back to start
        if (clipTimeEnd && video.currentTime >= clipTimeEnd) {
          console.log(`[${ratio}] Reached clip end at ${video.currentTime}, resetting to ${clipTimeStart}`);
          
          // Pause first for more reliable seeking
          video.pause();
          
          // Schedule restart with small delay for smoother transition
          setTimeout(() => {
            if (videoRef.current) {
              // Ensure we reset to the precise clip start
              videoRef.current.currentTime = clipTimeStart || 0;
              
              // Also update the Redux store to match
              store.dispatch({
                type: 'video/setCurrentTime',
                payload: clipTimeStart || 0
              });
              
              // Resume playback
              videoRef.current.play().catch(err => 
                console.warn(`[${ratio}] Loop play failed:`, err));
            }
          }, 50);
        }
        
        // If time is before clip start, set to clip start
        if (clipTimeStart !== undefined && video.currentTime < clipTimeStart) {
          console.log(`[${ratio}] Before clip start, setting to ${clipTimeStart}`);
          video.currentTime = clipTimeStart;
          
          // Also update Redux
          store.dispatch({
            type: 'video/setCurrentTime',
            payload: clipTimeStart
          });
        }
      }
      
      // Continue the animation loop
      animationFrameId = requestAnimationFrame(checkTimeInRaf);
    };
    
    // Start the animation frame loop
    animationFrameId = requestAnimationFrame(checkTimeInRaf);
    
    // Clean up
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [ratio, clipTimeStart, clipTimeEnd, isVideoReady]);
  
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
        setIsPlaying(false);
      } else {
        console.log(`[${ratio}] Playing video`);
        
        // Set to clip start time if provided, otherwise reset to beginning
        try {
          videoRef.current.currentTime = clipTimeStart || 0;
          console.log(`[${ratio}] Playing from time:`, videoRef.current.currentTime);
        } catch (err) {
          console.error(`[${ratio}] Error setting currentTime:`, err);
        }
        
        const playPromise = videoRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log(`[${ratio}] Play successful`);
              setIsPlaying(true);
            })
            .catch(err => {
              console.error(`[${ratio}] Play failed:`, err);
              // Try again with user interaction flag
              const userInteractionPlay = () => {
                if (videoRef.current) {
                  try {
                    videoRef.current.currentTime = clipTimeStart || 0; // Reset time to clip start
                  } catch (innerErr) {
                    console.error(`[${ratio}] Error setting currentTime on retry:`, innerErr);
                  }
                  
                  videoRef.current.play()
                    .then(() => {
                      console.log(`[${ratio}] Play after user interaction successful`);
                      setIsPlaying(true);
                    })
                    .catch(e => {
                      console.error(`[${ratio}] Play after user interaction failed:`, e);
                    });
                }
              };
              
              // Try immediate retry
              userInteractionPlay();
            });
        } else {
          // For browsers that don't return a promise
          setIsPlaying(true);
        }
      }
    } catch (err) {
      console.error(`[${ratio}] Error toggling play state:`, err);
    }
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
                key={videoKey} // Add key to prevent unnecessary reloads
                ref={videoRef}
                className={`${isVideoReady ? '' : 'hidden'}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: (() => {
                    // Get the focus point
                    const rawFocus = manualFocusPoint || activeFocusPoint || { x: 0.5, y: 0.5 };
                    
                    // Normalize if needed
                    const x = rawFocus.x > 1 ? (rawFocus.x / videoWidth) * 100 : rawFocus.x * 100;
                    const y = rawFocus.y > 1 ? (rawFocus.y / videoHeight) * 100 : rawFocus.y * 100;
                    
                    // Make sure x and y are within reasonable bounds (0-100%)
                    const safeX = Math.max(0, Math.min(100, x));
                    const safeY = Math.max(0, Math.min(100, y));
                    
                    return `${safeX}% ${safeY}%`;
                  })(),
                }}
                preload="auto"
                muted
                playsInline
                autoPlay={false}
                loop
                controls={false}
              />
            </div>
          ) : (
            // FILL VERSION (non-letterboxed)
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <video
                key={videoKey} // Add key to prevent unnecessary reloads
                ref={videoRef}
                className={`${isVideoReady ? '' : 'hidden'}`}
                style={getCropStyles()}
                preload="auto"
                muted
                playsInline
                autoPlay={false}
                loop
                controls={false}
              />
            </div>
          )}
          
          {isLoading && (
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