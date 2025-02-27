import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

// Note: We're using a simplified approach with coco-ssd model
// which is optimized for browser use

export interface DetectedObject {
  id: string;
  bbox: [number, number, number, number]; // [x, y, width, height] in pixels
  class: string;
  score: number;
}

export interface DetectionResult {
  objects: DetectedObject[];
  imageWidth: number;
  imageHeight: number;
  error?: string;
}

class SubjectDetectionService {
  private model: any = null;
  private loading: boolean = false;
  private modelLoaded: boolean = false;

  /**
   * Load the model
   */
  async loadModel(): Promise<void> {
    if (this.modelLoaded) {
      return; // Model already loaded
    }

    if (this.loading) {
      // Wait for current loading process to complete
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    try {
      this.loading = true;
      console.log('Loading COCO-SSD model...');

      // Dynamically import the coco-ssd model
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      
      // Load the model - this is optimized for browser use
      this.model = await cocoSsd.load();

      this.modelLoaded = true;
      console.log('COCO-SSD model loaded successfully');
    } catch (error) {
      console.error('Error loading COCO-SSD model:', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Detect objects in the provided image
   */
  async detectObjects(image: HTMLImageElement | HTMLCanvasElement): Promise<DetectionResult> {
    if (!this.modelLoaded) {
      try {
        await this.loadModel();
      } catch (error) {
        return {
          objects: [],
          imageWidth: image.width,
          imageHeight: image.height,
          error: 'Failed to load the object detection model'
        };
      }
    }

    if (!this.model) {
      return {
        objects: [],
        imageWidth: image.width,
        imageHeight: image.height,
        error: 'Model not loaded'
      };
    }

    const imageWidth = image.width;
    const imageHeight = image.height;
    
    let objects: DetectedObject[] = [];

    try {
      // Run inference - coco-ssd handles tensor conversion internally
      const predictions = await this.model.detect(image);
      
      // Convert to our DetectedObject format
      objects = predictions.map((pred: any, i: number) => {
        // bbox is in format [x, y, width, height]
        return {
          id: `detection-${i}`,
          bbox: pred.bbox as [number, number, number, number],
          class: pred.class,
          score: pred.score
        };
      });
    } catch (error) {
      console.error('Error during object detection:', error);
      return {
        objects: [],
        imageWidth,
        imageHeight,
        error: 'Failed to perform object detection'
      };
    }

    return {
      objects,
      imageWidth,
      imageHeight
    };
  }

  /**
   * Convert detection results to focus points
   */
  convertToFocusPoints(
    detectionResult: DetectionResult, 
    currentTime: number, 
    duration: number = 5
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
    const { objects, imageWidth, imageHeight } = detectionResult;
    
    // Convert detected objects to focus points
    return objects.map(obj => {
      // Convert pixel coordinates to percentages
      const [x, y, width, height] = obj.bbox;
      
      return {
        id: `focus-${Date.now()}-${obj.id}`,
        timeStart: currentTime,
        timeEnd: currentTime + duration,
        x: (x / imageWidth) * 100,
        y: (y / imageHeight) * 100,
        width: (width / imageWidth) * 100,
        height: (height / imageHeight) * 100,
        description: `${obj.class} (${Math.round(obj.score * 100)}% confidence)`
      };
    });
  }
}

export default new SubjectDetectionService();