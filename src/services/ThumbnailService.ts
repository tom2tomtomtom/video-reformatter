import { ClipSegment } from './ClipDetectionService';

// Local placeholder image (gray square with video icon)
const PLACEHOLDER_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAADIAQMAAACBzG6DAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAANQTFRF////p8QbyAAAADFJREFUeJztwTEBAAAAwqD1T20ND6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4G8uQAABGlogfAAAAABJRU5ErkJggg==';


/**
 * Service for generating and managing video thumbnails
 */
class ThumbnailService {
  /**
   * Generate a thumbnail for a video at a specific time
   * @param videoUrl URL of the video
   * @param time Time in seconds to capture thumbnail
   * @returns Promise that resolves to thumbnail data URL
   */
  async generateThumbnail(videoUrl: string, time: number): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create temporary video element
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous'; // Handle CORS
      video.preload = 'auto';
      video.muted = true; // Required for some browsers
      video.playsInline = true;
      
      // Add a timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.warn('Thumbnail generation timed out');
        // Return a placeholder thumbnail instead of failing
        resolve(PLACEHOLDER_IMAGE);
      }, 5000);
      
      // Set up event handlers
      video.onerror = () => {
        clearTimeout(timeout);
        console.error('Video error during thumbnail generation');
        // Return a placeholder instead of failing
        resolve(PLACEHOLDER_IMAGE);
      };
      
      // Use onloadeddata which is more reliable than onloadedmetadata for some browsers
      video.onloadeddata = () => {
        // Seek to the desired time only after we have some data
        video.currentTime = Math.min(time, video.duration || 0);
      };
      
      video.onseeked = () => {
        try {
          clearTimeout(timeout);
          
          // Create canvas and draw video frame
          const canvas = document.createElement('canvas');
          // Set reasonable dimensions if video dimensions are not available
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 180;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error('Failed to get canvas context');
            resolve(PLACEHOLDER_IMAGE);
            return;
          }
          
          // Draw the video frame on the canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert to data URL
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          // Clean up
          video.pause();
          video.removeAttribute('src');
          video.load();
          
          resolve(dataUrl);
        } catch (error) {
          console.error('Error in thumbnail generation:', error);
          resolve(PLACEHOLDER_IMAGE);
        }
      };
      
      // Set the src last to start loading
      video.src = videoUrl;
    });
  }

  /**
   * Generate thumbnails for a collection of clips
   * @param videoUrl URL of the video
   * @param clips Array of clip segments
   * @returns Promise resolving to clips with thumbnails
   */
  async generateThumbnailsForClips(videoUrl: string, clips: ClipSegment[]): Promise<ClipSegment[]> {
    const updatedClips = [...clips];
    
    for (let i = 0; i < updatedClips.length; i++) {
      try {
        // Calculate thumbnail time (1 second into the clip, or midpoint if short)
        const clip = updatedClips[i];
        const clipDuration = clip.endTime - clip.startTime;
        const thumbnailTime = clip.startTime + Math.min(1, clipDuration / 2);
        
        // Generate the thumbnail
        const thumbnail = await this.generateThumbnail(videoUrl, thumbnailTime);
        updatedClips[i] = { ...clip, thumbnail };
      } catch (error) {
        console.error(`Failed to generate thumbnail for clip ${i}:`, error);
      }
    }
    
    return updatedClips;
  }
}

// Create a singleton instance
const thumbnailService = new ThumbnailService();
export default thumbnailService;
