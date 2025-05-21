import React, { useRef, useEffect, useState, memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ClipSegment } from '../../services/ClipDetectionService';
import { FocusPoint } from '../../store/slices/focusPointsSlice';

// Memoized component for displaying time information
const TimeInfo = memo(({ startTime, endTime }: { startTime: number, endTime: number }) => {
  return (
    <div className="flex justify-between px-4 text-white text-sm py-2">
      <div>Start: {startTime.toFixed(1)}s</div>
      <div>Duration: {(endTime - startTime).toFixed(1)}s</div>
      <div>End: {endTime.toFixed(1)}s</div>
    </div>
  );
});

// Memoized component for displaying focus points
const FocusPointOverlay = memo(({ focusPoints, videoWidth, videoHeight }: { 
  focusPoints: FocusPoint[], 
  videoWidth: number, 
  videoHeight: number 
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {focusPoints.map(point => (
        <div 
          key={point.id}
          className="absolute border-2 border-green-500 bg-green-500 bg-opacity-20 flex flex-col justify-end"
          style={{
            left: `${(point.x / videoWidth) * 100}%`,
            top: `${(point.y / videoHeight) * 100}%`,
            width: `${(point.width / videoWidth) * 100}%`,
            height: `${(point.height / videoHeight) * 100}%`,
            transform: 'translate(-50%, -50%)',
            transition: 'all 0.2s ease-in-out'
          }}
        >
          <div className="bg-green-500 text-white px-1 py-0.5 text-xs font-medium truncate" 
            style={{ maxWidth: '100%' }}>
            {point.description}
          </div>
        </div>
      ))}
    </div>
  );
});

interface ClipPreviewProps {
  videoUrl: string;
  clip: ClipSegment;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
  showFocusPoints?: boolean;
}

const ClipPreview: React.FC<ClipPreviewProps> = ({
  videoUrl,
  clip,
  autoPlay = false,
  muted = true,
  controls = true,
  loop = false,
  showFocusPoints = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [currentVideoTime, setCurrentVideoTime] = useState(clip.startTime);
  
  // Create refs for timeouts
  const failsafeTimeoutRef = useRef<number | null>(null);
  // Generate a unique key for cache busting without breaking blob URLs
  const [videoKey, setVideoKey] = useState(Date.now().toString());
  
  // Get focus points from Redux store
  const allFocusPoints = useSelector((state: RootState) => state.focusPoints.points);
  
  // Filter focus points to only show those relevant to the current clip time range
  const clipFocusPoints = allFocusPoints.filter(point => 
    (point.timeStart >= clip.startTime && point.timeStart <= clip.endTime) ||
    (point.timeEnd >= clip.startTime && point.timeEnd <= clip.endTime) ||
    (point.timeStart <= clip.startTime && point.timeEnd >= clip.endTime)
  );
  
  // Filter focus points to only show those active at the current playback time
  const activeFocusPoints = clipFocusPoints.filter(point => 
    currentVideoTime >= point.timeStart && currentVideoTime <= point.timeEnd
  );
  
  // Play the clip with proper boundaries
  // Uses a more reliable approach that first seeks, then plays after a brief delay
  const playClip = () => {
    const video = videoRef.current;
    if (!video) return;
    
    // First pause any existing playback and reset
    try {
      video.pause();
      
      // Log the play action with clip details
      console.log(`▶️ Playing ENTIRE clip ${clip.id} from ${clip.startTime.toFixed(2)}s to ${clip.endTime.toFixed(2)}s (duration: ${(clip.endTime - clip.startTime).toFixed(2)}s)`);
      
      // Force to start time, then play
      video.currentTime = clip.startTime;
      setCurrentVideoTime(clip.startTime);
      
      // Add a dedicated event handler just for this play action
      const handleSeeked = () => {
        console.log(`✅ Video seeked to ${video.currentTime.toFixed(2)}s, now playing`);
        
        // Use the play promise properly
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log(`🎬 Playback started successfully at ${video.currentTime.toFixed(2)}s`);
            })
            .catch(err => {
              console.error('Failed to play clip:', err);
              setError('Failed to play clip. Please try again.');
            });
        }
        
        // Remove this one-time handler
        video.removeEventListener('seeked', handleSeeked);
      };
      
      // Add the one-time event handler
      video.addEventListener('seeked', handleSeeked);
      
      // Force the seek operation - the seeked event will trigger playback
      video.currentTime = clip.startTime;
      
      // Failsafe in case the seeked event doesn't fire
      setTimeout(() => {
        if (video.paused) {
          console.warn(`⚠️ Seeked event didn't fire, forcing play at ${video.currentTime.toFixed(2)}s`);
          video.removeEventListener('seeked', handleSeeked);
          
          video.play().catch(err => console.error('Failsafe play failed:', err));
        }
      }, 500);
    } catch (err) {
      console.error('Failed to play clip:', err);
      setError('Failed to play clip. Please try again.');
      
      // Reset loading state in case of error
      setIsLoading(false);
    }
  };

  // Monitor the currentTime and enforce boundaries
  useEffect(() => {
    // Reset loaded state when clip or video source changes
    setIsLoaded(false);
    // Update the key to force video element recreation, but only if it's not a blob URL
    if (!videoUrl.startsWith('blob:')) {
      setVideoKey(Date.now().toString());
    }
    console.log(`Clip or source changed: clipId=${clip.id}, videoUrl changed, startTime=${clip.startTime}`);
  }, [clip.id, videoUrl, clip.startTime, clip.endTime]);
  
  // Function to clear all timeouts
  const clearTimeouts = () => {
    if (failsafeTimeoutRef.current) {
      window.clearTimeout(failsafeTimeoutRef.current);
      failsafeTimeoutRef.current = null;
    }
  };
  
  // Handle video initialization and playback
  useEffect(() => {
    
    // Don't reload if already loaded - prevents constant reloading
    if (isLoaded) return;
    
    setIsLoading(true);
    
    // Clear any existing timeouts first
    clearTimeouts();
    
    // Set a failsafe timeout to prevent getting stuck in loading
    failsafeTimeoutRef.current = window.setTimeout(() => {
      console.warn('Failsafe timeout triggered - forcing preview to loaded state');
      setIsLoaded(true);
      setIsLoading(false);
    }, 2000); // 2 second timeout
    
    const video = videoRef.current;
    if (!video) return;
    
    console.log(`Initializing clip ${clip.id} to start at ${clip.startTime}s`);
    
    // Apply hardware acceleration for smoother playback
    video.style.transform = 'translateZ(0)';
    video.style.backfaceVisibility = 'hidden';
    
    // Ensure maximum performance
    video.setAttribute('disablePictureInPicture', '');
    video.preload = 'auto';
    
    // We'll set the time in the loadeddata event handler
    
    // Use requestAnimationFrame for smoother update cycle
    let animationFrameId: number;
    let lastUpdate = 0;
    
    // More efficient time update handler using rAF
    const checkTimeInRaf = (timestamp: number) => {
      // Only check every 100ms instead of every frame (more responsive boundaries)
      if (timestamp - lastUpdate > 100 && video.paused === false) {
        lastUpdate = timestamp;
        
        // Update current time for focus point calculations
        setCurrentVideoTime(video.currentTime);
        
        // If we've gone past the end of the clip, pause
        if (video.currentTime >= clip.endTime && !video.paused) {
          console.log(`🛑 Reached end of clip at ${video.currentTime.toFixed(2)}s, clip end is ${clip.endTime.toFixed(2)}s`);
          video.pause();
          
          // Update time tracking at the end
          setCurrentVideoTime(clip.endTime);
          
          if (loop) {
            // Schedule the loop restart for smoother transition
            console.log(`🔁 Looping clip back to start time ${clip.startTime.toFixed(2)}s`);
            
            setTimeout(() => {
              video.currentTime = clip.startTime;
              setCurrentVideoTime(clip.startTime);
              video.play().catch(err => console.warn('Loop play failed:', err));
            }, 50);
          }
        }
      }
      
      // Continue the animation loop
      animationFrameId = requestAnimationFrame(checkTimeInRaf);
    };
    
    // Start the animation frame loop
    animationFrameId = requestAnimationFrame(checkTimeInRaf);
    
    // Add a single loadeddata event listener
    const handleLoaded = () => {
      console.log(`📼 Video loaded for clip ${clip.id}: start=${clip.startTime.toFixed(2)}s, end=${clip.endTime.toFixed(2)}s, duration=${(clip.endTime - clip.startTime).toFixed(2)}s`);
      
      // Set video dimensions for focus point positioning
      if (video.videoWidth && video.videoHeight) {
        setVideoWidth(video.videoWidth);
        setVideoHeight(video.videoHeight);
        console.log(`📐 Video dimensions: ${video.videoWidth}x${video.videoHeight}`);
      }
      
      // Pause first to ensure seeking works more reliably
      video.pause();
      
      // Force seek to the clip start time on load
      video.currentTime = clip.startTime;
      setCurrentVideoTime(clip.startTime);
      console.log(`⏱️ Set initial time for clip ${clip.id} to ${clip.startTime.toFixed(2)}s`);
      
      // Check if the seek was successful after a short delay
      setTimeout(() => {
        // Verify position and correct if needed
        if (Math.abs(video.currentTime - clip.startTime) > 0.2) {
          console.warn(`Seek verification failed, trying again. Current: ${video.currentTime}, Target: ${clip.startTime}`);
          video.currentTime = clip.startTime;
        }
        
        // Ensure we're showing a frame (sometimes needed for certain browsers)
        const drawVideoFrame = () => {
          // Create a temporary canvas to force frame rendering
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, 1, 1);
          }
        };
        
        try { drawVideoFrame(); } catch (e) { /* Silent catch */ }
        
        // Now mark as loaded after ensuring the frame is visible
        setIsLoaded(true);
        setIsLoading(false);
        
        // Clear the failsafe timeout since we're loaded successfully
        clearTimeouts();
        
        console.log(`Clip ${clip.id} ready and showing first frame at ${video.currentTime}s`);
      }, 200);
    };
    
    // Handle timeupdate to track current time for focus points
    const handleTimeUpdate = () => {
      // Make sure video stays within clip boundaries
      if (!isLoaded) {
        // Always ensure we're at the correct start time during loading
        if (Math.abs(video.currentTime - clip.startTime) > 0.1) {
          console.log(`TimeUpdate: Correcting position to clip start. Current: ${video.currentTime.toFixed(2)}s, Target: ${clip.startTime.toFixed(2)}s`);
          video.currentTime = clip.startTime;
          // Pause to ensure the frame shows correctly
          video.pause();
        }
      } else if (video.currentTime < clip.startTime - 0.1) {
        // If we've somehow gone before the clip start, correct it
        console.warn(`⚠️ Video before clip start: ${video.currentTime.toFixed(2)}s vs ${clip.startTime.toFixed(2)}s - correcting`);
        video.currentTime = clip.startTime;
      } else if (!video.paused && video.currentTime > clip.endTime) {
        // If we've reached the end of the clip, pause
        console.log(`🏁 TimeUpdate: Reached end of clip at ${video.currentTime.toFixed(2)}s, clip end is ${clip.endTime.toFixed(2)}s`);
        video.pause();
        
        if (loop) {
          console.log(`🔄 TimeUpdate: Looping clip back to ${clip.startTime.toFixed(2)}s`);
          
          setTimeout(() => {
            video.currentTime = clip.startTime;
            setCurrentVideoTime(clip.startTime);
            video.play().catch(e => console.warn("Loop play error:", e));
          }, 50);
        }
      }
      
      // Always track current time for focus points
      setCurrentVideoTime(video.currentTime);
    };
    
    // Handle errors
    const handleError = (e) => {
      console.error('Error loading video for clip:', clip.id, e?.target?.error || 'unknown error');
      setError('Error loading video. Please try again.');
      
      // If we get a NOT_FOUND error with a blob URL, try to reload the page
      // This happens when blob URLs expire or become invalid
      if (videoUrl.startsWith('blob:') && e?.target?.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        console.warn('Blob URL is invalid. This commonly happens after page reloads or when blob references expire.');
        setIsLoading(false);
      }
    };
    
    // Add minimal event listeners
    video.addEventListener('loadeddata', handleLoaded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);
    
    // Special handling for blob URLs to make them more reliable
    if (videoUrl.startsWith('blob:')) {
      try {
        console.log(`Using direct blob URL for clip ${clip.id}: ${videoUrl}`);
        
        // For blob URLs, we need to be careful with the src
        // Sometimes just setting the src isn't enough if the blob reference is no longer valid
        fetch(videoUrl, { method: 'HEAD' })
          .then(response => {
            if (!response.ok) {
              console.warn(`Blob URL check failed: ${response.status} ${response.statusText}`);
              // If we can't access the blob, trigger the error handler
              handleError({ target: { error: { code: MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED } } });
            }
          })
          .catch(err => {
            console.warn(`Blob URL fetch check failed:`, err);
            // If fetch fails, try using a direct video.src assignment as a last resort
            video.src = videoUrl;
          });
      } catch (err) {
        console.error('Error handling blob URL:', err);
      }
    }
    
    // Force load
    video.load();
    
    // Safety timeout - make sure we don't get stuck in loading state
    const timeout = setTimeout(() => {
      if (!isLoaded) {
        console.warn(`ClipPreview force-loaded after timeout for clip ${clip.id}`);
        
        try {
          if (video) {
            // Make an extra effort to ensure we're at the right time before marking as loaded
            video.currentTime = clip.startTime;
            setCurrentVideoTime(clip.startTime);
            
            // Log the actual position vs desired position
            console.log(`Forced position: actual=${video.currentTime}s, desired=${clip.startTime}s`);
          }
        } catch (e) { console.warn('Error setting clip time during force-load:', e); }
        
        // Mark as loaded regardless to prevent freezing
        setIsLoaded(true);
        setIsLoading(false);
      }
    }, 1500); // Increased timeout to give blob URLs more time to load
    
    // Double-safety timeout for absolute fail-safe
    const failsafeTimeout = setTimeout(() => {
      if (!isLoaded) {
        console.warn(`FAILSAFE: Force-loading clip ${clip.id} after extended timeout`);
        setIsLoaded(true);
        setIsLoading(false);
      }
    }, 3000); // Increased failsafe timeout
    
    return () => {
      clearTimeout(timeout);
      clearTimeout(failsafeTimeout);
      clearTimeouts(); // Clear our custom failsafe timeout
      cancelAnimationFrame(animationFrameId);
      video.removeEventListener('loadeddata', handleLoaded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
    };
  }, [clip.id, videoUrl, clip.startTime, clip.endTime, loop, isLoaded]);
  
  // Simple retry function
  const handleRetry = () => {
    setError(null);
    setIsLoaded(false);
    setIsLoading(true);
    
    // Clear existing timeouts
    clearTimeouts();
    
    // Set a new failsafe
    failsafeTimeoutRef.current = window.setTimeout(() => {
      console.warn('Retry failsafe timeout triggered');
      setIsLoaded(true);
      setIsLoading(false);
    }, 2000);
    
    // Force reload by updating the key
    setVideoKey(Date.now().toString());
    
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  return (
    <div className="relative">
      {error ? (
        <div className="bg-red-100 text-red-700 p-3 rounded">
          {error}
          <button 
            className="ml-2 px-2 py-1 bg-red-200 text-red-800 rounded"
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-700 rounded z-10">
              <div className="flex flex-col items-center">
                <svg className="animate-spin h-8 w-8 text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{clipFocusPoints.length > 0 ? "Processing focus points..." : "Loading video..."}</span>
              </div>
            </div>
          )}
          
          {/* Main video and custom controls */}
          <div className="relative">
            <video
              ref={videoRef}
              key={videoKey} /* This forces a full reload when the key changes */
              src={videoUrl.startsWith('blob:') ? videoUrl : `${videoUrl}${videoUrl.includes('?') ? '&' : '?'}cache=${videoKey}`} /* Don't add cache param to blob URLs */
              className="w-full rounded"
              muted={muted}
              controls={false} /* Disable browser controls, use our own */
              playsInline
              preload="auto"
            />
            
            {/* Focus points overlay - shows only active focus points */}
            {showFocusPoints && videoWidth > 0 && videoHeight > 0 && (
              <FocusPointOverlay 
                focusPoints={activeFocusPoints} 
                videoWidth={videoWidth} 
                videoHeight={videoHeight} 
              />
            )}
            
            {/* Simplified custom controls - only show when fully loaded */}
            {isLoaded && (
              <div className="absolute inset-0 flex flex-col justify-center items-center">
                {/* Play button overlay */}
                <button 
                  className="bg-blue-500 bg-opacity-80 hover:bg-opacity-100 text-white rounded-full p-4 shadow-lg transform transition-transform hover:scale-110"
                  onClick={playClip}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                

              </div>
            )}
            
            {/* Time info overlay - Using memoized component to prevent re-renders */}
            <div className="absolute bottom-3 left-0 right-0 bg-black bg-opacity-50">
              <TimeInfo startTime={clip.startTime} endTime={clip.endTime} />
            </div>
            
            {/* Focus points counter */}
            {showFocusPoints && clipFocusPoints.length > 0 && (
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs">
                {clipFocusPoints.length} objects detected
              </div>
            )}
          </div>
        </>
      )}
      <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
        {(clip.endTime - clip.startTime).toFixed(1)}s
      </div>
    </div>
  );
};

export default ClipPreview;
