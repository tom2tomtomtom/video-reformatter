import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import Button from '../components/common/Button';
import ClipList from '../components/clips/ClipList';
import ClipEditor from '../components/clips/ClipEditor';
import clipDetectionService, { ClipSegment, DetectionOptions } from '../services/ClipDetectionService';
import { 
  setDetectedClips, 
  setIsDetecting, 
  setError, 
  setCurrentClip,
  clearSelectedClips,
  createClipBatch
} from '../store/slices/clipSlice';

const ClipDetection: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { url, videoId } = useSelector((state: RootState) => state.video);
  const { 
    detectedClips, 
    selectedClips, 
    currentClipId, 
    isDetecting, 
    error 
  } = useSelector((state: RootState) => state.clips);
  
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [batchName, setBatchName] = useState('');
  const [detectionCompleted, setDetectionCompleted] = useState(false);
  const [detectionOptions, setDetectionOptions] = useState<DetectionOptions>({
    minClipDuration: 8,
    maxClipDuration: 15,
    sceneChangeThreshold: 30,
    audioSilenceThreshold: -40,
    silenceDuration: 0.3
  });
  
  // Check if we have a video to work with
  useEffect(() => {
    if (!url) {
      // We need to go back to the upload page
      navigate('/');
    }
  }, [url, navigate]);
  
  // Handle starting the clip detection process
  const handleDetectClips = async () => {
    if (!url) return;
    
    try {
      dispatch(setIsDetecting(true));
      dispatch(setError(null));
      setDetectionProgress(0);
      setDetectionCompleted(false);
      
      const clips = await clipDetectionService.detectClips(url, {
        ...detectionOptions,
        onProgress: (progress) => {
          setDetectionProgress(progress);
        }
      });
      
      dispatch(setDetectedClips(clips));
      setDetectionProgress(100);
      setDetectionCompleted(true);
    } catch (error) {
      console.error('Error detecting clips:', error);
      dispatch(setError(`Failed to detect clips: ${error}`));
    } finally {
      dispatch(setIsDetecting(false));
    }
  };
  
  // Handle editing a specific clip
  const handleEditClip = (clipId: string) => {
    dispatch(setCurrentClip(clipId));
  };
  
  // Handle saving an edited clip
  const handleSaveClip = (updatedClip: ClipSegment) => {
    // Find and replace the clip in detectedClips
    const updatedClips = detectedClips.map(clip => 
      clip.id === updatedClip.id ? updatedClip : clip
    );
    
    dispatch(setDetectedClips(updatedClips));
    
    // Update in selectedClips if it's there
    if (selectedClips.some(clip => clip.id === updatedClip.id)) {
      const updatedSelected = selectedClips.map(clip => 
        clip.id === updatedClip.id ? updatedClip : clip
      );
      
      // Clear and re-add all selected clips (to ensure they're updated)
      dispatch(clearSelectedClips());
      updatedSelected.forEach(clip => {
        dispatch({ type: 'clips/addSelectedClip', payload: clip });
      });
    }
    
    // Clear current clip
    dispatch(setCurrentClip(null));
  };
  
  // Handle creating a batch for reformatting
  const handleCreateBatch = () => {
    if (selectedClips.length === 0) {
      alert("Please select at least one clip to continue.");
      return;
    }
    
    const name = batchName || `Batch ${new Date().toLocaleString()}`;
    dispatch(createClipBatch({
      name,
      clips: selectedClips
    }));
    
    // Navigate to editor for object tracking
    navigate('/editor');
  };
  
  // Get the current clip being edited, if any
  const currentClip = currentClipId ? detectedClips.find(c => c.id === currentClipId) : null;
  
  // If we don't have a video URL, show a placeholder message
  if (!url) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-6">No Video Loaded</h1>
        <p className="text-gray-600 mb-6">Please upload a video before using the clip detection feature.</p>
        <Button onClick={() => navigate('/')} variant="primary">
          Go to Upload
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Clip Finder & Editor</h1>
        
        {/* Show clip editor if a clip is selected, otherwise show main interface */}
        {currentClip ? (
          <ClipEditor 
            videoUrl={url}
            currentClip={currentClip}
            onSave={handleSaveClip}
            onCancel={() => dispatch(setCurrentClip(null))}
          />
        ) : (
          <>
            {/* Detection controls */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">Step 1: Find Perfect Clips</h2>
              
              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                  {error}
                </div>
              )}
              
              <div className="mb-4">
                <p className="text-gray-600 mb-4">
                  This tool automatically detects coherent segments in your video by analyzing scene changes and audio cues. Adjust the options below to customize the detection process.
                </p>
                
                {!isDetecting && !detectionCompleted && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min Clip Duration (seconds)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={detectionOptions.minClipDuration}
                        onChange={(e) => setDetectionOptions({
                          ...detectionOptions,
                          minClipDuration: parseInt(e.target.value)
                        })}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Clip Duration (seconds)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={detectionOptions.maxClipDuration}
                        onChange={(e) => setDetectionOptions({
                          ...detectionOptions,
                          maxClipDuration: parseInt(e.target.value)
                        })}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Scene Change Sensitivity
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="50"
                        value={detectionOptions.sceneChangeThreshold}
                        onChange={(e) => setDetectionOptions({
                          ...detectionOptions,
                          sceneChangeThreshold: parseInt(e.target.value)
                        })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Less sensitive</span>
                        <span>More sensitive</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {isDetecting && (
                  <div className="mb-6">
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                      <div
                        className="bg-blue-600 h-4 rounded-full" 
                        style={{ width: `${detectionProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-center text-sm text-gray-500">
                      <span className="font-medium">Analyzing video...</span> {detectionProgress}%
                    </p>
                    <div className="mt-4 text-center text-sm text-gray-500">
                      <p>This process analyzes your video to find:</p>
                      <ul className="list-disc list-inside mt-2">
                        <li>Scene changes based on visual differences</li>
                        <li>Audio cues such as silence or volume changes</li>
                        <li>Natural breakpoints for coherent clips</li>
                      </ul>
                    </div>
                  </div>
                )}
                
                {detectionCompleted && (
                  <div className="p-4 bg-green-50 text-green-700 rounded-md mb-4">
                    <p className="font-medium">Analysis Complete!</p>
                    <p className="text-sm mt-1">We found {detectedClips.length} potential clips in your video. You can preview and edit them below.</p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-center">
                <Button
                  onClick={handleDetectClips}
                  disabled={isDetecting}
                  variant="primary"
                  size="lg"
                >
                  {isDetecting ? 'Analyzing...' : detectedClips.length > 0 ? 'Re-analyze Video' : 'Find Clips'}
                </Button>
              </div>
            </div>
            
            {/* Two-column layout for clips list and clip details */}
            {detectedClips.length > 0 && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold mb-4">Step 2: Preview & Edit Clips</h2>
                  <p className="text-gray-600">
                    Preview your detected clips below. Click "Show Preview" to watch each clip, or "Edit" to fine-tune with frame-by-frame controls.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Clip list */}
                  <div className="lg:col-span-2">
                    <ClipList
                      clips={detectedClips}
                      selectedClips={selectedClips}
                      onEditClip={handleEditClip}
                      videoUrl={url}
                    />
                  </div>
                  
                  {/* Selection summary and batch creation */}
                  <div>
                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <h2 className="text-xl font-bold mb-4">Step 3: Process Selected Clips</h2>
                      
                      {selectedClips.length === 0 ? (
                        <p className="text-gray-500 mb-4">
                          No clips selected. Choose clips from the list to create a batch for reformatting.
                        </p>
                      ) : (
                        <>
                          <div className="mb-4">
                            <p className="text-gray-600 mb-2">
                              <span className="font-medium">{selectedClips.length} clip{selectedClips.length !== 1 ? 's' : ''} selected</span> for further processing:
                            </p>
                            <ul className="text-sm text-gray-500 list-disc list-inside max-h-40 overflow-y-auto">
                              {selectedClips.map(clip => (
                                <li key={clip.id}>
                                  {clip.name || `Clip ${clip.startTime.toFixed(1)}-${clip.endTime.toFixed(1)}`}
                                  {' '}
                                  ({(clip.endTime - clip.startTime).toFixed(1)}s)
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Batch Name (Optional)
                            </label>
                            <input
                              type="text"
                              value={batchName}
                              onChange={(e) => setBatchName(e.target.value)}
                              placeholder="Enter a name for this batch"
                              className="w-full p-2 border border-gray-300 rounded"
                            />
                          </div>
                          
                          <div className="bg-yellow-50 p-3 rounded-md mb-4">
                            <p className="text-sm text-yellow-700">
                              <span className="font-medium">Next Step:</span> Send these clips to the object tracking
                              stage where you'll identify important subjects in each clip for optimal reformatting.
                            </p>
                          </div>
                          
                          <Button
                            onClick={handleCreateBatch}
                            variant="primary"
                            fullWidth
                          >
                            Continue to Object Tracking
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ClipDetection;
