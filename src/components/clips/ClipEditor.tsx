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
  
  // Set initial playhead position to clip start time
  useEffect(() => {
    dispatch(setPlayheadPosition(currentClip.startTime));
    if (videoRef.current) {
      videoRef.current.currentTime = currentClip.startTime;
    }
  }, [currentClip.id]);
  
  // Handle metadata loaded - set video duration
  const handleMetadataLoaded = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };
  
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
          // Assuming 30fps for frame stepping
          const prevFrame = Math.max(0, videoRef.current.currentTime - 1/30);
          videoRef.current.currentTime = prevFrame;
          dispatch(setPlayheadPosition(prevFrame));
          break;
          
        case 'ArrowRight': // Right arrow - step forward one frame
          e.preventDefault();
          // Assuming 30fps for frame stepping
          const nextFrame = Math.min(videoDuration, videoRef.current.currentTime + 1/30);
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
  
  // Sync video with playhead
  useEffect(() => {
    if (videoRef.current && videoRef.current.currentTime !== playheadPosition) {
      videoRef.current.currentTime = playheadPosition;
    }
  }, [playheadPosition]);
  
  // Handle video time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      
      // Update playhead position if it differs significantly from current time
      if (Math.abs(currentTime - playheadPosition) > 0.1) {
        dispatch(setPlayheadPosition(currentTime));
      }
      
      // Check if we reached the clip end during playback
      if (isPlaying && currentTime >= currentClip.endTime) {
        videoRef.current.pause();
        videoRef.current.currentTime = currentClip.startTime;
        dispatch(setPlayheadPosition(currentClip.startTime));
        dispatch(setIsPlaying(false));
      }
    }
  };
  
  // Toggle play/pause
  const togglePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      // If we're at or past the clip end, loop back to start
      if (videoRef.current.currentTime >= currentClip.endTime) {
        videoRef.current.currentTime = currentClip.startTime;
        dispatch(setPlayheadPosition(currentClip.startTime));
      }
      videoRef.current.play();
    }
    
    dispatch(setIsPlaying(!isPlaying));
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
      name: editedName || `Clip ${currentClip.startTime.toFixed(1)}-${currentClip.endTime.toFixed(1)}`
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
      
      {/* Video player */}
      <div className="mb-4 bg-black relative" style={{ aspectRatio: '16/9' }}>
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleMetadataLoaded}
          muted={volume === 0}
        />
        
        {/* Play/pause overlay */}
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePlayPause}
        >
          {!isPlaying && (
            <div className="bg-white bg-opacity-50 rounded-full p-4">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="currentColor"
                className="text-gray-800"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </div>
        
        {/* Time indicator */}
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
          {formatTime(playheadPosition)} / {formatTime(videoDuration)}
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
