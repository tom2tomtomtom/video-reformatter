import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { ClipSegment } from '../../services/ClipDetectionService';
import { addSelectedClip, removeSelectedClip, setCurrentClip } from '../../store/slices/clipSlice';
import Button from '../common/Button';
import ClipPreview from './ClipPreview';

interface ClipListProps {
  clips: ClipSegment[];
  selectedClips: ClipSegment[];
  onEditClip: (clipId: string) => void;
  videoUrl: string;
}

const ClipList: React.FC<ClipListProps> = ({ 
  clips, 
  selectedClips,
  onEditClip,
  videoUrl
}) => {
  const dispatch = useDispatch();
  const [expandedClipId, setExpandedClipId] = useState<string | null>(null);
  
  // Check if a clip is selected
  const isSelected = (clipId: string): boolean => {
    return selectedClips.some(clip => clip.id === clipId);
  };
  
  // Format time as MM:SS.SS
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`;
  };
  
  // Toggle clip selection
  const toggleSelection = (clip: ClipSegment) => {
    if (isSelected(clip.id)) {
      dispatch(removeSelectedClip(clip.id));
    } else {
      dispatch(addSelectedClip(clip));
    }
  };

  // Toggle clip expanded view
  const toggleExpandedView = (clipId: string) => {
    if (expandedClipId === clipId) {
      setExpandedClipId(null);
    } else {
      setExpandedClipId(clipId);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-lg font-bold">Detected Clips</h2>
        <p className="text-sm text-gray-500">
          {clips.length} potential clips found. 
          {selectedClips.length > 0 && ` ${selectedClips.length} selected.`}
        </p>
      </div>
      
      {clips.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-gray-500">No clips detected yet. Start by processing your video.</p>
        </div>
      ) : (
        <div className="p-2 max-h-[600px] overflow-y-auto">
          {clips.map(clip => {
            const duration = clip.endTime - clip.startTime;
            const selected = isSelected(clip.id);
            const clipName = clip.name || `Clip ${formatTime(clip.startTime)} - ${formatTime(clip.endTime)}`;
            const isExpanded = expandedClipId === clip.id;
            
            return (
              <div 
                key={clip.id}
                className={`mb-3 p-3 rounded-lg border ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} transition-colors`}
              >
                <div className="flex items-start">
                  {/* Thumbnail */}
                  <div 
                    className="w-24 h-16 bg-gray-200 flex-shrink-0 rounded overflow-hidden mr-3 cursor-pointer"
                    onClick={() => toggleExpandedView(clip.id)}
                    style={{ 
                      backgroundImage: clip.thumbnail ? `url(${clip.thumbnail})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    {!clip.thumbnail && (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-grow">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{clipName}</h3>
                        <p className="text-sm text-gray-500">
                          Duration: {formatTime(duration)} ({duration.toFixed(1)}s)
                        </p>
                      </div>
                      
                      <input 
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelection(clip)}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                    
                    <div className="mt-2 flex justify-between">
                      <div className="text-xs text-gray-500">
                        <span className="mr-2">{formatTime(clip.startTime)}</span>
                        <span>→</span>
                        <span className="ml-2">{formatTime(clip.endTime)}</span>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleExpandedView(clip.id)}
                        >
                          {isExpanded ? 'Hide Preview' : 'Show Preview'}
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onEditClip(clip.id)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded preview area */}
                {isExpanded && (
                  <div className="mt-3 border-t pt-3">
                    <div className="aspect-video">
                      <ClipPreview
                        videoUrl={videoUrl}
                        clip={clip}
                        controls={true}
                        autoPlay={true}
                        muted={true}
                      />
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onEditClip(clip.id)}
                      >
                        Edit This Clip
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {clips.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">
              {selectedClips.length} of {clips.length} clips selected
            </span>
            
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (selectedClips.length === clips.length) {
                    // Deselect all
                    selectedClips.forEach(clip => {
                      dispatch(removeSelectedClip(clip.id));
                    });
                  } else {
                    // Select all
                    clips.forEach(clip => {
                      if (!isSelected(clip.id)) {
                        dispatch(addSelectedClip(clip));
                      }
                    });
                  }
                }}
              >
                {selectedClips.length === clips.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClipList;
