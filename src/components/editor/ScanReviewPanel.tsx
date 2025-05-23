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
import { Subject } from '../../services/VideoScannerService';
import Button from '../common/Button';

interface SubjectCardProps {
  subject: Subject;
  isAccepted: boolean;
  isRejected: boolean;
  onAccept: () => void;
  onReject: () => void;
  onPreview: () => void;
}

const SubjectCard: React.FC<SubjectCardProps> = ({
  subject,
  isAccepted,
  isRejected,
  onAccept,
  onReject,
  onPreview
}) => {
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate thumbnail from first position
  const firstPosition = subject.positions[0];
  
  // Status class
  let statusClass = 'bg-gray-100';
  if (isAccepted) statusClass = 'bg-green-50 border-green-300';
  if (isRejected) statusClass = 'bg-red-50 border-red-300';
  
  return (
    <div className={`border rounded-md ${statusClass} overflow-hidden`}>
      <div className="p-3">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-medium text-gray-800 capitalize">
            {subject.class}
          </h4>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
            {subject.positions.length} frames
          </span>
        </div>
        
        <div className="text-xs text-gray-600 mb-2">
          <div>Time Range: {formatTime(subject.firstSeen)} - {formatTime(subject.lastSeen)}</div>
          <div>Duration: {formatTime(subject.lastSeen - subject.firstSeen)}</div>
        </div>
        
        <div className="mb-3">
          <div 
            className="border rounded-md h-20 bg-gray-200 mb-1 flex items-center justify-center overflow-hidden cursor-pointer"
            onClick={onPreview}
          >
            <span className="text-xs text-gray-600">Click to Preview</span>
          </div>
        </div>
        
        <div className="flex justify-between">
          <button
            className={`px-3 py-1 rounded-md text-sm ${
              isRejected 
                ? 'bg-red-500 text-white' 
                : 'border border-red-300 text-red-500'
            }`}
            onClick={onReject}
          >
            Reject
          </button>
          <button
            className={`px-3 py-1 rounded-md text-sm ${
              isAccepted 
                ? 'bg-green-500 text-white' 
                : 'border border-green-300 text-green-500'
            }`}
            onClick={onAccept}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

const ScanReviewPanel: React.FC<{
  videoElement: HTMLVideoElement | null;
  onFinalize: () => void;
}> = ({ videoElement, onFinalize }) => {
  const dispatch = useDispatch();
  const { detectedSubjects, acceptedSubjectsIds, rejectedSubjectsIds } = useSelector(
    (state: RootState) => state.videoScan
  );
  
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
  
  const handlePreview = (subject: Subject) => {
    if (videoElement) {
      // Set video time to when subject first appears
      videoElement.currentTime = subject.firstSeen;
    }
  };
  
  const handleFinalize = () => {
    // Add all accepted subjects as focus points
    acceptedSubjectsIds.forEach(subjectId => {
      const subject = detectedSubjects.find(s => s.id === subjectId);
      if (subject) {
        dispatch(addFocusPoint({
          id: subject.id,
          timeStart: subject.firstSeen,
          timeEnd: subject.lastSeen,
          x: subject.positions[0].bbox[0] + subject.positions[0].bbox[2] / 2,
          y: subject.positions[0].bbox[1] + subject.positions[0].bbox[3] / 2,
          width: subject.positions[0].bbox[2],
          height: subject.positions[0].bbox[3],
          description: subject.class
        }));
      }
    });
    
    // Exit review mode
    dispatch(exitReviewMode());
    
    // Call the onFinalize callback
    onFinalize();
  };
  
  return (
    <div className="mb-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-800 mb-2">
          Review Detected Subjects
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {detectedSubjects.length} subjects detected. Accept or reject each subject or use the buttons below to process them all at once.
        </p>
        
        <div className="flex space-x-2 mb-4">
          <Button onClick={handleAcceptAll} className="bg-green-600 text-white px-4 py-2 rounded-md">
            Accept All
          </Button>
          <Button onClick={handleRejectAll} className="bg-red-600 text-white px-4 py-2 rounded-md">
            Reject All
          </Button>
          <Button onClick={handleFinalize} className="bg-blue-600 text-white px-4 py-2 rounded-md">
            Finalize
          </Button>
          <Button onClick={() => dispatch(exitReviewMode())} className="border px-4 py-2 rounded-md">
            Cancel
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
  );
};

export default ScanReviewPanel;
