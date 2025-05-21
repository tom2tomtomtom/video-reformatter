import React, { useEffect, useRef, useState, useMemo, memo, useCallback } from 'react'
import ReactPlayer from 'react-player/lazy' // Using lazy loaded version for better performance
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../store'
import { setCurrentTime, setDuration, setIsPlaying } from '../../store/slices/videoSlice'

// Type for clip object
interface Clip {
  id: string;
  startTime: number;
  endTime: number;
}

// Create a specialized player for clip playback - this is like the ClipPreview approach
// Different from general VideoPlayer to handle the exact playback needs of clips
const ClipPlayerCore = memo(({ 
  url,
  clipStartTime,
  clipEndTime,
  playing,
  volume, 
  onProgress, 
  onDuration, 
  onPlay, 
  onPause, 
  onReady, 
  onError, 
  playerRef 
}: { 
  url: string;
  clipStartTime?: number;
  clipEndTime?: number;
  playing: boolean;
  volume: number;
  onProgress: (progress: {playedSeconds: number}) => void;
  onDuration: (duration: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onReady: () => void;
  onError: (error: any) => void;
  playerRef: React.RefObject<ReactPlayer>;
}) => {
  // Add specialized clip handling - directly inspired by ClipPreview
  useEffect(() => {
    if (playing && playerRef.current && clipStartTime !== undefined && clipEndTime !== undefined) {
      const videoElement = playerRef.current.getInternalPlayer();
      if (!videoElement) return;
      
      // Apply the same hardware acceleration tricks from ClipPreview
      videoElement.style.transform = 'translateZ(0)';
      videoElement.style.backfaceVisibility = 'hidden';
      videoElement.style.willChange = 'transform';
      
      // Use requestAnimationFrame for time boundary checking
      // This is the same efficient approach used in ClipPreview
      let animationFrameId: number;
      let lastUpdate = 0;
      
      const checkTimeInRaf = (timestamp: number) => {
        // Only check periodically to reduce overhead
        if (timestamp - lastUpdate > 250 && !videoElement.paused) {
          lastUpdate = timestamp;
          
          // Stop at clip boundaries - exactly like ClipPreview
          if (videoElement.currentTime >= clipEndTime) {
            videoElement.pause();
            onPause();
          }
        }
        
        // Continue the animation loop
        animationFrameId = requestAnimationFrame(checkTimeInRaf);
      };
      
      // Start the animation frame loop
      animationFrameId = requestAnimationFrame(checkTimeInRaf);
      
      return () => {
        cancelAnimationFrame(animationFrameId);
      };
    }
  }, [playing, playerRef, clipStartTime, clipEndTime, onPause]);
  
  // Create a key that only changes when the clip itself changes
  // Using the ClipID is more stable than using times which can cause re-renders
  const playerKey = useMemo(() => `clip-${url}`, [url]);

  // Add an effect to set the initial position when the component mounts
  useEffect(() => {
    if (playerRef.current && clipStartTime !== undefined) {
      const videoElement = playerRef.current.getInternalPlayer() as HTMLVideoElement;
      if (videoElement) {
        // Force positioning at clip start
        videoElement.currentTime = clipStartTime;
        console.log(`ClipPlayerCore: Positioned at start time ${clipStartTime}s`);
      }
    }
  }, [playerKey]); // This effect runs when the component mounts or key changes

  // Use a completely separate component for the player to prevent parent rerenders
  return (
    <ReactPlayer
      key={playerKey} // Key changes force a complete remount
      ref={playerRef}
      url={url}
      width="100%"
      height="100%"
      playing={playing}
      volume={volume}
      onDuration={onDuration}
      onProgress={onProgress}
      onPlay={onPlay}
      onPause={onPause}
      onReady={(player) => {
        // When ready, immediately position at the start time
        if (playerRef.current && clipStartTime !== undefined) {
          const videoElement = playerRef.current.getInternalPlayer() as HTMLVideoElement;
          if (videoElement) {
            if (Math.abs(videoElement.currentTime - clipStartTime) > 0.2) {
              console.log(`ClipPlayerCore onReady: Correcting from ${videoElement.currentTime}s to ${clipStartTime}s`);
              videoElement.currentTime = clipStartTime;
            }
          }
        }
        // Call the original onReady callback
        onReady();
      }}
      onError={onError}
      progressInterval={500} // Faster interval for better clip boundary detection
      playsinline
      config={{
        file: {
          forceVideo: true,
          forceHLS: false,
          forceDASH: false,
          attributes: {
            preload: 'auto',
            controlsList: 'nodownload',
            'webkit-playsinline': true, 
            playsinline: true,
            disablePictureInPicture: true,
          }
        }
      }}
    />
  );
});

// Standard player core component
const PlayerCore = memo(({ 
  url, 
  playing, 
  volume, 
  onProgress, 
  onDuration, 
  onPlay, 
  onPause, 
  onReady, 
  onError, 
  playerRef 
}: { 
  url: string;
  playing: boolean;
  volume: number;
  onProgress: (progress: {playedSeconds: number}) => void;
  onDuration: (duration: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onReady: () => void;
  onError: (error: any) => void;
  playerRef: React.RefObject<ReactPlayer>;
}) => {
  // Get the current time from redux store to use as part of the key
  const { currentTime } = useSelector((state: RootState) => state.video);
  
  // Create a key that changes only when the URL changes, not when the time changes
  // This prevents unnecessary remounts when just seeking
  const playerKey = useMemo(() => `player-${url}`, [url]);
  
  // This effect handles positioning the video at the correct start time after it loads
  useEffect(() => {
    if (playerRef.current) {
      const videoElement = playerRef.current.getInternalPlayer() as HTMLVideoElement;
      if (videoElement) {
        // Position at currentTime immediately after mount
        videoElement.currentTime = currentTime;
        console.log(`PlayerCore: Set initial position to ${currentTime}s`);
      }
    }
  }, [playerKey]); // This runs when the key changes (new position needed)
  
  return (
    <ReactPlayer
      key={playerKey}
      ref={playerRef}
      url={url}
      width="100%"
      height="100%"
      playing={playing}
      volume={volume}
      onDuration={onDuration}
      onProgress={onProgress}
      onPlay={onPlay}
      onPause={onPause}
      onReady={(player) => {
        // When the player is ready, immediately set it to the correct time
        if (playerRef.current) {
          const videoElement = playerRef.current.getInternalPlayer() as HTMLVideoElement;
          if (videoElement && Math.abs(videoElement.currentTime - currentTime) > 0.5) {
            console.log(`PlayerCore onReady: Correcting position from ${videoElement.currentTime}s to ${currentTime}s`);
            videoElement.currentTime = currentTime;
          }
        }
        // Call the original onReady handler
        onReady();
      }}
      onError={onError}
      progressInterval={1000}
      playsinline
      config={{
        file: {
          forceVideo: true,
          forceHLS: false,
          forceDASH: false,
          attributes: {
            preload: 'auto',
            controlsList: 'nodownload',
            'webkit-playsinline': true, 
            playsinline: true,
            disablePictureInPicture: true,
          }
        }
      }}
    />
  );
});

// Create a memoized time display component to prevent re-renders
const TimeDisplay = memo(({ time }: { time: number }) => {
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };
  
  return <div className="video-time-display">{formatTime(time)}</div>;
});

interface VideoPlayerProps {
  disableControls?: boolean;
  showStillFramesOnly?: boolean;
  setVideoElement?: (element: HTMLVideoElement | null) => void;
  videoUrl?: string;
  clipToPlay?: any;
  onSetVideoElement?: (element: HTMLVideoElement | null) => void;
  onStartObjectDetection?: () => void;
  autoStartScan?: boolean;
}

const VideoPlayer = ({ 
  disableControls = false, 
  showStillFramesOnly = false, 
  setVideoElement, 
  videoUrl, 
  clipToPlay: providedClipToPlay, 
  onSetVideoElement, 
  onStartObjectDetection, 
  autoStartScan = false 
}: VideoPlayerProps = {}) => {
  const dispatch = useDispatch()
  const playerRef = useRef<ReactPlayer>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  
  // Use provided videoUrl or fallback to redux state
  const { currentTime, isPlaying, volume } = useSelector((state: RootState) => state.video)
  const url = videoUrl || useSelector((state: RootState) => state.video.url)
  const [videoError, setVideoError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadRetries, setLoadRetries] = useState(0)
  
  // Frame scanning state
  const [isScanning, setIsScanning] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [totalFrames, setTotalFrames] = useState(120) // Default estimate
  const scanIntervalRef = useRef<number | null>(null)
  
  // Object detection state
  const [detectedObjects, setDetectedObjects] = useState<Array<{
    id: string;
    label: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>>([])
  
  // Add clip-related state - used to benefit from ClipPreview's approach
  const [isPlayingClip, setIsPlayingClip] = useState(false);
  const [clipToPlay, setClipToPlay] = useState<{
    id: string;
    startTime: number;
    endTime: number;
  } | null>(providedClipToPlay || null);
  
  // Track whether we should use the specialized clip player
  const [useClipPlayer, setUseClipPlayer] = useState(false);
  
  // Set clipToPlay once from providedClipToPlay on initial render only
  // This prevents infinite loops but allows the component to receive the prop
  useEffect(() => {
    if (providedClipToPlay) {
      setClipToPlay(providedClipToPlay);
      console.log('VideoPlayer: Received clip to play:', providedClipToPlay);
    }
  }, []); // Empty dependency array to run only once
  
  // Auto-start scanning disabled - user must manually press scan button
  useEffect(() => {
    if (false && autoStartScan && onStartObjectDetection && videoRef.current && isLoaded && playerRef.current) {
      console.log('VideoPlayer: Auto-starting object detection');
      onStartObjectDetection();
    }
  }, [autoStartScan, onStartObjectDetection, isLoaded, videoRef, playerRef]);

  // Use memo for the current time check to reduce unnecessary seeks
  const shouldSeek = useMemo(() => {
    if (!playerRef.current) return false;
    const diff = Math.abs(playerRef.current.getCurrentTime() - currentTime);
    return diff > 0.75; // More tolerance to reduce seeking operations
  }, [currentTime]);
  
  // Pass video element to parent component via the setVideoElement callback
  // Track if we've already provided this element to prevent redundant calls
  const elementProvidedRef = useRef(false);
  const updateVideoElement = useCallback(() => {
    if (playerRef.current) {
      const videoElement = playerRef.current.getInternalPlayer() as HTMLVideoElement;
      
      if (videoElement && !elementProvidedRef.current) {
        console.log('VideoPlayer: Providing video element to parent');
        
        // Apply hardware acceleration and other performance hints
        videoElement.style.transform = 'translateZ(0)';
        videoElement.style.backfaceVisibility = 'hidden';
        videoElement.style.perspective = '1000px';
        
        // Store the video element reference
        videoRef.current = videoElement;
        
        // Call both the setVideoElement and onSetVideoElement callbacks if provided
        if (setVideoElement) {
          setVideoElement(videoElement);
        }
        
        if (onSetVideoElement) {
          onSetVideoElement(videoElement);
        }
        
        // Mark that we've provided this element
        elementProvidedRef.current = true;
      }
    }
  }, [setVideoElement, onSetVideoElement]);
  
  // This function definition has been moved and consolidated with the one at line ~840
  
  // Use different effects to make sure we update the reference on multiple occasions
  useEffect(() => {
    // Run on mount
    const timer = setTimeout(updateVideoElement, 500);
    
    return () => {
      clearTimeout(timer);
      // Clean up when component unmounts
      if (setVideoElement) {
        setVideoElement(null);
      }
    };
  }, [updateVideoElement, setVideoElement]);
  
  // Also update after any player ref changes
  useEffect(() => {
    if (playerRef.current) {
      updateVideoElement();
    }
  }, [playerRef.current, updateVideoElement]);

  useEffect(() => {
    if (shouldSeek && playerRef.current) {
      // Mark that we're doing a user-initiated seek
      setIsUserSeeking(true);
      playerRef.current.seekTo(currentTime, 'seconds');
      // Reset the user seeking flag after a short delay
      setTimeout(() => setIsUserSeeking(false), 100);
    }
  }, [currentTime, shouldSeek])

  // Track initial load to avoid showing loading indicators during scanning
  const initialLoadRef = useRef(false);
  
  // Instead of getting timeStart from a non-existent trims slice, we'll use clipToPlay
  // or fallback to 0 if no start time is available
  const timeStart = clipToPlay ? clipToPlay.startTime : 0;
  
  useEffect(() => {
    // Reset states when URL changes
    if (url) {
      setVideoError(false)
      // Only show loading indicator on initial load, not during scanning
      if (!initialLoadRef.current) {
        setIsLoaded(false)
      }
      setLoadRetries(0)
      
      // Add performance-focused settings
      // Apply hardware acceleration hints to video elements
      setTimeout(() => {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          // Apply CSS transform to force hardware acceleration
          video.style.transform = 'translateZ(0)';
          video.style.backfaceVisibility = 'hidden';
          
          // Reduce render workload by disabling picture-in-picture and remote playback
          video.disablePictureInPicture = true;
          
          // Force enhanced buffering behavior
          video.preload = 'auto';
          video.autobuffer = true;
          video.autoplay = false;
          
          // Set trim point if available (addresses video not loading at trim point)
          if (timeStart > 0) {
            console.log('Setting initial time to trim point:', timeStart);
            video.currentTime = timeStart;
          }
          
          // Send the video element to parent if callback provided
          if (setVideoElement) {
            setVideoElement(video);
          }
          
          // Load at high quality first to avoid quality switches
          if (video.videoHeight) {
            const s = document.createElement('source');
            s.src = url;
            s.type = 'video/mp4';
            video.appendChild(s);
            video.load();
          }
        });
        
        // Also reduce work in the main thread
        document.body.style.contain = 'strict';
      }, 100);
      
      // Set a timeout to automatically mark as loaded after a reasonable time
      // This ensures we don't get stuck in a loading state
      const loadTimeout = setTimeout(() => {
        if (!isLoaded) {
          console.log('Force setting video as loaded after timeout');
          setIsLoaded(true);
          initialLoadRef.current = true; // Mark initial load as completed
        }
      }, 5000);
      
      return () => clearTimeout(loadTimeout);
    }
  }, [url, isLoaded, timeStart])

  const handleDuration = (duration: number) => {
    dispatch(setDuration(duration))
    // Video has duration, so it's loaded enough to play
    setIsLoaded(true)
  }

  // Use a heavily throttled version of the progress handler to reduce performance impact
  // This prevents state updates which cause jerkiness
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const [isUserSeeking, setIsUserSeeking] = useState(false);
  const [localPlayState, setLocalPlayState] = useState(isPlaying);
  
  // We'll completely bypass Redux for playback state during actual playback
  // This makes a huge difference in smoothness
  useEffect(() => {
    setLocalPlayState(isPlaying);
  }, [isPlaying]);
  
  // Use the performance API to manage render timing - similar to ClipPreview
  // But with additional performance optimizations
  useEffect(() => {
    if (!playerRef.current) return;
    
    // Force any playing video to high performance mode
    if (localPlayState) {
      // Add global performance class
      document.body.classList.add('video-playing');
      
      // Get direct access to the video element for immediate style changes
      const videoElement = playerRef.current.getInternalPlayer();
      if (videoElement) {
        // Apply the direct optimization techniques from ClipPreview
        videoElement.style.transform = 'translateZ(0)';
        videoElement.style.backfaceVisibility = 'hidden';
        videoElement.style.willChange = 'transform';
        
        // Enhanced preloading options - critical for smooth playback
        if ('preload' in videoElement) {
          videoElement.preload = 'auto';
        }
        
        // Disable picture-in-picture and other features that might consume resources
        videoElement.setAttribute('disablePictureInPicture', '');
      }
      
      // Add a style tag with will-change hints for the entire player tree
      const styleTag = document.createElement('style');
      styleTag.textContent = `
        .video-playing video,
        .video-playing .react-player {
          will-change: transform;
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        .video-playing * {
          transition: none !important;
          animation: none !important;
        }
      `;
      document.head.appendChild(styleTag);
      
      return () => {
        document.body.classList.remove('video-playing');
        if (document.head.contains(styleTag)) {
          document.head.removeChild(styleTag);
        }
      };
    }
  }, [localPlayState, playerRef]);
  
  // We'll update the UI less frequently during playback for better performance
  // Using useCallback to prevent handler recreation on each render
  const handleProgress = useCallback(({ playedSeconds }: { playedSeconds: number }) => {
    // Only update if video is actually playing and we're not seeking
    if (!localPlayState || isUserSeeking) return;
    
    // Limit updates to once every 2 seconds during active playback
    const now = Date.now();
    if (now - lastUpdateTime > 2000) {
      setLastUpdateTime(now);
      
      // Use requestAnimationFrame to schedule the Redux update off the main thread
      // This prevents the update from blocking the UI thread during rendering
      requestAnimationFrame(() => {
        dispatch(setCurrentTime(playedSeconds));
      });
    }
  }, [dispatch, isUserSeeking, lastUpdateTime, localPlayState]);

  // Direct play/pause control - only update Redux after play/pause completes
  // Memoize these handlers to prevent recreation on each render
  const handlePlay = useCallback(() => {
    if (!videoRef.current) return;
    
    // First update local state for immediate visual feedback
    setLocalPlayState(true);
    
    // Delay Redux update to avoid render during playback start
    // This is critical for smooth playback
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        dispatch(setIsPlaying(true));
      }
    }, 100); // Longer delay to ensure smoother transition
  }, [dispatch]);

  const handlePause = useCallback(() => {
    if (!videoRef.current) return;
    
    // Update local state immediately
    setLocalPlayState(false);
    
    // Delay Redux update slightly to prevent jank
    setTimeout(() => {
      dispatch(setIsPlaying(false));
    }, 50);
  }, [dispatch]);
  
  // Direct play function that bypasses Redux
  // Memoized to prevent recreation on renders
  // Learning from ClipPreview: Use a cleaner, more reliable approach with better timing
  const directPlay = useCallback(() => {
    if (!playerRef.current) return;
    
    try {
      // Get the internal HTML5 video element for direct manipulation
      const videoElement = playerRef.current.getInternalPlayer();
      
      if (videoElement) {
        // First pause any existing playback to reset the video state
        videoElement.pause();
        
        // Critical: Add hardware acceleration hints directly to the video element
        // This is a key factor in ClipPreview's smooth playback
        videoElement.style.transform = 'translateZ(0)';
        videoElement.style.backfaceVisibility = 'hidden';
        videoElement.style.willChange = 'transform';
        
        // Update local state first for responsive UI
        setLocalPlayState(false);
        
        // Use a specific timing sequence like in ClipPreview
        // First seek - ensuring time seeking is completed before play
        setTimeout(() => {
          if (isPlayingClip && clipToPlay) {
            videoElement.currentTime = clipToPlay.startTime;
          }
          
          // Then after a delay to ensure seeking is complete, start playback
          setTimeout(() => {
            // Update UI state immediately
            setLocalPlayState(true);
            
            // Use the play promise pattern for proper error handling
            const playPromise = videoElement.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  // Only update Redux after successful play
                  setTimeout(() => {
                    dispatch(setIsPlaying(true));
                  }, 50);
                })
                .catch(err => {
                  console.error('Play failed:', err);
                  setLocalPlayState(false);
                  dispatch(setIsPlaying(false));
                });
            }
          }, 100); // Delay play to ensure the seek completes (ClipPreview timing)
        }, 50);  // Initial delay before seeking (ClipPreview approach)
      } else {
        // Fallback to React-Player controls
        setLocalPlayState(true);
        setTimeout(() => dispatch(setIsPlaying(true)), 100);
      }
    } catch (e) {
      console.error('Error in directPlay:', e);
      // Fallback approach
      setLocalPlayState(true);
      setTimeout(() => dispatch(setIsPlaying(true)), 100);
    }
  }, [playerRef, dispatch, isPlayingClip, clipToPlay]);
  
  // Direct pause function that bypasses Redux
  // Memoized to prevent recreation on renders
  const directPause = useCallback(() => {
    if (!playerRef.current) return;
    
    setLocalPlayState(false);
    
    // Delay the Redux update
    setTimeout(() => {
      dispatch(setIsPlaying(false));
    }, 50);
  }, [playerRef, dispatch]);

  const handleError = (error: any) => {
    console.error('Error playing video:', error)
    
    // If we've tried less than 3 times, retry loading
    if (loadRetries < 3) {
      console.log(`Retrying video load (attempt ${loadRetries + 1})`);
      setLoadRetries(prev => prev + 1);
      // Force reload by setting a small timeout to refresh the player
      setTimeout(() => {
        if (playerRef.current) {
          // Try to reload by toggling play state
          dispatch(setIsPlaying(!isPlaying));
          setTimeout(() => dispatch(setIsPlaying(isPlaying)), 100);
        }
      }, 500);
    } else {
      setVideoError(true);
    }
  }
  
  // Play a specific clip directly - enhanced with ClipPreview techniques
  const playClip = useCallback((clip: { id: string; startTime: number; endTime: number }) => {
    if (!playerRef.current) return;
    
    // Set clip state to inform other parts of the component
    setClipToPlay(clip);
    setIsPlayingClip(true);
    setUseClipPlayer(true); // Enable the specialized clip player for this playback
    
    // Access the internal player directly like ClipPreview does
    const videoElement = playerRef.current.getInternalPlayer();
    if (videoElement) {
      try {
        // First pause - crucial for smoother playback
        videoElement.pause();
        
        // Add hardware acceleration - key insight from ClipPreview
        videoElement.style.transform = 'translateZ(0)';
        videoElement.style.backfaceVisibility = 'hidden';
        videoElement.style.willChange = 'transform';
        
        // Use the exact same timing sequence as ClipPreview
        setTimeout(() => {
          if (!videoElement) return;
          
          // First seek to the clip start time
          videoElement.currentTime = clip.startTime;
          
          // Then play after a delay to ensure seeking is complete
          setTimeout(() => {
            // Update local state first for immediate UI feedback
            setLocalPlayState(true);
            
            // Use the proper play promise pattern from ClipPreview
            const playPromise = videoElement.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  // Only update Redux state after playback has actually started
                  setTimeout(() => {
                    dispatch(setIsPlaying(true));
                  }, 50);
                })
                .catch(err => {
                  console.error('Play failed:', err);
                  setUseClipPlayer(false);
                  setLocalPlayState(false);
                  dispatch(setIsPlaying(false));
                });
            }
          }, 100); // 100ms delay like in ClipPreview
        }, 50);  // 50ms initial delay like in ClipPreview
      } catch (e) {
        console.error('Error in playClip:', e);
        // Fall back to the regular non-optimized approach
        setUseClipPlayer(false);
        directPlay();
      }
    } else {
      // Fallback to regular ReactPlayer approach
      setUseClipPlayer(false);
      directPlay();
    }
  }, [playerRef, dispatch, directPlay, setLocalPlayState]);
  
  // Performance diagnostics
  const [perfStats, setPerfStats] = useState({
    frameDrops: 0,
    lastFrameTime: 0,
    renderTime: 0,
    seekTime: 0,
    frameGaps: [] as number[],
    longFrames: 0
  });
  
  // Track play/pause count for diagnostics
  const [playPauseCount, setPlayPauseCount] = useState(0);
  
  // Add a frame rate monitor
  useEffect(() => {
    if (!playerRef.current || !localPlayState) return;
    
    let frameCount = 0;
    let lastTime = performance.now();
    let frameGaps: number[] = [];
    let longFrameCount = 0;
    
    // Log detailed performance stats every 5 seconds
    const logInterval = setInterval(() => {
      console.log('🔍 VIDEO PERFORMANCE STATS:', {
        'Average frame gap (ms)': frameGaps.length > 0 ? frameGaps.reduce((a, b) => a + b, 0) / frameGaps.length : 0,
        'Long frames (>33ms)': longFrameCount,
        'Frame count': frameCount,
        'Play/Pause count': playPauseCount,
        'Seek time (avg ms)': perfStats.seekTime,
        'Using ClipPlayer': useClipPlayer,
        'Player type': playerRef.current?.getInternalPlayer()?.constructor?.name || 'Unknown',
        'Memory usage (MB)': Math.round(window.performance?.memory?.usedJSHeapSize / 1048576) || 'Unknown',
        'Video element': {
          'readyState': playerRef.current?.getInternalPlayer()?.readyState || 'Unknown',
          'networkState': playerRef.current?.getInternalPlayer()?.networkState || 'Unknown',
          'videoWidth': playerRef.current?.getInternalPlayer()?.videoWidth || 'Unknown',
          'videoHeight': playerRef.current?.getInternalPlayer()?.videoHeight || 'Unknown',
        }
      });
      
      // Reset counters
      frameGaps = [];
      longFrameCount = 0;
      frameCount = 0;
    }, 5000);
    
    // Track frame timing using requestAnimationFrame
    const frameMonitor = () => {
      const now = performance.now();
      const elapsed = now - lastTime;
      
      frameCount++;
      
      // Track time between frames to detect stutters
      if (lastTime > 0) {
        frameGaps.push(elapsed);
        
        // Log significant frame gaps (potential stutters)
        if (elapsed > 33) { // More than 33ms = less than 30fps
          longFrameCount++;
          console.log(`⚠️ Potential stutter: ${Math.round(elapsed)}ms between frames`);
        }
      }
      
      lastTime = now;
      
      // Continue monitoring while playing
      if (localPlayState) {
        requestAnimationFrame(frameMonitor);
      }
    };
    
    // Start monitoring
    requestAnimationFrame(frameMonitor);
    
    // Cleanup
    return () => {
      clearInterval(logInterval);
    };
  }, [localPlayState, playerRef, useClipPlayer, perfStats.seekTime, playPauseCount]);
  
  // Enhanced seek timing diagnostics
  useEffect(() => {
    if (!shouldSeek || !playerRef.current) return;
    
    const seekStartTime = performance.now();
    
    const seekTimeoutId = setTimeout(() => {
      const seekTime = performance.now() - seekStartTime;
      setPerfStats(prev => ({
        ...prev,
        seekTime: seekTime
      }));
      
      console.log(`⏱️ Seek operation took ${seekTime.toFixed(2)}ms`);
    }, 200);
    
    return () => clearTimeout(seekTimeoutId);
  }, [shouldSeek, currentTime]);
  
  // Update play/pause count when playback state changes
  useEffect(() => {
    setPlayPauseCount(prev => prev + 1);
  }, [isPlaying]);
  
  // Add DOM mutation observer to detect React renderer activity
  useEffect(() => {
    const playerContainer = document.querySelector('.video-player-container');
    if (!playerContainer) return;
    
    const observer = new MutationObserver(mutations => {
      if (localPlayState) { // Only log during playback
        console.log(`🔄 DOM mutations during playback: ${mutations.length}`);
      }
    });
    
    observer.observe(playerContainer, {
      attributes: true,
      childList: true,
      subtree: true
    });
    
    return () => observer.disconnect();
  }, [localPlayState]);
  
  // Function to handle frame-by-frame scanning
  // Ultra-simplified version that just updates UI state for scanning
  // The actual scanning is entirely handled by videoScannerService in the Editor component
  const startFrameScanning = useCallback(() => {
    if (!clipToPlay) return;
    
    console.log('VideoPlayer: Updating UI for scanning');
    setIsScanning(true);
    setCurrentFrame(0);
    
    // Use the videoRef which is properly set during updateVideoElement
    if (!videoRef.current) {
      // As a fallback, try to get it from playerRef
      const videoElement = playerRef.current?.getInternalPlayer() as HTMLVideoElement;
      if (videoElement) {
        videoRef.current = videoElement;
      } else {
        console.error('No video element found for scanning');
        setIsScanning(false);
        return;
      }
    }
    
    // Calculate some basic metrics for the UI
    const startTime = clipToPlay.startTime;
    const endTime = clipToPlay.endTime || 0;
    const duration = endTime - startTime;
    const totalFrames = Math.ceil(duration * 24); // Assume 24fps for display
    setTotalFrames(totalFrames);
    
    console.log(`VideoPlayer: Updated UI for scanning - duration: ${duration.toFixed(2)}s`);
    
    // Nothing else needs to happen here - Editor component handles all scanning logic
    
    // Don't auto-reset scanning UI state - Editor will handle this
    // when it completes the actual scanning process
    
    return () => {
      setIsScanning(false);
    };
  }, [clipToPlay, playerRef]);
  
  // Auto-start functionality disabled - require manual scanning
  useEffect(() => {
    if (false && autoStartScan && isLoaded && onStartObjectDetection && !isScanning) {
      console.log('Auto-starting object detection...');
      const timer = setTimeout(() => {
        onStartObjectDetection();
      }, 1000); // Small delay to ensure video is properly loaded
      
      return () => clearTimeout(timer);
    }
  }, [autoStartScan, isLoaded, onStartObjectDetection, isScanning]);
  
  // Handle when the video is ready - using refs to avoid state updates that might cause infinite loops
  const hasLoadedRef = useRef(false);
  const handleReady = useCallback(() => {
    // Avoid duplicate ready events
    if (hasLoadedRef.current) {
      return;
    }
    
    // Log the event
    console.log('🎬 Video ready event fired');
    
    // Always update the video element reference for scanning
    updateVideoElement();
    
    // Set loaded state to remove loading indicators
    setIsLoaded(true);
    
    // Mark initial load as completed
    initialLoadRef.current = true;
    
    // Clear any error state
    setVideoError(false);
    
    // Apply optimization directly to video element
    const videoElement = playerRef.current?.getInternalPlayer();
    if (videoElement) {
      // Apply hardware acceleration
      videoElement.style.transform = 'translateZ(0)';
      videoElement.style.backfaceVisibility = 'hidden';
      videoElement.style.willChange = 'transform';
      videoElement.setAttribute('playsinline', '');
      // Disable autoplay since we want manual frame control
      videoElement.autoplay = false;
      
      console.log('Video element properties:', {
        'videoWidth': videoElement.videoWidth,
        'videoHeight': videoElement.videoHeight,
        'readyState': videoElement.readyState
      });
      
      // Set the current time to clip start time if available
      if (clipToPlay && clipToPlay.startTime !== undefined) {
        console.log('Setting initial time to clip start:', clipToPlay.startTime);
        videoElement.currentTime = clipToPlay.startTime;
        // Also update Redux state for consistency
        dispatch(setCurrentTime(clipToPlay.startTime));
        
        // Calculate total frames for this clip (assuming 24fps)
        if (clipToPlay.endTime) {
          const duration = clipToPlay.endTime - clipToPlay.startTime;
          setTotalFrames(Math.round(duration * 24)); // 24 frames per second
        }
      }
      // If no clip but we have a trim point, set the current time to trim point
      else if (timeStart > 0) {
        console.log('Setting video to trim point in handleReady:', timeStart);
        videoElement.currentTime = timeStart;
        dispatch(setCurrentTime(timeStart));
      }
    }
    
    // Mark as loaded - do this at the end to prevent multiple calls
    hasLoadedRef.current = true;
  }, [playerRef, clipToPlay, dispatch, timeStart, updateVideoElement]);

  if (!url) {
    return (
      <div className="bg-gray-100 rounded-md flex items-center justify-center h-96">
        <p className="text-gray-500">No video loaded. Please upload a video to begin.</p>
      </div>
    )
  }

  if (videoError) {
    return (
      <div className="bg-red-50 rounded-md flex items-center justify-center h-96">
        <div className="text-center p-4">
          <p className="text-red-600 font-medium mb-2">Error playing video</p>
          <p className="text-gray-600 mb-3">The uploaded file might not be a supported video format.</p>
          <button 
            className="px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
            onClick={() => {
              setVideoError(false);
              setLoadRetries(0);
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Use refs to store values that don't need to trigger re-renders
  const playerTimeRef = useRef(currentTime);
  playerTimeRef.current = currentTime;
  
  return (
    <div className="relative bg-black rounded-md overflow-hidden aspect-video w-full">
      {/* Video player content */}

      {/* Add time display as an overlay - this is memoized to reduce rerenders */}
      <div className="absolute top-2 right-2 z-20 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
        <TimeDisplay time={currentTime} />
      </div>
      
      {/* Object Detection will be handled dynamically during scanning */}
      
      {/* Scanning status overlay - shown instead of play/pause controls */}
      <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
        {/* Object detection bounding boxes */}
        {isScanning && detectedObjects.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {detectedObjects.map((obj) => (
              <div 
                key={obj.id}
                className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20 flex flex-col justify-end"
                style={{
                  left: `${obj.x}%`,
                  top: `${obj.y}%`,
                  width: `${obj.width}%`,
                  height: `${obj.height}%`,
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <div className="bg-red-500 text-white px-1 py-0.5 text-xs font-medium truncate" 
                  style={{ maxWidth: '100%' }}>
                  {obj.label} ({Math.round(obj.confidence * 100)}%)
                </div>
              </div>
            ))}
          </div>
        )}
        
        {isScanning && (
          <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Scanning: Frame {currentFrame}/{totalFrames}</span>
          </div>
        )}
        
        {/* Detection summary */}
        {isScanning && detectedObjects.length > 0 && (
          <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            {detectedObjects.length} objects detected
          </div>
        )}
        
        {!isScanning && isLoaded && (
          <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            Ready for scanning
          </div>
        )}
        
        {!isLoaded && (
          <div className="bg-black bg-opacity-30 rounded-full p-4 transition-opacity opacity-70">
            <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/>
            </svg>
          </div>
        )}
      </div>
      
      {/* Only show loading indicator on initial load, not during scanning */}
      {!isLoaded && !initialLoadRef.current && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-800 bg-opacity-50">
          <div className="bg-white p-4 rounded-lg shadow-lg text-center">
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-8 w-8 text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-700 font-medium">Loading video...</p>
              {loadRetries > 0 && (
                <p className="text-gray-500 text-sm mt-1">{`Retry attempt ${loadRetries}/3`}</p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Choose between regular player and specialized clip player */}
      {useClipPlayer && clipToPlay ? (
        <ClipPlayerCore
          playerRef={playerRef}
          url={url}
          clipStartTime={clipToPlay.startTime}
          clipEndTime={clipToPlay.endTime}
          playing={localPlayState}
          volume={volume}
          onDuration={handleDuration}
          onProgress={handleProgress}
          onPlay={handlePlay}
          onPause={handlePause}
          onReady={handleReady}
          onError={handleError}
        />
      ) : (
        <PlayerCore
          playerRef={playerRef}
          url={url}
          playing={localPlayState}
          volume={volume}
          onDuration={handleDuration}
          onProgress={handleProgress}
          onPlay={handlePlay}
          onPause={handlePause}
          onReady={handleReady}
          onError={handleError}
        />
      )}
      {/* Video controls are handled by ReactPlayer */}
    </div>
  )
}

export default VideoPlayer
