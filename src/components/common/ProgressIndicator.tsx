import React from 'react';

interface ProgressIndicatorProps {
  percentComplete: number;
  currentFrame: number;
  totalFrames: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  percentComplete,
  currentFrame,
  totalFrames,
  elapsedTime,
  estimatedTimeRemaining
}) => {
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full">
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-gray-700">Scanning video...</span>
        <span className="text-gray-700">{Math.round(percentComplete)}%</span>
      </div>
      
      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${percentComplete}%` }}
        />
      </div>
      
      <div className="mt-2 text-xs text-gray-600 grid grid-cols-2 gap-2">
        <div>
          <span className="font-medium">Frame: </span>
          {currentFrame}/{totalFrames}
        </div>
        <div>
          <span className="font-medium">Elapsed Time: </span>
          {formatTime(elapsedTime)}
        </div>
        <div>
          <span className="font-medium">Est. Remaining: </span>
          {formatTime(estimatedTimeRemaining)}
        </div>
        <div>
          <span className="font-medium">Frames/sec: </span>
          {elapsedTime > 0 ? (currentFrame / elapsedTime).toFixed(1) : '0.0'}
        </div>
      </div>
    </div>
  );
};

export default ProgressIndicator;
