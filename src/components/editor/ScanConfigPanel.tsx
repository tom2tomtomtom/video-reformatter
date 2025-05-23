import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { updateScanOptions } from '../../store/slices/videoScanSlice';

const ScanConfigPanel: React.FC = () => {
  const dispatch = useDispatch();
  const { scanOptions } = useSelector((state: RootState) => state.videoScan);
  
  // Handle changes to scan interval
  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      dispatch(updateScanOptions({ interval: value }));
    }
  };
  
  // Handle changes to minimum score threshold
  const handleMinScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 1) {
      dispatch(updateScanOptions({ minScore: value }));
    }
  };
  
  // Handle changes to similarity threshold
  const handleSimilarityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 1) {
      dispatch(updateScanOptions({ similarityThreshold: value }));
    }
  };
  
  // Handle changes to minimum detections
  const handleMinDetectionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      dispatch(updateScanOptions({ minDetections: value }));
    }
  };
  
  return (
    <div className="bg-gray-50 p-3 rounded-md border mb-4">
      <h4 className="text-sm font-medium text-gray-800 mb-2">
        Scan Configuration
      </h4>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="interval" className="block text-xs text-gray-600 mb-1">
            Sampling Interval (seconds)
          </label>
          <input
            id="interval"
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={scanOptions.interval}
            onChange={handleIntervalChange}
            className="w-full p-2 text-sm border rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">
            Time between sampled frames (smaller = more accurate, slower)
          </p>
        </div>
        
        <div>
          <label htmlFor="minScore" className="block text-xs text-gray-600 mb-1">
            Minimum Confidence Score (0-1)
          </label>
          <input
            id="minScore"
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={scanOptions.minScore}
            onChange={handleMinScoreChange}
            className="w-full p-2 text-sm border rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">
            Minimum confidence for subject detection
          </p>
        </div>
        
        <div>
          <label htmlFor="similarity" className="block text-xs text-gray-600 mb-1">
            Subject Tracking Threshold (0-1)
          </label>
          <input
            id="similarity"
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={scanOptions.similarityThreshold}
            onChange={handleSimilarityChange}
            className="w-full p-2 text-sm border rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">
            Threshold for tracking the same subject across frames
          </p>
        </div>
        
        <div>
          <label htmlFor="minDetections" className="block text-xs text-gray-600 mb-1">
            Minimum Detections
          </label>
          <input
            id="minDetections"
            type="number"
            min="1"
            max="20"
            step="1"
            value={scanOptions.minDetections}
            onChange={handleMinDetectionsChange}
            className="w-full p-2 text-sm border rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">
            Minimum number of frames a subject must appear in
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScanConfigPanel;
