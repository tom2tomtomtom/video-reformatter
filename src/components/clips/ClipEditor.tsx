import React, { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import VideoTimeline from './VideoTimeline';
import { ClipSegment } from '../../services/ClipDetectionService';
import { setPlayheadPosition, setIsPlaying, updateClipTrim } from '../../store/slices/clipSlice';
import Button from '../common/Button';

interface ClipEditorProps {
  videoUrl: string;
  currentClip: ClipSegment;
  onSave: (clip: ClipSegment) => void;
  onCancel: () => void;
}

const ClipEditor: React.FC<ClipEditorProps> = ({ 
  videoUrl, 
  currentClip, 
  onSave, 
  onCancel 
}) => {
  const dispatch = useDispatch();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [editedName, setEditedName] = useState(currentClip.name || '');
  
  const playheadPosition = useSelector((state: RootState) => state.clips.playheadPosition);
  const isPlaying = useSelector((state: RootState) => state.clips.isPlaying);
  
  // Initialize component with props
  useEffect(() => {
    // Check if URL is valid - either http/https or blob URL
    const isValidUrl = Boolean(videoUrl) && (
      videoUrl.startsWith('http') || 
      videoUrl.startsWith('blob:') ||
      videoUrl.startsWith('data:')
    );
    
    // If URL is invalid, show error
    if (!videoUrl || !isValidUrl) {
      setVideoError(true);
      setErrorMessage('Invalid video URL provided');
    }
  }, [videoUrl, currentClip]);
  
  // Set initial playhead position to clip start time
  useEffect(() => {
    // Set initial playhead position for the current clip
    dispatch(setPlayheadPosition(currentClip.startTime));
    if (videoRef.current) {
      videoRef.current.currentTime = currentClip.startTime;
    }
  }, [currentClip.id]);
  
  // Add state for video errors and loading state
  const [videoError, setVideoError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  
  // Handle video errors
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('Video loading error:', e);
    setVideoError(true);
    
    const video = e.currentTarget;
    let errorText = 'Unknown error';
    
    // Diagnose the specific error
    switch(video.error?.code) {
      case 1: errorText = 'MEDIA_ERR_ABORTED: Fetching process aborted by user'; break;
      case 2: errorText = 'MEDIA_ERR_NETWORK: Network error while loading'; break;
      case 3: errorText = 'MEDIA_ERR_DECODE: Media decoding error'; break;
      case 4: errorText = 'MEDIA_ERR_SRC_NOT_SUPPORTED: Format not supported'; break;
    }
    
    setErrorMessage(errorText);
    console.error('Video error code:', video.error?.code, errorText);
    console.error('Video URL:', videoUrl);
  };
  
  // Apply optimizations to video element
  const applyVideoOptimizations = (video: HTMLVideoElement) => {
    // Apply hardware acceleration for smoother playback
    video.style.transform = 'translateZ(0)';
    video.style.backfaceVisibility = 'hidden';
    
    // Set additional attributes for better performance
    video.setAttribute('disablePictureInPicture', '');
    video.preload = 'auto';
  };
  
  // Enhanced metadata handler with video frame rate detection and optimization settings
  const handleMetadataLoaded = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    
    // Clear any previous errors since we successfully loaded metadata
    setVideoError(false);
    setErrorMessage('');
    setIsVideoLoaded(true);
    
    setVideoDuration(video.duration);
    
    // Apply optimizations immediately when metadata is loaded
    applyVideoOptimizations(video);
    
    // Detect the native frame rate of the video based on common standards
    let detectedFrameRate = 30; // Default assumption
    
    // Try to determine the correct frame rate based on video properties
    // This is a heuristic approach since HTML5 video doesn't expose the native frame rate
    if (video.videoHeight) {
      if (video.videoHeight === 1080 || video.videoHeight === 2160) { // HD/4K content
        if (video.videoWidth / video.videoHeight > 2) { // Wider aspect ratios typical of film
          detectedFrameRate = 24; // Film standard
        } else {
          detectedFrameRate = 30; // Standard HD/4K
        }
      } else if (video.videoHeight === 720) { // HD 720p
        detectedFrameRate = 30; // Typical for 720p
      } else if (video.videoHeight === 576) { // SD PAL
        detectedFrameRate = 25; // PAL standard
      } else if (video.videoHeight === 480) { // SD NTSC
        detectedFrameRate = 30; // NTSC standard (29.97)
      }
    }
    
    // Update the frame rate for stepping through frames
    setPerfStats(prev => ({
      ...prev,
      nativeFrameRate: detectedFrameRate
    }));
    
    // Video metadata loaded successfully
    
    // Force initial seek to start time for better playback reliability
    try {
      setTimeout(() => {
        if (video && video.readyState >= 1) {
          video.currentTime = currentClip.startTime;
          dispatch(setPlayheadPosition(currentClip.startTime));
        }
      }, 50);
    } catch (e) {
      console.warn('Could not set initial time:', e);
    }
  };
  
  // Effect to ensure video loads properly
  useEffect(() => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    video.load();
    
    // Safety timeout to ensure video loads
    const timeout = setTimeout(() => {
      if (!isVideoLoaded && video) {
        console.warn('Video load timeout - forcing metadata refresh');
        setIsVideoLoaded(true);
        handleMetadataLoaded();
      }
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, [videoUrl]);
  
  // Handle seeking in the timeline
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };
  
  // Handle keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      
      switch (e.key) {
        case ' ': // Space - toggle play/pause
          e.preventDefault();
          if (isPlaying) {
            videoRef.current.pause();
          } else {
            videoRef.current.play();
          }
          dispatch(setIsPlaying(!isPlaying));
          break;
          
        case 'ArrowLeft': // Left arrow - step backward one frame
          e.preventDefault();
          // Use detected frame rate for frame stepping
          const frameStep = 1 / perfStats.nativeFrameRate;
          const prevFrame = Math.max(0, videoRef.current.currentTime - frameStep);
          videoRef.current.currentTime = prevFrame;
          dispatch(setPlayheadPosition(prevFrame));
          break;
          
        case 'ArrowRight': // Right arrow - step forward one frame
          e.preventDefault();
          // Use detected frame rate for frame stepping
          const nextFrameStep = 1 / perfStats.nativeFrameRate;
          const nextFrame = Math.min(videoDuration, videoRef.current.currentTime + nextFrameStep);
          videoRef.current.currentTime = nextFrame;
          dispatch(setPlayheadPosition(nextFrame));
          break;
          
        case 'ArrowUp': // Up arrow - set start trim to current position
          e.preventDefault();
          const newStartTime = videoRef.current.currentTime;
          // Make sure start time is before end time
          if (newStartTime < currentClip.endTime - 1) {
            dispatch(updateClipTrim({ 
              clipId: currentClip.id, 
              startTime: newStartTime 
            }));
          }
          break;
          
        case 'ArrowDown': // Down arrow - set end trim to current position
          e.preventDefault();
          const newEndTime = videoRef.current.currentTime;
          // Make sure end time is after start time
          if (newEndTime > currentClip.startTime + 1) {
            dispatch(updateClipTrim({ 
              clipId: currentClip.id, 
              endTime: newEndTime 
            }));
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentClip, isPlaying, videoDuration]);
  
  // DISABLED: Video-playhead sync loop
  // This was causing bidirectional updates and forcing 60fps renders
  // The loop worked like this: 
  // 1. RAF loop updates Redux with video.currentTime
  // 2. This hook sees Redux changed and updates video.currentTime
  // 3. This causes the video element to re-render at 60fps
  // This is unnecessary since ClipPreview doesn't do this at all
  // useEffect(() => {
  //   if (videoRef.current && videoRef.current.currentTime !== playheadPosition) {
  //     videoRef.current.currentTime = playheadPosition;
  //   }
  // }, [playheadPosition]);
  
  // EXACT reimplementation of ClipPreview's approach - verbatim from ClipPreview.tsx
  useEffect(() => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    
    // Apply hardware acceleration for smoother playback
    video.style.transform = 'translateZ(0)';
    video.style.backfaceVisibility = 'hidden';
    
    // Ensure maximum performance
    video.setAttribute('disablePictureInPicture', '');
    video.preload = 'auto';
    
    // Monitor with requestAnimationFrame
    let animationFrameId: number;
    let lastUpdate = 0;
    
    // Watch for changes and enforce boundaries
    const checkTimeInRaf = (timestamp: number) => {
      // Only check every 250ms instead of every frame
      if (timestamp - lastUpdate > 250 && video.paused === false) {
        lastUpdate = timestamp;
        
        // Update playhead position
        dispatch(setPlayheadPosition(video.currentTime));
        
        // If we've gone past the end of the clip, pause
        if (video.currentTime >= currentClip.endTime) {
          video.pause();
          dispatch(setIsPlaying(false));
          
          // Schedule the restart for smoother transition
          setTimeout(() => {
            video.currentTime = currentClip.startTime;
            dispatch(setPlayheadPosition(currentClip.startTime));
          }, 50);
        }
      }
      
      // Continue the animation loop
      animationFrameId = requestAnimationFrame(checkTimeInRaf);
    };
    
    // Start the animation frame loop
    animationFrameId = requestAnimationFrame(checkTimeInRaf);
    
    // FPS monitoring for display purposes only
    let frameCount = 0;
    let lastFpsUpdate = performance.now();
    
    const measureFps = () => {
      frameCount++;
      const now = performance.now();
      const elapsed = now - lastFpsUpdate;
      
      if (elapsed >= 1000) { // Update every second
        const fps = Math.round((frameCount * 1000) / elapsed);
        setPerfStats(prev => ({
          ...prev,
          frameCount: prev.frameCount + frameCount,
          browserFrameRate: fps,
          lastPlaybackQuality: `Using ClipPreview method: ${fps} FPS`
        }));
        
        frameCount = 0;
        lastFpsUpdate = now;
      }
      
      requestAnimationFrame(measureFps);
    };
    
    // Start the FPS monitoring
    const fpsMonitorId = requestAnimationFrame(measureFps);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      cancelAnimationFrame(fpsMonitorId);
    };
  }, [currentClip.startTime, currentClip.endTime, dispatch]);
  
  // Empty time update handler - we're using RAF instead
  const handleTimeUpdate = () => {};
  
  // Frame rate detection for frame stepping
  const [perfStats, setPerfStats] = useState({
    nativeFrameRate: 30, // Default assumption for video frame rate
  });
  

  
  // Direct copy of ClipPreview's playback approach, which is known to work well
  const playClip = () => {
    const video = videoRef.current;
    if (!video) return;
    
    // First pause any existing playback and reset
    try {
      video.pause();
      
      // Schedule seeking and playback for better performance
      setTimeout(() => {
        if (!video) return;
        
        // Set currentTime to the clip start time
        video.currentTime = currentClip.startTime;
        
        // Update Redux state *once* now, not during playback
        dispatch(setPlayheadPosition(currentClip.startTime));
        
        // Delay play slightly to ensure the seek completes
        setTimeout(() => {
          // Use the play promise properly
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                // Playback started
                dispatch(setIsPlaying(true));
                

              })
              .catch(err => {
                console.error('Failed to play clip:', err);
              });
          }
        }, 100);
      }, 50);
    } catch (err) {
      console.error('Failed to play clip:', err);
    }
  };
  
  // Simplified toggle function that uses ClipPreview's approach
  const togglePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      // Just pause
      videoRef.current.pause();
      dispatch(setIsPlaying(false));
      // Playback paused
    } else {
      // Use the ClipPreview-style playback
      playClip();
    }
  };
  
  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };
  
  // Handle save
  const handleSave = () => {
    const updatedClip = {
      ...currentClip,
      name: editedName || `Clip ${currentClip.startTime.toFixed(1)}-${currentClip.endTime.toFixed(1)}`,
      isEdited: true // Mark as edited
    };
    onSave(updatedClip);
  };
  
  // Format time as MM:SS.SS
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`;
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">Clip Editor</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Clip Name
        </label>
        <input
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          placeholder="Enter a name for this clip"
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>
      
      {/* Video player guidance */}
      <div className="mb-2 p-2 bg-blue-600 text-white rounded text-sm">
        Use the timeline below to adjust the start and end times of your clip. Use arrow keys to step frame-by-frame.
      </div>
      
      {/* Video player - EXACT MATCH of ClipPreview's structure */}
      <div className="relative mb-4">
        {!isVideoLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-80 text-white z-10">
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-8 w-8 text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading video...</span>
            </div>
          </div>
        )}
        
        {/* Video error display */}
        {videoError && (
          <div className="absolute inset-0 bg-red-800 bg-opacity-80 text-white flex flex-col items-center justify-center p-4 z-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-bold mb-1">Video Error</h3>
            <p className="text-center">{errorMessage}</p>
            <button 
              className="mt-4 bg-white text-red-800 px-4 py-1 rounded font-bold"
              onClick={() => {

                setIsVideoLoaded(false);
                setVideoError(false);
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }}
            >
              Try Reload
            </button>
          </div>
        )}

        <div className="relative">
          {/* EXACT match of ClipPreview's video element */}
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full rounded"
            muted={volume === 0}
            controls={false} /* Disable browser controls, use our own */
            playsInline
            preload="auto"
            onLoadedMetadata={handleMetadataLoaded}
            onError={handleVideoError}
          />
          
          {/* Simplified custom controls - EXACT match with ClipPreview */}
          <div className="absolute inset-0 flex flex-col justify-center items-center">
            {!isPlaying && (
              <button 
                className="bg-blue-500 bg-opacity-80 hover:bg-opacity-100 text-white rounded-full p-4 shadow-lg"
                onClick={playClip}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Time info overlay */}
          <div className="absolute bottom-3 left-0 right-0 bg-black bg-opacity-50">
            <div className="flex justify-between px-4 text-white text-sm py-2">
              <div>Start: {currentClip.startTime.toFixed(1)}s</div>
              <div>Duration: {(currentClip.endTime - currentClip.startTime).toFixed(1)}s</div>
              <div>End: {currentClip.endTime.toFixed(1)}s</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Timeline and controls */}
      <div className="mb-4">
        <VideoTimeline 
          duration={videoDuration} 
          onSeek={handleSeek}
          clipId={currentClip.id}
        />
        
        <div className="flex mt-2 items-center">
          <button 
            onClick={togglePlayPause}
            className="mr-4 p-2 bg-gray-200 rounded-full hover:bg-gray-300"
          >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          
          <button 
            onClick={() => {
              if (videoRef.current) {
                const prevFrame = Math.max(0, videoRef.current.currentTime - 1/30);
                videoRef.current.currentTime = prevFrame;
                dispatch(setPlayheadPosition(prevFrame));
              }
            }}
            className="mr-2 p-2 bg-gray-200 rounded hover:bg-gray-300"
            title="Previous frame (Left Arrow)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 7l-5 5 5 5V7z" />
            </svg>
          </button>
          
          <button 
            onClick={() => {
              if (videoRef.current) {
                const nextFrame = Math.min(videoDuration, videoRef.current.currentTime + 1/30);
                videoRef.current.currentTime = nextFrame;
                dispatch(setPlayheadPosition(nextFrame));
              }
            }}
            className="mr-4 p-2 bg-gray-200 rounded hover:bg-gray-300"
            title="Next frame (Right Arrow)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 17l5-5-5-5v10z" />
            </svg>
          </button>
          
          <button 
            onClick={() => {
              if (videoRef.current) {
                const newStartTime = videoRef.current.currentTime;
                if (newStartTime < currentClip.endTime - 1) {
                  dispatch(updateClipTrim({ 
                    clipId: currentClip.id, 
                    startTime: newStartTime 
                  }));
                }
              }
            }}
            className="mr-2 p-2 bg-blue-100 rounded hover:bg-blue-200 text-blue-700"
            title="Set start trim (Up Arrow)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14l-6-6z" />
            </svg>
          </button>
          
          <button 
            onClick={() => {
              if (videoRef.current) {
                const newEndTime = videoRef.current.currentTime;
                if (newEndTime > currentClip.startTime + 1) {
                  dispatch(updateClipTrim({ 
                    clipId: currentClip.id, 
                    endTime: newEndTime 
                  }));
                }
              }
            }}
            className="mr-4 p-2 bg-blue-100 rounded hover:bg-blue-200 text-blue-700"
            title="Set end trim (Down Arrow)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 16l-6-6 1.41-1.41L12 13.17l4.59-4.58L18 10l-6 6z" />
            </svg>
          </button>
          
          {/* Volume control */}
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600 mr-2">
              {volume === 0 ? (
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              ) : volume <= 0.5 ? (
                <path d="M5 9v6h4l5 5V4L9 9H5zm9.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              ) : (
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              )}
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20"
            />
          </div>
        </div>
      </div>
      
      {/* Keyboard shortcuts guide */}
      <div className="mb-6 bg-gray-100 p-3 rounded text-sm">
        <h3 className="font-medium mb-2">Keyboard Shortcuts:</h3>
        <ul className="grid grid-cols-2 gap-2">
          <li>Space: Play/Pause</li>
          <li>← Arrow: Previous Frame</li>
          <li>→ Arrow: Next Frame</li>
          <li>↑ Arrow: Set Start Trim</li>
          <li>↓ Arrow: Set End Trim</li>
        </ul>
      </div>
      
      {/* Action buttons */}
      <div className="flex justify-end space-x-3">
        <Button 
          onClick={onCancel}
          variant="secondary"
        >
          Cancel
        </Button>
        
        <Button 
          onClick={handleSave}
          variant="primary"
        >
          Save Clip
        </Button>
      </div>
    </div>
  );
};

export default ClipEditor;
