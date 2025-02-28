import subjectDetectionService, { DetectedObject } from './SubjectDetectionService';

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
    this.video = videoElement;
    
    // Create offscreen canvas for processing
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    this.ctx = this.canvas.getContext('2d');
    
    console.log('VideoScannerService initialized with video dimensions:', 
      this.video.videoWidth, 'x', this.video.videoHeight);
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
    this.shouldStop = true;
  }

  /**
   * Scan the entire video for subjects
   */
  public async scanVideo(
    videoDuration: number,
    options: ScanOptions = {}
  ): Promise<Subject[]> {
    if (!this.video || !this.canvas || !this.ctx) {
      throw new Error('Scanner not initialized. Call initialize() first.');
    }

    if (this.isScanning) {
      throw new Error('A scan is already in progress.');
    }

    // Merge default and provided options
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    try {
      this.isScanning = true;
      this.shouldStop = false;
      
      // Initialize subject detection
      await subjectDetectionService.loadModel();
      
      // Calculate the total number of frames to process
      const totalFrames = Math.ceil(videoDuration / opts.interval!);
      console.log(`Starting video scan: ${totalFrames} frames to analyze at ${opts.interval} second intervals`);
      
      // Initialize variables to track progress
      const startTime = Date.now();
      let processedFrames = 0;
      
      // Array to store detected subjects
      const subjects: Subject[] = [];
      
      // Process video at specified intervals
      for (let time = 0; time < videoDuration && !this.shouldStop; time += opts.interval!) {
        // Update progress
        const currentTime = Date.now();
        const elapsedTime = (currentTime - startTime) / 1000;
        const framesPerSecond = processedFrames / elapsedTime || 0;
        const remainingFrames = totalFrames - processedFrames;
        const estimatedTimeRemaining = framesPerSecond > 0 
          ? remainingFrames / framesPerSecond 
          : 0;
        
        // Create progress object
        const progress: ScanProgress = {
          currentFrame: processedFrames,
          totalFrames,
          elapsedTime,
          estimatedTimeRemaining,
          percentComplete: (processedFrames / totalFrames) * 100
        };
        
        // Call progress callback if provided
        if (opts.onProgress) {
          opts.onProgress(progress);
        }
        
        // Seek to the current time
        this.video.currentTime = time;
        
        // Wait for the video to update its frame
        await new Promise<void>((resolve) => {
          const seekHandler = () => {
            this.video!.removeEventListener('seeked', seekHandler);
            resolve();
          };
          this.video!.addEventListener('seeked', seekHandler);
        });
        
        // Capture frame
        this.ctx!.drawImage(this.video!, 0, 0, this.canvas!.width, this.canvas!.height);
        
        // Detect objects in the current frame
        const detectionResult = await subjectDetectionService.detectObjects(this.canvas!);
        console.log(`Frame at ${time}s: detected ${detectionResult.objects.length} objects`);
        
        // Filter objects based on min score
        const filteredObjects = detectionResult.objects.filter(obj => obj.score >= opts.minScore!);
        
        // Call frame processed callback if provided
        if (opts.onFrameProcessed) {
          opts.onFrameProcessed(time, filteredObjects);
        }
        
        // Track objects across frames
        this.trackSubjects(subjects, filteredObjects, time, opts.similarityThreshold!);
        
        // Increment processed frames counter
        processedFrames++;
      }
      
      // Filter subjects based on minimum detection count
      const finalSubjects = subjects.filter(subject => 
        subject.positions.length >= opts.minDetections!
      );
      
      console.log(`Scan complete: found ${finalSubjects.length} subjects across ${processedFrames} frames`);
      return finalSubjects;
    } finally {
      this.isScanning = false;
    }
  }
  
  /**
   * Track subjects across video frames
   */
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
  
  /**
   * Calculate Intersection over Union (IoU) between two bounding boxes
   * Each bounding box is [x, y, width, height]
   */
  private calculateIoU(
    bbox1: [number, number, number, number],
    bbox2: [number, number, number, number]
  ): number {
    // Convert from [x, y, width, height] to [x1, y1, x2, y2]
    const box1 = {
      x1: bbox1[0],
      y1: bbox1[1],
      x2: bbox1[0] + bbox1[2],
      y2: bbox1[1] + bbox1[3]
    };
    
    const box2 = {
      x1: bbox2[0],
      y1: bbox2[1],
      x2: bbox2[0] + bbox2[2],
      y2: bbox2[1] + bbox2[3]
    };
    
    // Calculate intersection area
    const intersectionX1 = Math.max(box1.x1, box2.x1);
    const intersectionY1 = Math.max(box1.y1, box2.y1);
    const intersectionX2 = Math.min(box1.x2, box2.x2);
    const intersectionY2 = Math.min(box1.y2, box2.y2);
    
    if (intersectionX2 < intersectionX1 || intersectionY2 < intersectionY1) {
      return 0; // No intersection
    }
    
    const intersectionArea = 
      (intersectionX2 - intersectionX1) * (intersectionY2 - intersectionY1);
    
    // Calculate union area
    const box1Area = (box1.x2 - box1.x1) * (box1.y2 - box1.y1);
    const box2Area = (box2.x2 - box2.x1) * (box2.y2 - box2.y1);
    const unionArea = box1Area + box2Area - intersectionArea;
    
    return intersectionArea / unionArea;
  }
  
  /**
   * Convert detected subjects to focus points
   */
  public subjectsToFocusPoints(subjects: Subject[]): any[] {
    return subjects.map(subject => {
      // Calculate average position
      const positions = subject.positions;
      const sumX = positions.reduce((sum, pos) => sum + pos.bbox[0] + pos.bbox[2]/2, 0);
      const sumY = positions.reduce((sum, pos) => sum + pos.bbox[1] + pos.bbox[3]/2, 0);
      const avgX = sumX / positions.length;
      const avgY = sumY / positions.length;
      
      // Calculate average dimensions
      const sumWidth = positions.reduce((sum, pos) => sum + pos.bbox[2], 0);
      const sumHeight = positions.reduce((sum, pos) => sum + pos.bbox[3], 0);
      const avgWidth = sumWidth / positions.length;
      const avgHeight = sumHeight / positions.length;
      
      // Create focus point
      return {
        id: subject.id,
        timeStart: subject.firstSeen,
        timeEnd: subject.lastSeen,
        x: avgX,
        y: avgY,
        width: avgWidth,
        height: avgHeight,
        description: subject.class
      };
    });
  }
}

export default VideoScannerService;