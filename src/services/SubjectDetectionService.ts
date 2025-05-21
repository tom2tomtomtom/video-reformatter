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
  private lastError: Error | null = null;
  private loadPromise: Promise<void> | null = null;

  /**
   * Initialize the detection service
   */
  async initialize(): Promise<void> {
    console.log('Initializing subject detection service');
    return this.loadModel();
  }

  /**
   * Load the model with improved error handling and caching
   */
  async loadModel(): Promise<void> {
    // If model is already loaded and valid, reuse it
    if (this.modelLoaded && this.model) {
      console.log('Model already loaded, reusing existing model');
      return;
    }

    // If already loading, return existing promise or create a new wait promise
    if (this.loading) {
      console.log('Model is currently loading, waiting for completion...');
      if (this.loadPromise) {
        return this.loadPromise;
      }
      
      const startWaitTime = Date.now();
      const maxWaitTime = 30000; // 30 seconds max wait
      
      return new Promise<void>((resolve, reject) => {
        const checkLoading = () => {
          if (!this.loading) {
            if (this.modelLoaded && this.model) {
              resolve();
            } else if (this.lastError) {
              reject(this.lastError);
            } else {
              reject(new Error('Model failed to load for unknown reason'));
            }
            return;
          }
          
          if (Date.now() - startWaitTime > maxWaitTime) {
            reject(new Error('Timeout waiting for model to load'));
            return;
          }
          
          setTimeout(checkLoading, 100);
        };
        
        checkLoading();
      });
    }

    // Start a new loading process
    this.loading = true;
    this.lastError = null;
    
    // Create a promise for this loading instance and store it
    this.loadPromise = (async () => {
      try {
        console.log('Loading COCO-SSD model...');
        
        // Check if TensorFlow is available
        if (!tf) {
          const error = new Error('TensorFlow is not defined! Check if @tensorflow/tfjs is installed correctly');
          console.error(error.message);
          throw error;
        }
        
        console.log('TensorFlow version:', tf.version);
        console.log('TensorFlow backend:', tf.getBackend());
        
        // Ensure WebGL backend is ready for better performance
        if (tf.getBackend() !== 'webgl') {
          console.log('Setting WebGL backend...');
          try {
            await tf.setBackend('webgl');
            await tf.ready(); // Wait for backend to be fully ready
            console.log('Successfully set WebGL backend');
          } catch (err) {
            console.error('Error setting WebGL backend:', err);
            console.log('Continuing with current backend:', tf.getBackend());
          }
        }

        // Dynamically import the coco-ssd model
        console.log('Dynamically importing coco-ssd model...');
        const cocoSsd = await import('@tensorflow-models/coco-ssd');
        console.log('coco-ssd import successful');
        
        // Load the model with a lighter configuration for better performance
        console.log('Loading model...');
        this.model = await cocoSsd.load({
          base: 'lite_mobilenet_v2' // Use lighter model variant
        });
        
        if (!this.model) {
          throw new Error('Model loaded but returned null/undefined');
        }
        
        console.log('Model loading successful');
        this.modelLoaded = true;
        console.log('COCO-SSD model loaded successfully');
      } catch (error) {
        console.error('Error loading COCO-SSD model:', error);
        this.lastError = error instanceof Error ? error : new Error(String(error));
        this.modelLoaded = false;
        throw error;
      } finally {
        this.loading = false;
      }
    })();
    
    return this.loadPromise;
  }

  /**
   * Detect objects in the provided image
   */
  async detectObjects(image: HTMLImageElement | HTMLCanvasElement): Promise<DetectionResult> {
    // Add timestamp for performance tracking
    const startTime = performance.now();
    console.log('Starting object detection...');
    
    if (!this.modelLoaded || !this.model) {
      try {
        console.log('Model not loaded, loading now...');
        await this.loadModel();
        console.log('Model loaded successfully for detection');
      } catch (error) {
        console.error('Failed to load the object detection model:', error);
        return {
          objects: [],
          imageWidth: image.width,
          imageHeight: image.height,
          error: 'Failed to load the object detection model'
        };
      }
    }

    // Double check model is available
    if (!this.model) {
      console.error('Model still not available after loading attempt');
      return {
        objects: [],
        imageWidth: image.width,
        imageHeight: image.height,
        error: 'Model not loaded'
      };
    }

    const imageWidth = image.width;
    const imageHeight = image.height;
    console.log(`Detecting objects in image (${imageWidth}x${imageHeight})`);
    
    // Verify the image data is valid
    if (imageWidth === 0 || imageHeight === 0) {
      console.error('Invalid image dimensions for detection');
      return {
        objects: [],
        imageWidth,
        imageHeight,
        error: 'Invalid image dimensions'
      };
    }
    
    let objects: DetectedObject[] = [];

    try {
      // Use a timeout promise to prevent hanging
      const detectionTimeout = 10000; // 10 seconds
      
      const detectionPromise = this.model.detect(image, 20); // Limit to 20 detections for performance
      
      // Create a race between detection and timeout
      const predictions = await Promise.race([
        detectionPromise,
        new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Detection timeout')), detectionTimeout);
        })
      ]);
      
      const detectionTime = Math.round(performance.now() - startTime);
      console.log(`Detection complete in ${detectionTime}ms, found ${predictions?.length || 0} objects`);
      
      if (predictions && Array.isArray(predictions) && predictions.length > 0) {
        // Convert to our DetectedObject format with unique IDs
        objects = predictions.map((pred: any, i: number) => {
          return {
            id: `${pred.class}_${Date.now()}_${i}`,
            bbox: pred.bbox as [number, number, number, number],
            class: pred.class,
            score: pred.score
          };
        });
        
        // Log detected objects for debugging
        if (objects.length > 0) {
          console.log(`Detected ${objects.length} objects:`);
          objects.forEach(obj => {
            console.log(`- ${obj.class} (${Math.round(obj.score * 100)}%)`);
          });
        }
      } else {
        console.log('No objects detected in this frame');
      }
    } catch (error) {
      console.error('Error during object detection:', error);
      
      // If it's a timeout, provide a specific error message
      const errorMsg = error.message?.includes('timeout') ? 
        'Detection timed out' : 'Failed to perform object detection';
      
      return {
        objects: [],
        imageWidth,
        imageHeight,
        error: errorMsg
      };
    }

    return {
      objects,
      imageWidth,
      imageHeight
    };
  }

  /**
   * Method for backward compatibility
   */
  async detectObjectsInCanvas(canvas: HTMLCanvasElement): Promise<DetectedObject[]> {
    const result = await this.detectObjects(canvas);
    return result.objects;
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

// Export a singleton instance
const service = new SubjectDetectionService();
export default service;