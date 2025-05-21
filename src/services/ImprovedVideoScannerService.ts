import subjectDetectionService, { DetectionResult } from './SubjectDetectionService';

/** 
 * Options for video scanning
 */
export interface ScanOptions {
  interval?: number;                // Seconds between frames to process
  minScore?: number;                // Minimum confidence score for detected objects
  similarityThreshold?: number;     // Threshold for considering subjects as the same
  minDetections?: number;           // Minimum number of detections to include a subject
  clipSegments?: Array<{            // Optional clip segments to limit scanning
    startTime: number;
    endTime: number;
  }>;
  onProgress?: (progress: ScanProgress) => void;  // Callback for progress updates
}

/**
 * Scan progress information
 */
export interface ScanProgress {
  currentFrame: number;
  totalFrames: number;
  percentComplete: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
}

/**
 * Position of a detected subject in a video frame
 */
export interface SubjectPosition {
  time: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
  score: number;
}

/**
 * Subject detected in video
 */
export interface Subject {
  id: string;
  class: string;
  positions: SubjectPosition[];
  score: number;
  firstSeen: number; // timestamp in seconds
  lastSeen: number; // timestamp in seconds
}

// Helper functions for subjects (outside of the object to maintain serializability)
export const createSubject = (id: string, className: string, positions: SubjectPosition[]): Subject => {
  // Calculate firstSeen and lastSeen based on position times
  let firstSeen = 0;
  let lastSeen = 0;
  
  if (positions.length > 0) {
    const times = positions.map(p => p.time);
    firstSeen = Math.min(...times);
    lastSeen = Math.max(...times);
  }
  
  // Calculate score
  const score = positions.length === 0 
    ? 0 
    : positions.reduce((total, pos) => total + pos.score, 0) / positions.length;
  
  // Return a plain serializable object
  return {
    id,
    class: className,
    positions,
    score,
    firstSeen,
    lastSeen
  };
}

// Helper to update a subject with new position
export const addPositionToSubject = (subject: Subject, position: SubjectPosition): Subject => {
  const newPositions = [...subject.positions, position];
  
  // Update firstSeen and lastSeen
  const firstSeen = Math.min(subject.firstSeen, position.time);
  const lastSeen = Math.max(subject.lastSeen, position.time);
  
  // Recalculate score
  const score = newPositions.reduce((total, pos) => total + pos.score, 0) / newPositions.length;
  
  // Return a new subject object (immutable update)
  return {
    ...subject,
    positions: newPositions,
    firstSeen,
    lastSeen,
    score
  };
}

// Default scan options
const DEFAULT_OPTIONS: ScanOptions = {
  interval: 1,                  // Check every 1 second
  minScore: 0.35,               // Minimum 35% confidence
  similarityThreshold: 0.5,     // 50% overlap to be considered the same subject
  minDetections: 1,             // Require at least one detection
};

// Maximum time to wait for video to be ready (in ms)
const MAX_VIDEO_READY_WAIT = 10000;

/**
 * Service for scanning videos to detect subjects
 */
class ImprovedVideoScannerService {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isScanning: boolean = false;
  private shouldStop: boolean = false;
  private loadedMetadata: boolean = false;

  /**
   * Initialize scanner with video element
   */
  public async initialize(videoElement: HTMLVideoElement): Promise<void> {
    if (!videoElement) {
      console.error('Invalid video element provided to scanner');
      throw new Error('Invalid video element provided to scanner');
    }
    
    console.log('Initializing video scanner with element:', videoElement);
    this.video = videoElement;
    
    // Create a canvas element for frame extraction
    this.canvas = document.createElement('canvas');
    console.log('Created canvas for frame extraction');
    
    // Get 2D context for drawing video frames
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    
    if (!this.ctx) {
      console.error('Failed to get 2D context from canvas');
      throw new Error('Failed to get 2D context from canvas');
    } else {
      console.log('Successfully obtained 2D context from canvas');
    }
    
    this.isScanning = false;
    this.shouldStop = false;
    
    // Set up metadata loaded event handler to update canvas dimensions
    if (!this.loadedMetadata) {
      this.video.addEventListener('loadedmetadata', () => {
        console.log('Video metadata loaded');
        this.loadedMetadata = true;
        this.updateCanvasDimensions();
      });
    }
    
    // Ensure canvas dimensions match video if already loaded
    this.updateCanvasDimensions();
    
    // Pre-load the detection model
    try {
      await subjectDetectionService.loadModel();
      console.log('Detection model pre-loaded successfully');
    } catch (error) {
      console.warn('Failed to pre-load detection model:', error);
      // Don't throw - we'll retry later during scanning
    }
  }

  /**
   * Check if scanner is currently running
   */
  public isRunning(): boolean {
    return this.isScanning;
  }

  /**
   * Stop an ongoing scan
   */
  public stopScan(): void {
    console.log('Stop scan requested');
    this.shouldStop = true;
    this.isScanning = false;
  }

  /**
   * Update canvas dimensions to match video
   */
  private updateCanvasDimensions(): void {
    if (!this.video || !this.canvas) return;
    
    // Get video dimensions
    const videoWidth = this.video.videoWidth || this.video.width;
    const videoHeight = this.video.videoHeight || this.video.height;
    
    if (videoWidth && videoHeight) {
      console.log(`Setting canvas dimensions to match video: ${videoWidth}x${videoHeight}`);
      this.canvas.width = videoWidth;
      this.canvas.height = videoHeight;
    } else {
      console.warn('Unable to determine video dimensions, using defaults');
      this.canvas.width = 640;
      this.canvas.height = 360;
    }
  }

  /**
   * Wait for video to be ready
   */
  private async checkReady(): Promise<void> {
    if (!this.video) {
      throw new Error('No video element available');
    }
    
    // If video is already ready, return immediately
    if (this.video.readyState >= 2) {
      console.log('Video already ready. readyState:', this.video.readyState);
      return Promise.resolve();
    }
    
    console.log('Waiting for video to be ready...');
    
    // Wait for video to be ready with timeout
    return new Promise<void>((resolve, reject) => {
      const startTime = Date.now();
      
      // Load event handler
      const onLoad = () => {
        console.log('Video loaded event fired');
        cleanup();
        this.updateCanvasDimensions();
        resolve();
      };
      
      // Setup and cleanup functions
      const setup = () => {
        this.video?.addEventListener('loadeddata', onLoad);
        this.video?.addEventListener('canplay', onLoad);
      };
      
      const cleanup = () => {
        this.video?.removeEventListener('loadeddata', onLoad);
        this.video?.removeEventListener('canplay', onLoad);
      };
      
      // Set up event handlers
      setup();
      
      // Polling function to check readyState
      const checkReady = () => {
        if (!this.video) {
          cleanup();
          reject(new Error('Video element became unavailable while waiting'));
          return;
        }
        
        // Check if we've exceeded the timeout
        if (Date.now() - startTime > MAX_VIDEO_READY_WAIT) {
          cleanup();
          reject(new Error('Timeout waiting for video to be ready'));
          return;
        }
        
        if (this.video.readyState >= 2) {
          console.log('Video is now ready. readyState:', this.video.readyState, 'Duration:', this.video.duration);
          cleanup();
          this.updateCanvasDimensions();
          resolve();
        } else {
          // Try to nudge the video to load
          if (this.video.paused) {
            try {
              // Force preload
              this.video.preload = 'auto';
              
              // Sometimes playing and immediately pausing can help
              const playPromise = this.video.play();
              if (playPromise !== undefined) {
                playPromise.then(() => {
                  setTimeout(() => {
                    this.video?.pause();
                  }, 50);
                }).catch(err => {
                  console.log('Play attempt failed:', err);
                });
              }
            } catch (e) {
              console.log('Error trying to nudge video loading:', e);
            }
          }
          
          console.log('Video still not ready. readyState:', this.video.readyState, 'Duration:', this.video.duration);
          setTimeout(checkReady, 100);
        }
      };
      
      // Start polling
      checkReady();
    });
  }

  /**
   * Scan the entire video for subjects
   */
  public async scanVideo(
    videoDuration: number,
    options: ScanOptions = {}
  ): Promise<Subject[]> {
    console.log('Starting video scan with duration:', videoDuration, 'and options:', options);
    
    if (!this.video || !this.canvas || !this.ctx) {
      throw new Error('Scanner not initialized. Call initialize() first.');
    }

    if (this.isScanning) {
      console.warn('A scan is already in progress.');
      this.stopScan();
      // Give a little time for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Check if video is actually loaded and wait for it to be ready
    try {
      await this.checkReady();
    } catch (error) {
      console.error('Failed to wait for video readiness:', error);
      throw error;
    }
    
    // Make sure canvas is correctly sized
    this.updateCanvasDimensions();
    
    // Merge default and provided options
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    try {
      this.isScanning = true;
      this.shouldStop = false;
      
      // Load model first to avoid delay during scanning
      await subjectDetectionService.loadModel();
      
      // Calculate total frames to process based on interval
      const interval = opts.interval || 2; // Use 2-second intervals for better performance
      
      // Generate time points to process (either from clips or entire video)
      let timePoints: number[] = [];
      if (opts.clipSegments && opts.clipSegments.length > 0) {
        // For each clip segment, add time points at the specified interval
        opts.clipSegments.forEach(clip => {
          for (let t = clip.startTime; t <= clip.endTime; t += interval) {
            timePoints.push(t);
          }
        });
        console.log(`Generated ${timePoints.length} time points from ${opts.clipSegments.length} clip segments`);
      } else {
        // Process the entire video at the specified interval
        for (let t = 0; t < videoDuration; t += interval) {
          timePoints.push(t);
        }
        console.log(`Generated ${timePoints.length} time points from full video`);
      }
      
      // Apply frame sampling for performance
      const MAX_FRAMES = 15; // Limit frames to prevent browser hanging
      timePoints = this.sampleFrames(timePoints, MAX_FRAMES);
      
      const totalFrames = timePoints.length;
      console.log(`Using ${totalFrames} frames for scan after sampling`);
      
      // Track subjects across frames - using a Map for better lookup performance
      const subjects: Map<string, Subject> = new Map();
      
      // Start time for progress calculation
      const startTime = performance.now();
      
      let currentFrame = 0;
      
      // Remember the original video position to restore it later
      const originalTime = this.video.currentTime;
      const originalPaused = this.video.paused;
      
      // Pause the video during scanning
      this.video.pause();
      
      // Process frames sequentially with awaits
      for (const timePoint of timePoints) {
        if (this.shouldStop) {
          console.log('Scan stopped by user');
          break;
        }
        
        // Update progress
        currentFrame++;
        const elapsedTime = (performance.now() - startTime) / 1000;
        const percentComplete = (currentFrame / totalFrames) * 100;
        const estimatedTotalTime = elapsedTime / (percentComplete / 100);
        const estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTime);
        
        const progress: ScanProgress = {
          currentFrame,
          totalFrames,
          percentComplete,
          elapsedTime,
          estimatedTimeRemaining
        };
        
        // Update progress via callback
        if (opts.onProgress) {
          opts.onProgress(progress);
        }
        
        try {
          // Allow UI to update between frames to prevent browser from freezing
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Seek to time point
          this.video.currentTime = timePoint;
          
          // Wait for frame to be available
          await new Promise<void>(resolve => {
            const onSeeked = () => {
              this.video?.removeEventListener('seeked', onSeeked);
              clearTimeout(timeout);
              resolve();
            };
            
            // Reduced timeout to 300ms to speed up processing
            const timeout = setTimeout(() => {
              this.video?.removeEventListener('seeked', onSeeked);
              console.warn(`Seek timeout at time ${timePoint}s`);
              resolve();
            }, 300);
            
            this.video?.addEventListener('seeked', onSeeked);
          });
          
          // Extract frame
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
          
          // Detect objects in frame
          const detectionResult = await subjectDetectionService.detectObjects(this.canvas);
          
          if (detectionResult.error) {
            console.warn(`Detection error at ${timePoint}s:`, detectionResult.error);
            continue;
          }
          
          // Filter objects by score using a higher threshold for better performance
          const minScore = opts.minScore || 0.45; // Increased threshold for better performance
          const validObjects = detectionResult.objects.filter(obj => obj.score >= minScore);
          
          // Limit objects per frame for performance (take highest-confidence objects)
          const MAX_OBJECTS_PER_FRAME = 3;
          const sortedObjects = validObjects
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_OBJECTS_PER_FRAME);
          
          // Process each detected object
          for (const obj of sortedObjects) {
            const className = obj.class;
            const bbox = obj.bbox;
            const score = obj.score;
            
            // Create a position
            const position: SubjectPosition = {
              time: timePoint,
              bbox,
              score
            };
            
            // Try to find a matching subject
            let matched = false;
            
            for (const [id, subject] of subjects.entries()) {
              // Only match within the same class
              if (subject.class !== className) continue;
              
              // Check if this is likely the same subject based on bbox similarity
              const lastPos = subject.positions[subject.positions.length - 1];
              
              // Skip if more than 5 seconds apart (likely not the same object)
              if (Math.abs(lastPos.time - timePoint) > 5) continue;
              
              // Calculate Intersection over Union (IoU) to determine similarity
              const iou = this.calculateIoU(lastPos.bbox, bbox);
              if (iou >= (opts.similarityThreshold || 0.5)) {
                // Same subject, add the position using our helper
                const updatedSubject = addPositionToSubject(subject, position);
                
                // Replace the subject in the map with updated version
                subjects.set(id, updatedSubject);
                matched = true;
                break;
              }
            }
            
            if (!matched) {
              // New subject
              const id = `${className}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
              const newSubject = createSubject(id, className, [position]);
              
              subjects.set(newSubject.id, newSubject);
            }
          }
        } catch (error) {
          console.error(`Error processing frame at ${timePoint}s:`, error);
          // Continue with next frame
        }
      }
      
      // Restore original video position and play state
      try {
        this.video.currentTime = originalTime;
        if (!originalPaused) {
          this.video.play().catch(e => console.warn('Error restoring playback:', e));
        }
      } catch (e) {
        console.warn('Error restoring video state:', e);
      }
      
      // Filter subjects by minimum number of detections
      const filteredSubjects = Array.from(subjects.values()).filter(
        subject => subject.positions.length >= (opts.minDetections || 1)
      );
      
      this.isScanning = false;
      console.log(`Scan complete, found ${filteredSubjects.length} subjects`);
      
      return filteredSubjects;
    } catch (error) {
      this.isScanning = false;
      console.error('Error during video scan:', error);
      throw error;
    }
  }

  /**
   * Calculate Intersection over Union for two bounding boxes
   */
  private calculateIoU(
    bbox1: [number, number, number, number],
    bbox2: [number, number, number, number]
  ): number {
    // Extract values
    const [x1, y1, w1, h1] = bbox1;
    const [x2, y2, w2, h2] = bbox2;
    
    // Calculate coordinates of intersection
    const x_left = Math.max(x1, x2);
    const y_top = Math.max(y1, y2);
    const x_right = Math.min(x1 + w1, x2 + w2);
    const y_bottom = Math.min(y1 + h1, y2 + h2);
    
    // Check if there is no intersection
    if (x_right < x_left || y_bottom < y_top) {
      return 0;
    }
    
    // Calculate area of intersection
    const intersection_area = (x_right - x_left) * (y_bottom - y_top);
    
    // Calculate areas of both bounding boxes
    const bbox1_area = w1 * h1;
    const bbox2_area = w2 * h2;
    
    // Calculate IoU
    const union_area = bbox1_area + bbox2_area - intersection_area;
    
    return intersection_area / union_area;
  }
  
  /**
   * Sample frames evenly from a given array of timepoints
   * to improve performance and prevent browser crashes
   * @param timePoints Array of time points to sample from
   * @param maxFrames Maximum number of frames to include
   * @returns Sampled array of time points
   */
  private sampleFrames(timePoints: number[], maxFrames: number): number[] {
    if (timePoints.length <= maxFrames) return timePoints;
    
    console.log(`Sampling frames: reducing from ${timePoints.length} to ${maxFrames} for performance`);
    const sampledPoints: number[] = [];
    const step = timePoints.length / maxFrames;
    
    for (let i = 0; i < maxFrames; i++) {
      const index = Math.floor(i * step);
      sampledPoints.push(timePoints[index]);
    }
    
    return sampledPoints;
  }
}

// Create a singleton instance
const improvedVideoScannerService = new ImprovedVideoScannerService();
export default improvedVideoScannerService;
