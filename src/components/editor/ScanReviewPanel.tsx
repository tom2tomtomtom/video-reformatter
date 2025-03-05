import React, { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { 
  acceptSubject, 
  rejectSubject, 
  acceptAllSubjects, 
  rejectAllSubjects,
  exitReviewMode
} from '../../store/slices/videoScanSlice';
import { addFocusPoint } from '../../store/slices/focusPointsSlice';
import { setCurrentTime } from '../../store/slices/videoSlice';
import { Subject } from '../../services/ImprovedVideoScannerService';
import Button from '../common/Button';

interface SubjectCardProps {
  subject: Subject;
  isAccepted: boolean;
  isRejected: boolean;
  onPreview: () => void;
  onAccept: () => void;
  onReject: () => void;
}

const SubjectCard: React.FC<SubjectCardProps> = ({
  subject,
  isAccepted,
  isRejected,
  onPreview,
  onAccept,
  onReject
}) => {
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate confidence as percentage
  const confidence = Math.round(subject.positions[0].score * 100);
  
  // Status class
  let statusClass = 'bg-white hover:bg-gray-50 border-gray-200';
  if (isAccepted) statusClass = 'bg-green-50 hover:bg-green-100 border-green-300';
  if (isRejected) statusClass = 'bg-red-50 hover:bg-red-100 border-red-300';
  
  return (
    <div 
      className={`border rounded-md ${statusClass} overflow-hidden transition-colors`}
    >
      <div className="p-3">
        <div className="flex justify-between items-start">
          <div onClick={onPreview} className="cursor-pointer flex-grow">
            <div className="font-medium text-gray-900">
              {subject.class}
            </div>
            <div className="text-sm text-gray-600">
              Time: {formatTime(subject.firstSeen)} - {formatTime(subject.lastSeen)}
            </div>
            <div className="text-sm text-gray-600">
              Confidence: {confidence}%
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={onAccept}
              disabled={isAccepted}
              className={`px-2 py-1 text-xs rounded ${isAccepted ? 'bg-green-500 text-white' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}
            >
              Accept
            </button>
            <button
              onClick={onReject}
              disabled={isRejected}
              className={`px-2 py-1 text-xs rounded ${isRejected ? 'bg-red-500 text-white' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};



const ScanReviewPanel: React.FC<{
  onFinishReview: () => void;
}> = ({ onFinishReview }) => {
  const dispatch = useDispatch();
  const { detectedSubjects, acceptedSubjectsIds, rejectedSubjectsIds } = useSelector(
    (state: RootState) => state.videoScan
  );
  
  // Find the video element to preview subjects
  const videoElement = document.querySelector('video') as HTMLVideoElement;
  
  const handleAccept = (subjectId: string) => {
    dispatch(acceptSubject(subjectId));
  };
  
  const handleReject = (subjectId: string) => {
    dispatch(rejectSubject(subjectId));
  };
  
  const handleAcceptAll = () => {
    dispatch(acceptAllSubjects());
  };
  
  const handleRejectAll = () => {
    dispatch(rejectAllSubjects());
  };
  
  // Keep track of selected subject
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  
  // Ref for the overlay element
  const overlayRef = useRef<HTMLDivElement | null>(null);
  
  // Track which specific position is being viewed (to show the correct frame)
  const [selectedPosition, setSelectedPosition] = useState<number>(0);
  
  const handlePreview = (subject: Subject) => {
    if (videoElement && subject.positions && subject.positions.length > 0) {
      // Get the position we want to show (first position by default)
      const positionIndex = 0;
      const position = subject.positions[positionIndex];
      
      // Pause video and set to specific time
      videoElement.pause();
      videoElement.currentTime = position.time;
      console.log(`Seeking to specific frame at time: ${position.time}s for object: ${subject.class}`);
      
      // Prevent seeking back by updating Redux state
      dispatch(setCurrentTime(position.time));
      
      // Remember which position we're showing
      setSelectedPosition(positionIndex);
      
      // Mark this subject as selected
      setSelectedSubject(subject);
      
      // Create overlay if it doesn't exist
      if (!overlayRef.current) {
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.border = '3px solid #22c55e'; // Green border
        overlay.style.borderRadius = '2px';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '10';
        overlay.style.transition = 'all 0.2s ease-in-out';
        
        // Add label
        const label = document.createElement('div');
        label.style.position = 'absolute';
        label.style.top = '-24px';
        label.style.left = '0';
        label.style.padding = '2px 6px';
        label.style.backgroundColor = '#22c55e';
        label.style.color = 'white';
        label.style.fontSize = '12px';
        label.style.borderRadius = '2px';
        overlay.appendChild(label);
        
        // Add the overlay to the video container
        const videoContainer = videoElement.parentElement;
        if (videoContainer) {
          videoContainer.style.position = 'relative';
          videoContainer.appendChild(overlay);
          overlayRef.current = overlay;
        }
      }
      
      // Position overlay to match the object's bounding box
      updateOverlayPosition(subject, selectedPosition);
    }
  };
  
  // Update overlay when selected subject changes
  useEffect(() => {
    if (selectedSubject && videoElement) {
      // Add event listener for when the video has been seeked
      const onSeeked = () => {
        // Position overlay once the seek completes
        if (selectedSubject) {
          updateOverlayPosition(selectedSubject, selectedPosition);
        }
      };
      
      videoElement.addEventListener('seeked', onSeeked);
      
      return () => {
        videoElement.removeEventListener('seeked', onSeeked);
      };
    } else {
      // Hide overlay if no subject is selected
      if (overlayRef.current) {
        overlayRef.current.style.display = 'none';
      }
    }
  }, [selectedSubject, videoElement, selectedPosition]);
  
  // Helper function to update the overlay position
  const updateOverlayPosition = (subject: Subject, posIndex: number) => {
    if (!overlayRef.current || !videoElement || !subject.positions || subject.positions.length === 0) {
      return;
    }
    
    try {
      const position = subject.positions[posIndex];
      if (!position || !position.bbox || position.bbox.length !== 4) {
        console.warn('Invalid position data');
        return;
      }
      
      const [x, y, width, height] = position.bbox;
      
      // Get video dimensions
      const videoWidth = videoElement.videoWidth || 1920;
      const videoHeight = videoElement.videoHeight || 1080;
      const videoClientWidth = videoElement.clientWidth;
      const videoClientHeight = videoElement.clientHeight;
      
      if (!videoClientWidth || !videoClientHeight) {
        return;
      }
      
      // Calculate scale factors
      const scaleX = videoClientWidth / videoWidth;
      const scaleY = videoClientHeight / videoHeight;
      
      // Scale coordinates
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      const scaledWidth = width * scaleX;
      const scaledHeight = height * scaleY;
      
      // Position the overlay
      overlayRef.current.style.left = `${scaledX}px`;
      overlayRef.current.style.top = `${scaledY}px`;
      overlayRef.current.style.width = `${scaledWidth}px`;
      overlayRef.current.style.height = `${scaledHeight}px`;
      
      // Update label
      const label = overlayRef.current.firstChild as HTMLDivElement;
      if (label) {
        label.textContent = `${subject.class} (${Math.round(position.score * 100)}%)`;
      }
      
      // Make sure overlay is visible
      overlayRef.current.style.display = 'block';
    } catch (error) {
      console.error('Error updating overlay position:', error);
    }
  };
  
  // Clean up overlay when exiting review mode
  useEffect(() => {
    return () => {
      if (overlayRef.current && overlayRef.current.parentElement) {
        overlayRef.current.parentElement.removeChild(overlayRef.current);
        overlayRef.current = null;
      }
    };
  }, []);
  
  const handleFinalize = () => {
    // Create focus points from accepted subjects
    detectedSubjects.forEach(subject => {
      if (acceptedSubjectsIds.includes(subject.id)) {
        // Get the first position (most confident detection)
        const position = subject.positions[0];
        const [x, y, width, height] = position.bbox;
        
        // Calculate center points (normalized 0-1)
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        
        // Create a focus point
        const focusPoint = {
          id: subject.id,
          timeStart: subject.firstSeen,
          timeEnd: subject.lastSeen,
          x: centerX, // Normalized 0-1 value
          y: centerY, // Normalized 0-1 value
          width: width,
          height: height,
          description: subject.class
        };
        
        dispatch(addFocusPoint(focusPoint));
      }
    });
    
    // Exit review mode
    dispatch(exitReviewMode());
    
    // Call the onFinalize callback
    onFinishReview();
  };
  
  return (
    <div className="mb-6 p-4 bg-gray-50 border border-gray-300 rounded-md">
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">Review Detected Subjects</h3>
        <p className="text-sm text-gray-600 mb-2">
          {detectedSubjects.length} subjects detected. Click to preview on video.
        </p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          <Button onClick={handleAcceptAll} variant="success" size="sm">
            Accept All
          </Button>
          <Button onClick={handleRejectAll} variant="danger" size="sm">
            Reject All
          </Button>
          <Button onClick={handleFinalize} variant="primary" size="sm">
            Finalize
          </Button>
          <Button onClick={() => dispatch(exitReviewMode())} variant="secondary" size="sm">
            Cancel
          </Button>
        </div>
      </div>
      
      <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
        <div className="space-y-2">
          {detectedSubjects.map(subject => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              isAccepted={acceptedSubjectsIds.includes(subject.id)}
              isRejected={rejectedSubjectsIds.includes(subject.id)}
              onAccept={() => handleAccept(subject.id)}
              onReject={() => handleReject(subject.id)}
              onPreview={() => handlePreview(subject)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScanReviewPanel;
