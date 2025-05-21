import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { v4 as uuidv4 } from 'uuid';

export interface ClipSegment {
  id: string;
  startTime: number;
  endTime: number;
  thumbnail?: string; // URL to thumbnail
  selected?: boolean;
  name?: string;
  isEdited?: boolean; // Flag to indicate if clip has been saved after editing
}

export interface DetectionOptions {
  minClipDuration: number; // in seconds
  maxClipDuration: number; // in seconds
  sceneChangeThreshold: number; // 0-100, higher means more sensitive
  audioSilenceThreshold: number; // in dB, typically -30 to -60
  silenceDuration: number; // in seconds, how long silence should be to consider a break
  onProgress?: (progress: number) => void;
}

class ClipDetectionService {
  private ffmpeg: any = null;
  private initialized = false;
  private isProcessing = false;

  /**
   * Initialize FFmpeg if not already initialized
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      this.ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      });
      
      await this.ffmpeg.load();
      this.initialized = true;
      console.log('FFmpeg initialized for clip detection');
    } catch (error) {
      console.error('Failed to initialize FFmpeg for clip detection:', error);
      throw new Error(`Failed to initialize clip detection: ${error}`);
    }
  }

  /**
   * Detect potential clip segments in a video
   */
  async detectClips(
    videoUrl: string,
    options: DetectionOptions = {
      minClipDuration: 8,
      maxClipDuration: 15,
      sceneChangeThreshold: 30,
      audioSilenceThreshold: -40,
      silenceDuration: 0.3,
    }
  ): Promise<ClipSegment[]> {
    // Make sure FFmpeg is initialized
    if (!this.initialized || !this.ffmpeg) {
      await this.initialize();
    }

    if (this.isProcessing) {
      throw new Error('Another detection process is already running');
    }

    this.isProcessing = true;
    
    try {
      // Generate unique filenames
      const inputFilename = `input-${uuidv4()}.mp4`;
      const sceneDetectOutput = `scenes-${uuidv4()}.txt`;
      const silenceDetectOutput = `silence-${uuidv4()}.txt`;
      
      // Download and write video to FFmpeg's virtual filesystem
      const videoData = await fetchFile(videoUrl);
      this.ffmpeg.FS('writeFile', inputFilename, videoData);
      
      options.onProgress?.(10);
      
      // 1. Detect scene changes
      await this.ffmpeg.run(
        '-i', inputFilename,
        '-filter:v', `select='gt(scene,${options.sceneChangeThreshold/100})',showinfo`,
        '-f', 'null',
        '-'
      );
      
      options.onProgress?.(40);
      
      // Parse scene changes from logs (FFmpeg outputs to stderr)
      const sceneChanges = this.parseSceneChangesFromLogs();
      
      // 2. Detect audio silence
      await this.ffmpeg.run(
        '-i', inputFilename,
        '-af', `silencedetect=noise=${options.audioSilenceThreshold}dB:d=${options.silenceDuration}`,
        '-f', 'null',
        '-'
      );
      
      options.onProgress?.(70);
      
      // Parse silence segments from logs
      const silenceSegments = this.parseSilenceFromLogs();
      
      // 3. Combine scene changes and silence to determine clip boundaries
      const clipSegments = this.determineClipSegments(
        sceneChanges, 
        silenceSegments, 
        options
      );
      
      // 4. Generate thumbnails for each segment
      await this.generateThumbnails(clipSegments, inputFilename);
      
      // Clean up files
      this.ffmpeg.FS('unlink', inputFilename);
      
      options.onProgress?.(100);
      
      return clipSegments;
    } catch (error) {
      console.error('Error detecting clips:', error);
      throw new Error(`Failed to detect clips: ${error}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Parse scene changes from FFmpeg log output
   */
  private parseSceneChangesFromLogs(): number[] {
    // In a real implementation, we would access FFmpeg logs
    // For demo/prototype, we'll return some dummy timestamps
    console.warn('Using dummy scene detection data until log parsing is implemented');
    return [0, 5.2, 12.8, 18.5, 25.3, 32.1, 38.7, 45.2, 52.8, 59.4, 65.9, 72.3, 78.1, 85.4, 91.7, 97.3, 104.8, 111.2];
  }

  /**
   * Parse silence segments from FFmpeg log output
   */
  private parseSilenceFromLogs(): Array<{ start: number, end: number }> {
    // In a real implementation, we would access FFmpeg logs
    // For demo/prototype, we'll return some dummy silence segments
    console.warn('Using dummy silence detection data until log parsing is implemented');
    return [
      { start: 4.8, end: 5.5 },
      { start: 12.3, end: 13.2 },
      { start: 24.7, end: 25.6 },
      { start: 37.9, end: 38.9 },
      { start: 51.5, end: 52.4 },
      { start: 65.1, end: 66.0 },
      { start: 77.6, end: 78.5 },
      { start: 90.8, end: 91.9 },
      { start: 103.9, end: 104.9 }
    ];
  }

  /**
   * Combine scene changes and silence to determine logical clip segments
   */
  private determineClipSegments(
    sceneChanges: number[],
    silenceSegments: Array<{ start: number, end: number }>,
    options: DetectionOptions
  ): ClipSegment[] {
    // Combine scene changes and end of silence as potential cut points
    const cutPoints = [...sceneChanges];
    silenceSegments.forEach(silence => {
      cutPoints.push(silence.end);
    });

    // Sort cut points and remove duplicates (within small threshold)
    const sortedUniqueCutPoints = [...new Set(cutPoints.sort((a, b) => a - b))].filter((point, index, arr) => {
      if (index === 0) return true;
      return point - arr[index - 1] > 0.5; // Remove points that are too close together
    });

    const segments: ClipSegment[] = [];
    
    // Create segments based on min/max duration
    for (let i = 0; i < sortedUniqueCutPoints.length - 1; i++) {
      const startTime = sortedUniqueCutPoints[i];
      let endTime = sortedUniqueCutPoints[i + 1];
      
      // Check if this could be a valid clip
      const duration = endTime - startTime;
      
      // Skip segments that are too short
      if (duration < options.minClipDuration) continue;
      
      // If segment is too long, limit to max duration
      if (duration > options.maxClipDuration) {
        endTime = startTime + options.maxClipDuration;
      }
      
      segments.push({
        id: uuidv4(),
        startTime,
        endTime,
        selected: false
      });
    }
    
    return segments;
  }

  /**
   * Generate thumbnails for each segment
   */
  private async generateThumbnails(segments: ClipSegment[], inputFilename: string): Promise<void> {
    try {
      // For each segment, extract a thumbnail at the middle of the clip
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const thumbnailTime = segment.startTime + ((segment.endTime - segment.startTime) / 2);
        const thumbnailOutputName = `thumb-${segment.id}.jpg`;
        
        // Use FFmpeg to extract a frame at the specified time
        await this.ffmpeg.run(
          '-i', inputFilename,
          '-ss', thumbnailTime.toString(),
          '-frames:v', '1',
          '-q:v', '2',
          '-f', 'image2',
          thumbnailOutputName
        );
        
        // Read the thumbnail from FFmpeg's virtual filesystem
        const thumbnailData = this.ffmpeg.FS('readFile', thumbnailOutputName);
        
        // Convert to base64 data URL
        const thumbnailBlob = new Blob([thumbnailData.buffer], { type: 'image/jpeg' });
        const thumbnailUrl = URL.createObjectURL(thumbnailBlob);
        
        // Set the thumbnail URL for the segment
        segment.thumbnail = thumbnailUrl;
        
        // Clean up the file in FFmpeg's virtual filesystem
        this.ffmpeg.FS('unlink', thumbnailOutputName);
      }
    } catch (error) {
      console.error('Error generating thumbnails:', error);
      // Fall back to placeholder thumbnails if extraction fails
      segments.forEach(segment => {
        if (!segment.thumbnail) {
          segment.thumbnail = 'https://via.placeholder.com/320x180.png';
        }
      });
    }
  }

  /**
   * Extract a clip between start and end times
   */
  async extractClip(
    videoUrl: string, 
    startTime: number, 
    endTime: number, 
    onProgress?: (progress: number) => void
  ): Promise<string> {
    // Make sure FFmpeg is initialized
    if (!this.initialized || !this.ffmpeg) {
      await this.initialize();
    }

    try {
      // Generate unique filenames
      const inputFilename = `input-${uuidv4()}.mp4`;
      const outputFilename = `clip-${uuidv4()}.mp4`;
      
      // Download and write video to FFmpeg's virtual filesystem
      const videoData = await fetchFile(videoUrl);
      this.ffmpeg.FS('writeFile', inputFilename, videoData);
      
      onProgress?.(30);
      
      // Extract the clip using FFmpeg
      await this.ffmpeg.run(
        '-ss', startTime.toString(),
        '-i', inputFilename,
        '-t', (endTime - startTime).toString(),
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-copyts',
        '-avoid_negative_ts', 'make_zero',
        '-preset', 'medium',
        '-crf', '23',
        '-y',
        outputFilename
      );
      
      onProgress?.(80);
      
      // Read the output file
      const data = this.ffmpeg.FS('readFile', outputFilename);
      
      // Clean up files
      this.ffmpeg.FS('unlink', inputFilename);
      this.ffmpeg.FS('unlink', outputFilename);
      
      onProgress?.(100);
      
      // Create a blob URL for the clip
      return URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
    } catch (error) {
      console.error('Error extracting clip:', error);
      throw new Error(`Failed to extract clip: ${error}`);
    }
  }
}

// Create a singleton instance
const clipDetectionService = new ClipDetectionService();
export default clipDetectionService;
