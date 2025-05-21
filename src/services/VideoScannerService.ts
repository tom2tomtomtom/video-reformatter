import subjectDetectionService, { DetectedObject } from './SubjectDetectionService';
import { ClipSegment } from './ClipDetectionService';

export interface ScanProgress {
  currentFrame: number;
  totalFrames: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  percentComplete: number;
}

export interface Subject {
  id: string;
  class: string;
  firstSeen: number; // timestamp in seconds
  lastSeen: number; // timestamp in seconds
  positions: { // array of positions where subject was found
    time: number;
    bbox: [number, number, number, number];
    score: number;
  }[];
}

export interface ScanOptions {
  interval?: number; // Sampling interval in seconds (default: 1)
  minScore?: number; // Minimum confidence score to include (0-1, default: 0.5)
  similarityThreshold?: number; // Threshold for considering objects the same (0-1, default: 0.6)
  minDetections?: number; // Minimum number of times an object must be detected to be included (default: 2)
  onProgress?: (progress: ScanProgress) => void; // Progress callback
  onFrameProcessed?: (frameTime: number, objects: DetectedObject[]) => void; // Optional callback for each processed frame
  clipSegments?: ClipSegment[]; // Optional array of clip segments to scan instead of the entire video
}

const DEFAULT_OPTIONS: ScanOptions = {
  interval: 1,
  minScore: 0.5,
  similarityThreshold: 0.6,
  minDetections: 2
};

class VideoScannerService {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isScanning: boolean = false;
  private shouldStop: boolean = false;

  /**
   * Initialize scanner with video element
   */
  public initialize(videoElement: HTMLVideoElement): void {
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
    this.ctx = this.canvas.getContext('2d');
    
    if (!this.ctx) {
      console.error('Failed to get 2D context from canvas');
      throw new Error('Failed to get 2D context from canvas');
    } else {
      console.log('Successfully obtained 2D context from canvas');
    }
    
    this.isScanning = false;
    this.shouldStop = false;
    
    // Ensure canvas dimensions match video
    this.updateCanvasDimensions();
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
    console.log('Stopping ongoing video scan');
    this.shouldStop = true;
    this.isScanning = false;
  }
  
  /**
   * Check if the video is ready and wait until it is
   */
  private async checkReady(): Promise<void> {
    if (!this.video) {
      throw new Error('No video element available');
    }
    
    // Wait for video to be ready with timeout protection
    if (this.video.readyState < 2) { // HAVE_CURRENT_DATA = 2
      console.log('Video not ready yet. Current readyState:', this.video.readyState);
      console.log('Waiting for video to be ready...');
      
      const maxWaitTime = 20000; // 20 seconds max wait
      const startTime = Date.now();
      
      return new Promise<void>((resolve, reject) => {
        const checkReady = () => {
          // Check if we've exceeded the max wait time
          if (Date.now() - startTime > maxWaitTime) {
            console.error('Timeout waiting for video to be ready');
            console.error('Final video state:', {
              readyState: this.video.readyState,
              paused: this.video.paused,
              currentTime: this.video.currentTime,
              duration: this.video.duration,
              networkState: this.video.networkState,
              videoWidth: this.video.videoWidth,
              videoHeight: this.video.videoHeight
            });
            reject(new Error('Timeout waiting for video to be ready - please try pausing and restarting the video'));
            return;
          }
          
          if (!this.video) {
            reject(new Error('Video element became unavailable while waiting'));
            return;
          }
          
          if (this.video.readyState >= 2) {
            console.log('Video is now ready. readyState:', this.video.readyState, 'Duration:', this.video.duration);
            resolve();
          } else {
            // Try to nudge the video to load
            if (this.video.paused) {
              // Sometimes playing and immediately pausing can help
              try {
                const playPromise = this.video.play();
                if (playPromise !== undefined) {
                  playPromise.then(() => {
                    this.video?.pause();
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
        
        checkReady();
      });
    } else {
      console.log('Video already ready. readyState:', this.video.readyState);
      return Promise.resolve();
    }
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
    await this.checkReady();
    
    // Merge default and provided options
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    try {
      this.isScanning = true;
      this.shouldStop = false;
      
      // Load model first to avoid delay during scanning
      await subjectDetectionService.loadModel();
      
      // Calculate total frames to process based on interval
      const interval = opts.interval || 1;
      
      // Generate time points to process (either from clips or entire video)
      const timePoints: number[] = [];
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
      
      const totalFrames = timePoints.length;
      
      // Track subjects across frames - using a Map for better lookup performance
      const subjects: Map<string, Subject> = new Map();
      
      // Start time for progress calculation
      const startTime = performance.now();
      
      // Process video at each interval
      for (let frameIndex = 0; frameIndex < timePoints.length; frameIndex++) {
        if (this.shouldStop) {
          console.log('Scan interrupted by user');
          break;
        }
        
        // Get current timestamp
        const currentTime = timePoints[frameIndex];
        
        // Update progress
        if (opts.onProgress) {
          const elapsedTime = (performance.now() - startTime) / 1000;
          const framesPerSecond = frameIndex / Math.max(0.001, elapsedTime);
          const estimatedTimeRemaining = (totalFrames - frameIndex) / Math.max(0.001, framesPerSecond);
          
          opts.onProgress({
            currentFrame: frameIndex + 1,
            totalFrames,
            elapsedTime,
            estimatedTimeRemaining,
            percentComplete: ((frameIndex + 1) / totalFrames) * 100
          });
        }
        
        // Seek to time and extract frame
        try {
          // Seek to the current time
          this.video.currentTime = currentTime;
          
          // Wait for the video to seek to the specified time
          await Promise.race([
            new Promise<void>((resolve) => {
              const onSeeked = () => {
                this.video!.removeEventListener('seeked', onSeeked);
                resolve();
              };
              this.video!.addEventListener('seeked', onSeeked);
            }),
            new Promise<void>((_, reject) => {
              setTimeout(() => reject(new Error('Seek timeout')), 5000);
            })
          ]).catch(err => {
            console.warn(`Seeking to ${currentTime}s timed out, continuing anyway`, err);
          });
          
          // Update canvas dimensions if needed
          if (this.canvas.width !== this.video.videoWidth || this.canvas.height !== this.video.videoHeight) {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
          }
          
          // Capture the frame
          this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
          
          // Run object detection on the frame
          const detectionResult = await subjectDetectionService.detectObjects(this.canvas);
          
          // Filter objects based on minimum score
          const validObjects = detectionResult.objects.filter(
            obj => obj.score >= (opts.minScore || 0.5)
          );
          
          // Optional callback for each processed frame
          if (opts.onFrameProcessed) {
            opts.onFrameProcessed(currentTime, validObjects);
          }
          
          // Track subjects across frames
          this.addOrUpdateSubjects(subjects, validObjects, currentTime, opts.similarityThreshold || 0.6);
        } catch (error) {
          console.error(`Error processing frame at ${currentTime}s:`, error);
          // Continue with next frame even if there's an error
        }
      }
      
      // Convert Map to array and filter out subjects with insufficient detections
      const result = Array.from(subjects.values()).filter(
        subject => subject.positions.length >= (opts.minDetections || 2)
      );
      
      console.log(`Scan complete: found ${result.length} subjects`);
      return result;
    } finally {
      this.isScanning = false;
    }
  }
  
  /**
   * Update canvas dimensions to match the current state of the video
   */
  /**
   * Calculate Intersection over Union (IoU) between two bounding boxes
   * Used to determine if two detections are the same object
   */
  private calculateIoU(
    boxA: [number, number, number, number],
    boxB: [number, number, number, number]
  ): number {
    // Extract coordinates
    const [xA, yA, widthA, heightA] = boxA;
    const [xB, yB, widthB, heightB] = boxB;
    
    // Calculate boxes with absolute coordinates (x1, y1, x2, y2)
    const boxAabs = [xA, yA, xA + widthA, yA + heightA];
    const boxBabs = [xB, yB, xB + widthB, yB + heightB];
    
    // Calculate intersection area
    const xOverlap = Math.max(0, Math.min(boxAabs[2], boxBabs[2]) - Math.max(boxAabs[0], boxBabs[0]));
    const yOverlap = Math.max(0, Math.min(boxAabs[3], boxBabs[3]) - Math.max(boxAabs[1], boxBabs[1]));
    const intersectionArea = xOverlap * yOverlap;
    
    // Calculate union area
    const boxAarea = widthA * heightA;
    const boxBarea = widthB * heightB;
    const unionArea = boxAarea + boxBarea - intersectionArea;
    
    // Return IoU (intersection over union)
    return unionArea > 0 ? intersectionArea / unionArea : 0;
  }
  
  private updateCanvasDimensions(): void {
    if (!this.video || !this.canvas) {
      console.error('Cannot update canvas dimensions - video or canvas not initialized');
      return;
    }
    
    // Get the actual video dimensions
    const videoWidth = this.video.videoWidth;
    const videoHeight = this.video.videoHeight;
    
    if (videoWidth === 0 || videoHeight === 0) {
      console.warn('Video dimensions are invalid:', videoWidth, 'x', videoHeight);
      console.log('Video element:', this.video);
      console.log('Video ready state:', this.video.readyState);
      return;
    }
    
    console.log('Updating canvas dimensions to match video:', videoWidth, 'x', videoHeight);
    
    // Set canvas dimensions to match video
    this.canvas.width = videoWidth;
    this.canvas.height = videoHeight;
    
    console.log('Canvas dimensions updated:', this.canvas.width, 'x', this.canvas.height);
  }
  
  /**
   * Track subjects across video frames
   */
  /**
   * Simplified subject tracking that's more reliable
   */
  private simplifiedTrackSubjects(
    subjects: Subject[],
    detectedObjects: DetectedObject[],
    currentTime: number,
    similarityThreshold: number = 0.5
  ): void {
    // Process each newly detected object
    for (const obj of detectedObjects) {
      // Convert to expected format
      const bbox: [number, number, number, number] = [
        obj.bbox[0],
        obj.bbox[1],
        obj.bbox[2],
        obj.bbox[3]
      ];
      
      // Try to match with existing subjects
      let matched = false;
      
      // Check for matches with existing subjects of the same class
      for (const subject of subjects.filter(s => s.class === obj.class)) {
        // Get the last known position of this subject
        const lastPosition = subject.positions[subject.positions.length - 1];
        
        // Calculate IoU (Intersection over Union) to measure similarity
        const iou = this.calculateIoU(bbox, lastPosition.bbox);
        
        // If IoU is above threshold, consider it the same subject
        if (iou >= similarityThreshold) {
          // Update the subject
          subject.lastSeen = currentTime;
          subject.positions.push({
            time: currentTime,
            bbox,
            score: obj.score
          });
          
          matched = true;
          break;
        }
      }
      
      // If no match was found, create a new subject
      if (!matched) {
        const newSubject: Subject = {
          id: `${obj.class}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          class: obj.class,
          firstSeen: currentTime,
          lastSeen: currentTime,
          positions: [{
            time: currentTime,
            bbox,
            score: obj.score
          }]
        };
        
        subjects.push(newSubject);
      }
    }
  }

  /**
   * Add or update subjects in the Map based on detected objects
   */
  private addOrUpdateSubjects(
    subjectsMap: Map<string, Subject>,
    detectedObjects: DetectedObject[],
    currentTime: number,
    similarityThreshold: number
  ): void {
    // Convert map to array for matching
    const existingSubjects = Array.from(subjectsMap.values());
    
    // Process each detected object
    for (const obj of detectedObjects) {
      const bbox = obj.bbox;
      
      // Try to match with existing subjects of the same class
      let matched = false;
      let matchedSubject: Subject | null = null;
      
      for (const subject of existingSubjects.filter(s => s.class === obj.class)) {
        // Get the last position
        const lastPosition = subject.positions[subject.positions.length - 1];
        
        // Calculate IoU to determine if it's the same object
        const iou = this.calculateIoU(bbox, lastPosition.bbox);
        
        if (iou >= similarityThreshold) {
          // It's a match - update the existing subject
          matchedSubject = subject;
          matched = true;
          break;
        }
      }
      
      if (matched && matchedSubject) {
        // Update existing subject
        matchedSubject.lastSeen = currentTime;
        matchedSubject.positions.push({
          time: currentTime,
          bbox: bbox,
          score: obj.score
        });
        
        // Update in the map
        subjectsMap.set(matchedSubject.id, matchedSubject);
      } else {
        // Create a new subject
        const id = `${obj.class}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newSubject: Subject = {
          id: id,
          class: obj.class,
          firstSeen: currentTime,
          lastSeen: currentTime,
          positions: [{
            time: currentTime,
            bbox: bbox,
            score: obj.score
          }]
        };
        
        // Add to the map
        subjectsMap.set(id, newSubject);
      }
    }
  }

  private trackSubjects(
    subjects: Subject[],
    detectedObjects: DetectedObject[],
    currentTime: number,
    similarityThreshold: number
  ): void {
    // Process each newly detected object
    for (const obj of detectedObjects) {
      const bbox: [number, number, number, number] = [
        obj.bbox[0], 
        obj.bbox[1], 
        obj.bbox[2], 
        obj.bbox[3]
      ];
      
      // Check if this object matches any existing subject
      let matched = false;
      
      for (const subject of subjects) {
        // Only consider subjects of the same class
        if (subject.class !== obj.class) {
          continue;
        }
        
        // Get the last seen position of this subject
        const lastPosition = subject.positions[subject.positions.length - 1];
        
        // Calculate IoU (Intersection over Union) between current detection and last position
        const iou = this.calculateIoU(bbox, lastPosition.bbox);
        
        // If IoU is above threshold, consider it the same subject
        if (iou >= similarityThreshold) {
          // Update the subject
          subject.lastSeen = currentTime;
          subject.positions.push({
            time: currentTime,
            bbox,
            score: obj.score
          });
          
          matched = true;
          break;
        }
      }
      
      // If no match was found, create a new subject
      if (!matched) {
        const newSubject: Subject = {
          id: `${obj.class}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          class: obj.class,
          firstSeen: currentTime,
          lastSeen: currentTime,
          positions: [{
            time: currentTime,
            bbox,
            score: obj.score
          }]
        };
        
        subjects.push(newSubject);
      }
    }
  }
  
  // simplifiedTrackSubjects method exists above - removed duplicate method
  
  // calculateIoU method exists above - removed duplicate method
  
  /**
   * Convert tracked subjects to focus points
   */
  public convertSubjectsToFocusPoints(
    subjects: Subject[],
    imageWidth: number,
    imageHeight: number
  ): Array<{
    id: string;
    timeStart: number;
    timeEnd: number;
    x: number;
    y: number;
    width: number;
    height: number;
    description: string;
  }> {
    return subjects.map(subject => {
      // Calculate average position of all detections
      const avgBbox = this.calculateAverageBoundingBox(subject.positions.map(pos => pos.bbox));
      const [x, y, width, height] = avgBbox;
      
      // Calculate average confidence score
      const avgConfidence = subject.positions.reduce((sum, pos) => sum + pos.score, 0) / subject.positions.length;
      
      // Number of frames the subject appeared in
      const detectionCount = subject.positions.length;
      
      return {
        id: `focus-${Date.now()}-${subject.id}`,
        timeStart: subject.firstSeen,
        timeEnd: subject.lastSeen,
        x: (x / imageWidth) * 100,
        y: (y / imageHeight) * 100,
        width: (width / imageWidth) * 100,
        height: (height / imageHeight) * 100,
        description: `${subject.class} (${Math.round(avgConfidence * 100)}% confidence, ${detectionCount} detections)`
      };
    });
  }

  /**
   * Calculate the average bounding box from multiple detections
   */
  private calculateAverageBoundingBox(
    bboxes: Array<[number, number, number, number]>
  ): [number, number, number, number] {
    const sumX = bboxes.reduce((sum, bbox) => sum + bbox[0], 0);
    const sumY = bboxes.reduce((sum, bbox) => sum + bbox[1], 0);
    const sumWidth = bboxes.reduce((sum, bbox) => sum + bbox[2], 0);
    const sumHeight = bboxes.reduce((sum, bbox) => sum + bbox[3], 0);
    
    return [
      sumX / bboxes.length,
      sumY / bboxes.length,
      sumWidth / bboxes.length,
      sumHeight / bboxes.length
    ];
  }
}

// Create an instance of the service and export it
const videoScannerService = new VideoScannerService();
export default videoScannerService;