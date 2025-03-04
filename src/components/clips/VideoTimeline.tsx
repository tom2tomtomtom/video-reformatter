import React, { useRef, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { setPlayheadPosition, updateClipTrim } from '../../store/slices/clipSlice';

interface VideoTimelineProps {
  duration: number; // Video duration in seconds
  thumbnails?: string[]; // Optional array of thumbnail URLs
  onSeek: (time: number) => void; // Callback when user seeks to a specific time
  clipId?: string; // ID of the current clip being edited
}

const VideoTimeline: React.FC<VideoTimelineProps> = ({ 
  duration, 
  thumbnails = [], 
  onSeek,
  clipId
}) => {
  const dispatch = useDispatch();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isDraggingStartTrim, setIsDraggingStartTrim] = useState(false);
  const [isDraggingEndTrim, setIsDraggingEndTrim] = useState(false);
  
  const playheadPosition = useSelector((state: RootState) => state.clips.playheadPosition);
  const isPlaying = useSelector((state: RootState) => state.clips.isPlaying);
  
  // Get current clip if we have a clipId
  const currentClip = useSelector((state: RootState) => {
    if (!clipId) return null;
    return state.clips.detectedClips.find(clip => clip.id === clipId) || null;
  });
  
  // Convert time in seconds to position percentage
  const timeToPercent = (time: number): number => {
    return (time / duration) * 100;
  };
  
  // Convert position percentage to time in seconds
  const percentToTime = (percent: number): number => {
    return (percent / 100) * duration;
  };
  
  // Handle timeline click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const percentClicked = (clickPosition / rect.width) * 100;
    const timeClicked = percentToTime(percentClicked);
    
    // Update playhead position
    dispatch(setPlayheadPosition(timeClicked));
    onSeek(timeClicked);
  };
  
  // Handle mouse move for dragging
  const handleMouseMove = (e: MouseEvent) => {
    if (!timelineRef.current || (!isDraggingPlayhead && !isDraggingStartTrim && !isDraggingEndTrim)) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const position = e.clientX - rect.left;
    const percentPos = (position / rect.width) * 100;
    const timeSec = percentToTime(Math.max(0, Math.min(percentPos, 100)));
    
    if (isDraggingPlayhead) {
      dispatch(setPlayheadPosition(timeSec));
      onSeek(timeSec);
    } else if (isDraggingStartTrim && clipId) {
      const maxTime = currentClip ? currentClip.endTime - 1 : duration;
      const constrainedTime = Math.min(timeSec, maxTime);
      dispatch(updateClipTrim({ clipId, startTime: constrainedTime }));
    } else if (isDraggingEndTrim && clipId) {
      const minTime = currentClip ? currentClip.startTime + 1 : 0;
      const constrainedTime = Math.max(timeSec, minTime);
      dispatch(updateClipTrim({ clipId, endTime: constrainedTime }));
    }
  };
  
  // Handle mouse up to stop dragging
  const handleMouseUp = () => {
    setIsDraggingPlayhead(false);
    setIsDraggingStartTrim(false);
    setIsDraggingEndTrim(false);
  };
  
  // Set up mouse move and mouse up listeners
  useEffect(() => {
    if (isDraggingPlayhead || isDraggingStartTrim || isDraggingEndTrim) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, isDraggingStartTrim, isDraggingEndTrim]);
  
  // Format time as MM:SS.SS
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`;
  };
  
  return (
    <div className="w-full">
      <div className="relative h-28 bg-gray-200 rounded overflow-hidden" ref={timelineRef} onClick={handleTimelineClick}>
        {/* Timeline thumbnails (would require actual implementation) */}
        <div className="absolute top-0 left-0 h-20 w-full flex">
          {thumbnails.length > 0 ? (
            thumbnails.map((thumb, index) => (
              <img 
                key={index} 
                src={thumb} 
                alt={`Frame ${index}`}
                className="h-full"
                style={{ objectFit: 'cover' }}
              />
            ))
          ) : (
            // Display time markers if no thumbnails
            Array.from({ length: 10 }).map((_, index) => (
              <div 
                key={index} 
                className="h-full flex-1 border-r border-gray-300 flex items-end justify-center pb-1"
              >
                <span className="text-xs text-gray-500">
                  {formatTime((duration / 10) * index)}
                </span>
              </div>
            ))
          )}
        </div>
        
        {/* Clip region highlight if we have a current clip */}
        {currentClip && (
          <div 
            className="absolute h-full bg-blue-100 opacity-60 pointer-events-none"
            style={{
              left: `${timeToPercent(currentClip.startTime)}%`,
              width: `${timeToPercent(currentClip.endTime - currentClip.startTime)}%`
            }}
          />
        )}
        
        {/* Playhead */}
        <div 
          className="absolute top-0 h-full w-0.5 bg-red-500 z-10 cursor-ew-resize"
          style={{ left: `${timeToPercent(playheadPosition)}%` }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDraggingPlayhead(true);
          }}
        >
          <div className="absolute -left-1.5 top-0 w-4 h-4 bg-red-500 rounded-full" />
        </div>
        
        {/* Start trim handle */}
        {currentClip && (
          <div
            className="absolute top-0 h-full w-1 bg-blue-600 z-20 cursor-ew-resize"
            style={{ left: `${timeToPercent(currentClip.startTime)}%` }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsDraggingStartTrim(true);
            }}
          >
            <div className="absolute -left-1.5 top-1/2 transform -translate-y-1/2 w-4 h-8 bg-blue-600 rounded" />
          </div>
        )}
        
        {/* End trim handle */}
        {currentClip && (
          <div
            className="absolute top-0 h-full w-1 bg-blue-600 z-20 cursor-ew-resize"
            style={{ left: `${timeToPercent(currentClip.endTime)}%` }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsDraggingEndTrim(true);
            }}
          >
            <div className="absolute -left-1.5 top-1/2 transform -translate-y-1/2 w-4 h-8 bg-blue-600 rounded" />
          </div>
        )}
      </div>
      
      {/* Time display */}
      <div className="flex justify-between mt-2 text-sm">
        <span>00:00.00</span>
        <span>
          {currentClip ? (
            <span className="text-blue-600 font-medium">
              Duration: {formatTime(currentClip.endTime - currentClip.startTime)}
            </span>
          ) : (
            <span>Current: {formatTime(playheadPosition)}</span>
          )}
        </span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};

export default VideoTimeline;
