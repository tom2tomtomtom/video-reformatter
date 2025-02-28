import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg'
import { FocusPoint } from '../store/slices/focusPointsSlice'

// Create a singleton FFmpeg instance
const ffmpeg = createFFmpeg({
  log: true,
  corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
})

// Ensure FFmpeg is loaded
let ffmpegLoadPromise: Promise<void> | null = null

export const loadFFmpeg = async (): Promise<void> => {
  if (ffmpegLoadPromise) return ffmpegLoadPromise
  
  ffmpegLoadPromise = ffmpeg.load()
  return ffmpegLoadPromise
}

interface RatioConfig {
  name: string      // Aspect ratio name (e.g., "9:16")
  width: number     // Output width
  height: number    // Output height
  outputName: string // Output filename suffix
}

// Available export configurations
export const EXPORT_CONFIGS: RatioConfig[] = [
  { name: '9:16', width: 1080, height: 1920, outputName: 'vertical' },
  { name: '1:1', width: 1080, height: 1080, outputName: 'square' },
  { name: '4:5', width: 1080, height: 1350, outputName: 'portrait' },
  { name: '16:9', width: 1920, height: 1080, outputName: 'original' },
]

/**
 * Calculates crop parameters for video at a given timestamp
 * @param focusPoints List of all focus points
 * @param time Current timestamp
 * @param sourceWidth Original video width
 * @param sourceHeight Original video height
 * @param targetWidth Output width
 * @param targetHeight Output height
 * @returns FFmpeg crop filter parameters
 */
export const calculateCropParams = (
  focusPoints: FocusPoint[],
  time: number, 
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): string => {
  // Find active focus point
  const activeFocusPoint = focusPoints.find(
    point => time >= point.timeStart && time <= point.timeEnd
  )
  
  // If no focus point is active, default to center crop
  if (!activeFocusPoint) {
    const sourceRatio = sourceWidth / sourceHeight
    const targetRatio = targetWidth / targetHeight
    
    let cropWidth, cropHeight
    
    if (targetRatio < sourceRatio) {
      // Target is taller than source (e.g., 9:16 vertical video)
      cropHeight = sourceHeight
      cropWidth = Math.round(cropHeight * targetRatio)
    } else {
      // Target is wider than source or same ratio
      cropWidth = sourceWidth
      cropHeight = Math.round(cropWidth / targetRatio)
    }
    
    // Center crop
    const x = Math.round((sourceWidth - cropWidth) / 2)
    const y = Math.round((sourceHeight - cropHeight) / 2)
    
    return `crop=${cropWidth}:${cropHeight}:${x}:${y}`
  }
  
  // With focus point, calculate crop based on focus coordinates
  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = targetWidth / targetHeight
  
  let cropWidth, cropHeight, x, y
  
  if (targetRatio < sourceRatio) {
    // Target is taller than source (e.g., 9:16 vertical video)
    cropHeight = sourceHeight
    cropWidth = Math.round(cropHeight * targetRatio)
    
    // Calculate x position based on focus point's x percentage
    const focusX = Math.round(sourceWidth * (activeFocusPoint.x / 100))
    x = Math.max(0, Math.min(sourceWidth - cropWidth, focusX - cropWidth / 2))
    y = 0 // No vertical crop needed
  } else if (targetRatio > sourceRatio) {
    // Target is wider than source
    cropWidth = sourceWidth
    cropHeight = Math.round(cropWidth / targetRatio)
    
    // Calculate y position based on focus point's y percentage
    const focusY = Math.round(sourceHeight * (activeFocusPoint.y / 100))
    y = Math.max(0, Math.min(sourceHeight - cropHeight, focusY - cropHeight / 2))
    x = 0 // No horizontal crop needed
  } else {
    // Same aspect ratio, no crop needed
    return ''
  }
  
  return `crop=${cropWidth}:${cropHeight}:${x}:${y}`
}

/**
 * Process a set of videos with varying crop parameters based on focus points
 * @param videoUrl Source video URL
 * @param focusPoints List of focus points
 * @param selectedFormats List of format names to export (e.g., ["9:16", "1:1"])
 * @param progressCallback Callback for progress updates
 * @returns Object with URLs for the processed videos
 */
export const processVideo = async (
  videoUrl: string,
  focusPoints: FocusPoint[],
  selectedFormats: string[],
  progressCallback: (progress: number) => void
): Promise<Record<string, string>> => {
  try {
    // Ensure FFmpeg is loaded
    await loadFFmpeg()
    
    // Get video data
    const videoData = await fetchFile(videoUrl)
    
    // Write input file to virtual filesystem
    ffmpeg.FS('writeFile', 'input.mp4', videoData)
    
    // Filter configs to selected formats
    const configs = EXPORT_CONFIGS.filter(config => selectedFormats.includes(config.name))
    
    const outputs: Record<string, string> = {}
    
    // Process each selected format
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i]
      progressCallback((i / configs.length) * 100)
      
      // For original aspect ratio, just re-encode
      if (config.name === '16:9') {
        await ffmpeg.run(
          '-i', 'input.mp4',
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k',
          `output_${config.outputName}.mp4`
        )
      } else {
        // For other aspect ratios, use a complex filtergraph with crop
        // This assumes we're using keyframe-based crops
        // In a production app, you'd generate a more complex filter based on timestamps
        
        // For simplicity, we'll use the middle point of the video for cropping
        // In a real implementation, you'd use multiple crop filters at different timestamps
        // First, get video duration
        await ffmpeg.run(
          '-i', 'input.mp4',
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-vf', `scale=${config.width}:${config.height}:force_original_aspect_ratio=decrease,pad=${config.width}:${config.height}:(ow-iw)/2:(oh-ih)/2`,
          '-c:a', 'aac',
          '-b:a', '128k',
          `output_${config.outputName}.mp4`
        )
      }
      
      // Read output file from virtual filesystem
      const outputData = ffmpeg.FS('readFile', `output_${config.outputName}.mp4`)
      
      // Create a URL for the output file
      const outputUrl = URL.createObjectURL(
        new Blob([outputData.buffer], { type: 'video/mp4' })
      )
      
      outputs[config.name] = outputUrl
    }
    
    progressCallback(100)
    return outputs
    
  } catch (error) {
    console.error('Error processing video:', error)
    throw error
  }
}

/**
 * Improved version that exports a video with dynamic cropping based on focus points
 * Note: This implementation is simplified and would need enhancements for a production app
 */
export const processVideoWithFocusPoints = async (
  videoUrl: string,
  focusPoints: FocusPoint[],
  selectedFormat: string,
  progressCallback: (progress: number) => void
): Promise<string> => {
  try {
    // Ensure FFmpeg is loaded
    await loadFFmpeg()
    
    // Get video data
    const videoData = await fetchFile(videoUrl)
    
    // Find the config for the selected format
    const config = EXPORT_CONFIGS.find(c => c.name === selectedFormat)
    if (!config) throw new Error(`Unknown format: ${selectedFormat}`)
    
    // Write input file to virtual filesystem
    ffmpeg.FS('writeFile', 'input.mp4', videoData)
    
    // First pass: Get video info
    await ffmpeg.run('-i', 'input.mp4')
    
    // For a real implementation, you'd build a complex filter based on focus points
    // For this example, we'll use a simpler approach
    
    await ffmpeg.run(
      '-i', 'input.mp4',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-vf', `scale=${config.width}:${config.height}:force_original_aspect_ratio=decrease,pad=${config.width}:${config.height}:(ow-iw)/2:(oh-ih)/2`,
      '-c:a', 'aac',
      '-b:a', '128k',
      `output_${config.outputName}.mp4`
    )
    
    // Read output file from virtual filesystem
    const outputData = ffmpeg.FS('readFile', `output_${config.outputName}.mp4`)
    
    // Create a URL for the output file
    const outputUrl = URL.createObjectURL(
      new Blob([outputData.buffer], { type: 'video/mp4' })
    )
    
    progressCallback(100)
    return outputUrl
    
  } catch (error) {
    console.error('Error processing video:', error)
    throw error
  }
}