import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

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
  private model: tf.GraphModel | null = null;
  private loading: boolean = false;
  private modelLoaded: boolean = false;
  private modelUrl = 'https://storage.googleapis.com/tfjs-models/savedmodel/ssd_mobilenet_v2/model.json';
  private classes: string[] = [];

  constructor() {
    // COCO dataset classes - used by the SSD MobileNet v2 model
    this.classes = [
      'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
      'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog',
      'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella',
      'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball', 'kite',
      'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket', 'bottle',
      'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich',
      'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
      'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote',
      'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book',
      'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
    ];
  }

  /**
   * Load the TensorFlow.js model
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
      console.log('Loading TensorFlow.js model...');

      // Set up TensorFlow.js and load the model
      await tf.ready();
      this.model = await tf.loadGraphModel(this.modelUrl);
      
      // Warm up the model with a dummy prediction
      const dummyInput = tf.zeros([1, 300, 300, 3]);
      await this.model.executeAsync(dummyInput);
      dummyInput.dispose();

      this.modelLoaded = true;
      console.log('TensorFlow.js model loaded successfully');
    } catch (error) {
      console.error('Error loading TensorFlow.js model:', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Convert an image element to a tensor for model input
   */
  private imageToTensor(image: HTMLImageElement | HTMLCanvasElement): tf.Tensor {
    return tf.tidy(() => {
      // Convert image to tensor and normalize
      const tensor = tf.browser.fromPixels(image);
      
      // Resize to 300x300 (input size for SSD MobileNet)
      const resized = tf.image.resizeBilinear(tensor, [300, 300]);
      
      // Expand dimensions to match model input shape [1, 300, 300, 3]
      const expanded = resized.expandDims(0);
      
      // Return the processed tensor
      return expanded;
    });
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
      // Convert image to tensor
      const imageTensor = this.imageToTensor(image);

      // Run inference
      const result = await this.model.executeAsync(imageTensor) as tf.Tensor[];
      
      // Process results
      // SSD MobileNet returns 4 tensors:
      // - detection boxes [1, num_detections, 4] - normalized boxes [y1, x1, y2, x2]
      // - detection scores [1, num_detections]
      // - detection classes [1, num_detections]
      // - num_detections [1]
      
      // Convert to arrays for processing
      const boxes = await result[0].arraySync() as number[][][];
      const scores = await result[1].arraySync() as number[][];
      const classes = await result[2].arraySync() as number[][];
      
      // Clean up tensors
      tf.dispose(result);
      tf.dispose(imageTensor);
      
      // Extract and filter detections
      const threshold = 0.5; // Min confidence score
      const [boxesArray, scoresArray, classesArray] = [boxes[0], scores[0], classes[0]];
      
      // Process detections
      objects = boxesArray
        .map((box, i) => {
          const score = scoresArray[i];
          const classId = Math.round(classesArray[i]);
          
          // Skip low confidence detections
          if (score < threshold) return null;
          
          // Original box is [y1, x1, y2, x2] normalized, convert to [x, y, width, height] in pixels
          const [y1, x1, y2, x2] = box;
          const x = x1 * imageWidth;
          const y = y1 * imageHeight;
          const width = (x2 - x1) * imageWidth;
          const height = (y2 - y1) * imageHeight;
          
          return {
            id: `detection-${i}`,
            bbox: [x, y, width, height] as [number, number, number, number],
            class: this.classes[classId - 1] || 'unknown',
            score
          };
        })
        .filter((obj): obj is DetectedObject => obj !== null);
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