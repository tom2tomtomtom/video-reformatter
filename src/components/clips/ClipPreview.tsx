import React, { useRef, useEffect, useState } from 'react';
import { ClipSegment } from '../../services/ClipDetectionService';

interface ClipPreviewProps {
  videoUrl: string;
  clip: ClipSegment;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
}

const ClipPreview: React.FC<ClipPreviewProps> = ({
  videoUrl,
  clip,
  autoPlay = false,
  muted = true,
  controls = true,
  loop = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Set up the clip playback boundaries
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Start at the clip's start time
    videoElement.currentTime = clip.startTime;

    // Event listener for time updates to handle clip boundaries
    const handleTimeUpdate = () => {
      // If we've reached the end of the clip, reset to beginning
      if (videoElement.currentTime >= clip.endTime) {
        if (loop) {
          videoElement.currentTime = clip.startTime;
        } else {
          videoElement.pause();
        }
      }
    };

    // Event listener for seeking to ensure we stay within clip boundaries
    const handleSeeking = () => {
      // If seeking outside of clip boundaries, reset to clip start or end
      if (videoElement.currentTime < clip.startTime) {
        videoElement.currentTime = clip.startTime;
      } else if (videoElement.currentTime > clip.endTime) {
        videoElement.currentTime = clip.endTime;
      }
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('seeking', handleSeeking);

    // Clean up event listeners
    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('seeking', handleSeeking);
    };
  }, [clip, loop]);

  // Handle errors
  const handleError = () => {
    setError('Error loading video preview');
  };

  return (
    <div className="relative">
      {error ? (
        <div className="bg-red-100 text-red-700 p-3 rounded">
          {error}
        </div>
      ) : (
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full rounded"
          muted={muted}
          controls={controls}
          autoPlay={autoPlay}
          onError={handleError}
          playsInline
        />
      )}
      <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
        {(clip.endTime - clip.startTime).toFixed(1)}s
      </div>
    </div>
  );
};

export default ClipPreview;
