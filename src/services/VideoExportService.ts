import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { v4 as uuidv4 } from 'uuid';

// Type definitions
export interface ExportOptions {
  ratio: string;
  focusX: number;
  focusY: number;
  letterbox?: boolean;
  quality?: 'high' | 'medium' | 'low';
  frameRate?: number; // Optional target frame rate
}

export interface ExportProgress {
  ratio: string;
  progress: number;
  currentStep: string;
}

export type ProgressCallback = (progress: ExportProgress) => void;

class VideoExportService {
  private ffmpeg: any = null;
  private initialized = false;
  private sourceWidth: number | null = null;
  private sourceHeight: number | null = null;
  private isProcessing = false;
  private processingQueue: (() => Promise<void>)[] = [];

  /**
   * Ensures that only one ffmpeg command runs at a time
   * @param operation The ffmpeg operation to perform
   * @returns Result of the operation
   */
  private async runWithMutex<T>(operation: () => Promise<T>): Promise<T> {
    // If already processing, add to queue and wait
    if (this.isProcessing) {
      return new Promise<T>((resolve, reject) => {
        this.processingQueue.push(async () => {
          try {
            const result = await operation();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    try {
      // Set processing flag to block other operations
      this.isProcessing = true;
      // Run the operation
      return await operation();
    } finally {
      // When done, check if there are queued operations
      this.isProcessing = false;
      
      if (this.processingQueue.length > 0) {
        const nextOperation = this.processingQueue.shift();
        if (nextOperation) {
          nextOperation().catch(err => console.error('Error in queued operation:', err));
        }
      }
    }
  }

  /**
   * Initialize the FFmpeg instance
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Try up to 3 times to initialize
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Attempting to initialize FFmpeg (attempt ${attempts}/${maxAttempts})...`);
      
      try {
        if (!this.ffmpeg) {
          this.ffmpeg = createFFmpeg({ 
            log: true,      // Set to true for debugging
            corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
          });
        }
        
        await this.ffmpeg.load();
        this.initialized = true;
        console.log('FFmpeg initialized successfully');
        return;
      } catch (error) {
        console.error(`FFmpeg initialization attempt ${attempts} failed:`, error);
        
        if (attempts >= maxAttempts) {
          this.initialized = false;
          throw new Error(`Failed to initialize video export functionality after ${maxAttempts} attempts`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Export a video with the specified options
   */
  async exportVideo(
    videoUrl: string, 
    options: ExportOptions,
    onProgress: ProgressCallback
  ): Promise<string> {
    console.log('Export started with options:', options);
    try {
      // Initialize FFmpeg if not already initialized
      if (!this.initialized || !this.ffmpeg) {
        onProgress({ ratio: options.ratio, progress: 0, currentStep: 'Initializing FFmpeg...' });
        await this.initialize();
        
        // Double-check that initialization worked
        if (!this.initialized || !this.ffmpeg) {
          throw new Error('Failed to initialize FFmpeg after attempt');
        }
      }

      // Safety check again to satisfy TypeScript
      if (!this.ffmpeg) {
        throw new Error('FFmpeg instance is not available');
      }

      onProgress({ ratio: options.ratio, progress: 10, currentStep: 'Loading video...' });
      
      // Generate unique filenames for processing
      const inputFilename = `input-${uuidv4()}.mp4`;
      const outputFilename = `output-${options.ratio.replace(':', '_')}-${uuidv4()}.mp4`;
      
      // Fetch and write the video file to FFmpeg's virtual filesystem
      const videoData = await fetchFile(videoUrl);
      this.ffmpeg.FS('writeFile', inputFilename, videoData);
      
      onProgress({ ratio: options.ratio, progress: 30, currentStep: 'Getting video information...' });
      
      // Get video dimensions by running ffprobe - simpler approach
      let sourceWidth = 1280; // Default width
      let sourceHeight = 720; // Default height
      
      try {
        // We'll examine FFmpeg logs to extract dimensions
        let dimensionsFound = false;
        
        const logHandler = (message: { message: string }) => {
          // Look for dimensions in FFmpeg output
          const match = message.message.match(/Stream #0:0.*Video.* ([0-9]+)x([0-9]+)/);
          if (match) {
            sourceWidth = parseInt(match[1], 10);
            sourceHeight = parseInt(match[2], 10);
            dimensionsFound = true;
            console.log(`Detected video dimensions: ${sourceWidth}x${sourceHeight}`);
          }
        };
        
        // Register log handler
        this.ffmpeg.setLogger(logHandler);
        
        // Run FFmpeg to get video info
        await this.runWithMutex(() => this.ffmpeg.run('-i', inputFilename));
        
        // Restore default logger
        this.ffmpeg.setLogger(() => {});
        
        if (!dimensionsFound) {
          console.warn('Could not detect dimensions from logs, using defaults');
        }
      } catch (e) {
        console.warn('Error detecting dimensions, using defaults:', e);
      }
      
      // Store the dimensions for future use
      this.sourceWidth = sourceWidth;
      this.sourceHeight = sourceHeight;
      
      onProgress({ ratio: options.ratio, progress: 40, currentStep: 'Processing video...' });
      
      // Parse the aspect ratio
      const [targetWidth, targetHeight] = options.ratio.split(':').map(Number);
      const targetRatio = targetWidth / targetHeight;
      
      const sourceRatio = sourceWidth / sourceHeight;
      
      console.log(`Source dimensions: ${sourceWidth}x${sourceHeight}, ratio: ${sourceRatio}`);
      console.log(`Target ratio: ${targetRatio}`);
      
      // Check if we can keep the original (ONLY when target ratio matches source ratio)
      // We use a small epsilon for floating point comparison
      const isOriginalFormat = Math.abs(sourceRatio - targetRatio) < 0.01;
      
      // Force letterboxing for 9:16 format
      if (options.ratio === '9:16') {
        console.log('9:16 format detected - FORCING letterboxing to ensure correct output');
        options.letterbox = true;
      }
      
      // Disable letterboxing for 16:9 format if source is also 16:9
      if (isOriginalFormat && options.ratio === '16:9') {
        console.log('16:9 source and target detected - DISABLING letterboxing');
        options.letterbox = false;
      }
      
      // Only apply this optimization for 16:9 source videos that are being exported to 16:9
      if (isOriginalFormat && options.ratio === '16:9' && !options.letterbox) {
        console.log('Source ratio matches target ratio, keeping original format (optimization)');
        onProgress({ ratio: options.ratio, progress: 50, currentStep: 'Using original format...' });
        
        // Just copy the input to output (with possible quality adjustments)
        const preset = options.quality === 'high' ? 'slow' : options.quality === 'low' ? 'veryfast' : 'medium';
        const crf = options.quality === 'high' ? '18' : options.quality === 'low' ? '28' : '23';
        
        const command = [
          '-i', inputFilename,
          '-c:v', 'libx264',
          '-preset', preset,
          '-crf', crf,
          '-c:a', 'aac',
          '-b:a', '128k',
          ...(options.frameRate ? ['-r', options.frameRate.toString()] : []),
          '-movflags', '+faststart',
          '-y',
          outputFilename
        ];
        
        console.log('FFmpeg command (original format):', command.join(' '));
        await this.runWithMutex(() => this.ffmpeg.run(...command));
        
        onProgress({ ratio: options.ratio, progress: 90, currentStep: 'Finalizing...' });
        
        // Read the processed file
        const data = this.ffmpeg.FS('readFile', outputFilename);
        
        // Clean up files
        this.ffmpeg.FS('unlink', inputFilename);
        this.ffmpeg.FS('unlink', outputFilename);
        
        onProgress({ ratio: options.ratio, progress: 100, currentStep: 'Done' });
        
        // Create a blob URL for the processed video
        return URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
      }
      
      // Calculate output dimensions based on target ratio
      let outputWidth, outputHeight;
      
      if (targetRatio < 1) {
        // Portrait (e.g., 9:16)
        outputHeight = 1280;
        outputWidth = Math.round(outputHeight * targetRatio);
      } else if (targetRatio > 1) {
        // Landscape (e.g., 16:9)
        outputWidth = 1280;
        outputHeight = Math.round(outputWidth / targetRatio);
      } else {
        // Square (1:1)
        outputWidth = outputHeight = 1080;
      }
      
      console.log(`Output dimensions: ${outputWidth}x${outputHeight}`);
      
      // Determine crop dimensions
      let cropWidth, cropHeight, cropX, cropY;
      
      if (options.letterbox) {
        // For letterboxing, we'll:
        // 1. First crop to a square around the focus point
        // 2. Then letterbox that square to the target format
        let filterChain = "";
        
        // First determine the square size - take the smaller dimension
        const squareSize = Math.min(sourceWidth, sourceHeight);
        
        // Calculate the crop position based on focus point
        const idealCropX = Math.round(options.focusX * sourceWidth - squareSize/2);
        const idealCropY = Math.round(options.focusY * sourceHeight - squareSize/2);
        
        // Ensure crop stays within the video bounds
        const cropX = Math.max(0, Math.min(sourceWidth - squareSize, idealCropX));
        const cropY = Math.max(0, Math.min(sourceHeight - squareSize, idealCropY));
        
        // First part of filter chain: crop to square around focus point
        const cropFilter = `crop=${squareSize}:${squareSize}:${cropX}:${cropY}`;
        
        // Now add letterboxing based on target ratio
        if (targetRatio > 1) {
          // Target is wider than square (e.g., 16:9) - add horizontal letterboxing
          const scaledHeight = outputHeight;
          const scaledWidth = scaledHeight; // Square
          filterChain = `${cropFilter},scale=${scaledWidth}:${scaledHeight},setsar=1,pad=${outputWidth}:${outputHeight}:(((${outputWidth}-${scaledWidth})/2)):0:black`;
          console.log('Using wide target letterboxing. Target ratio:', targetRatio, 'Filter:', filterChain);
        } else if (targetRatio < 1) {
          // Target is taller than square (e.g., 9:16) - add vertical letterboxing
          const scaledWidth = outputWidth;
          const scaledHeight = scaledWidth; // Square
          filterChain = `${cropFilter},scale=${scaledWidth}:${scaledHeight},setsar=1,pad=${outputWidth}:${outputHeight}:0:(((${outputHeight}-${scaledHeight})/2)):black`;
          console.log('Using tall target letterboxing. Target ratio:', targetRatio, 'Filter:', filterChain);
        } else {
          // Target is also square, just resize
          filterChain = `${cropFilter},scale=${outputWidth}:${outputHeight},setsar=1`;
          console.log('Using square target. Target ratio:', targetRatio, 'Filter:', filterChain);
        }
        
        console.log('Using focus-centered letterbox filter chain:', filterChain);
        console.log('Letterboxing enabled:', options.letterbox, 'Focus point:', options.focusX, options.focusY);
        
        onProgress({ ratio: options.ratio, progress: 50, currentStep: 'Applying letterboxing...' });
        
        // FFmpeg command with scaling and padding
        const preset = options.quality === 'high' ? 'slow' : options.quality === 'low' ? 'veryfast' : 'medium';
        const crf = options.quality === 'high' ? '18' : options.quality === 'low' ? '28' : '23';
        
        try {
          // Run FFmpeg
          const command = [
            '-i', inputFilename,
            '-vf', filterChain,
            '-c:v', 'libx264',
            '-preset', preset,
            '-crf', crf,
            '-c:a', 'aac',
            '-b:a', '128k',
            ...(options.frameRate ? ['-r', options.frameRate.toString()] : []),
            '-movflags', '+faststart',
            '-y',
            outputFilename
          ];
          
          console.log('FFmpeg command:', command.join(' '));
          await this.runWithMutex(() => this.ffmpeg.run(...command));
        } catch (error) {
          console.error('Error applying letterboxing:', error);
          throw new Error(`Failed to apply letterboxing: ${error}`);
        }
      } else {
        // For cropping without letterboxing
        if (sourceRatio > targetRatio) {
          // Source is wider than target - need to crop width
          cropHeight = sourceHeight;
          cropWidth = Math.round(sourceHeight * targetRatio);
          cropY = 0;
          
          // Apply focus point for horizontal crop
          const maxOffset = sourceWidth - cropWidth;
          const idealX = Math.round(options.focusX * sourceWidth - cropWidth/2);
          cropX = Math.max(0, Math.min(maxOffset, idealX));
          
          console.log(`Cropping width: x=${cropX}, width=${cropWidth}, height=${cropHeight}, maxOffset=${maxOffset}, focusX=${options.focusX}`);
        } else {
          // Source is taller than target - need to crop height
          cropWidth = sourceWidth;
          cropHeight = Math.round(sourceWidth / targetRatio);
          cropX = 0;
          
          // Apply focus point for vertical crop
          const maxOffset = sourceHeight - cropHeight;
          const idealY = Math.round(options.focusY * sourceHeight - cropHeight/2);
          cropY = Math.max(0, Math.min(maxOffset, idealY));
          
          console.log(`Cropping height: y=${cropY}, width=${cropWidth}, height=${cropHeight}, maxOffset=${maxOffset}, focusY=${options.focusY}`);
        }
        
        onProgress({ ratio: options.ratio, progress: 50, currentStep: 'Cropping video...' });
        
        // Create crop filter and then scale to output dimensions
        const cropFilter = `crop=${cropWidth}:${cropHeight}:${cropX}:${cropY}`;
        const scaleFilter = `scale=${outputWidth}:${outputHeight}`;
        const filterChain = `${cropFilter},${scaleFilter},setsar=1`;
        
        console.log('Using crop and scale filter chain:', filterChain);
        
        // FFmpeg command with crop and scaling
        const preset = options.quality === 'high' ? 'slow' : options.quality === 'low' ? 'veryfast' : 'medium';
        const crf = options.quality === 'high' ? '18' : options.quality === 'low' ? '28' : '23';
        
        try {
          // Run FFmpeg
          const command = [
            '-i', inputFilename,
            '-vf', filterChain,
            '-c:v', 'libx264',
            '-preset', preset,
            '-crf', crf,
            '-c:a', 'aac',
            '-b:a', '128k',
            ...(options.frameRate ? ['-r', options.frameRate.toString()] : []),
            '-movflags', '+faststart',
            '-y',
            outputFilename
          ];
          
          console.log('FFmpeg command:', command.join(' '));
          await this.runWithMutex(() => this.ffmpeg.run(...command));
        } catch (error) {
          console.error('Error cropping video:', error);
          throw new Error(`Failed to crop video: ${error}`);
        }
      }
      
      onProgress({ ratio: options.ratio, progress: 90, currentStep: 'Finalizing...' });
      
      // Read the processed file
      const data = this.ffmpeg.FS('readFile', outputFilename);
      
      // Clean up files
      this.ffmpeg.FS('unlink', inputFilename);
      this.ffmpeg.FS('unlink', outputFilename);
      
      onProgress({ ratio: options.ratio, progress: 100, currentStep: 'Done' });
      
      // Create a blob URL for the processed video
      return URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
    } catch (error) {
      console.error(`Failed to export video in ${options.ratio} format:`, error);
      throw new Error(`Failed to export video in ${options.ratio} format: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Extract video dimensions from FFmpeg output
   */
  private async getVideoDimensions(filename: string): Promise<{ width: number, height: number } | null> {
    try {
      // Run ffprobe to get video dimensions
      await this.runWithMutex(() => this.ffmpeg.run(
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height',
        '-of', 'csv=p=0',
        '-i', filename
      ));
      
      // Read the output
      const data = this.ffmpeg.FS('readFile', 'out');
      const dimensionsStr = new TextDecoder().decode(data);
      const [width, height] = dimensionsStr.trim().split(',').map(Number);
      
      if (!isNaN(width) && !isNaN(height)) {
        return { width, height };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting video dimensions:', error);
      return null;
    }
  }

  /**
   * Clean up resources
   */
  async terminate(): Promise<void> {
    if (this.ffmpeg) {
      try {
        await this.runWithMutex(() => this.ffmpeg.exit());
        this.initialized = false;
      } catch (error) {
        console.error('Error terminating FFmpeg:', error);
      }
    }
  }
}

// Create a singleton instance
const videoExportService = new VideoExportService();
export { VideoExportService, ExportProgress };
export default videoExportService;
