# Video Reformatter App

A React application that takes 16:9 TV drama footage and intelligently reformats it for various social media platforms with different aspect ratios.

![Video Reformatter App](https://raw.githubusercontent.com/tom2tomtomtom/video-reformatter/main/public/screenshot.png)

## 🎯 Problem Statement

When adapting 16:9 TV drama content for social media platforms, simply cropping to standard formats often results in losing important narrative elements. This application solves that challenge by:

1. Identifying key subjects within each scene (speakers, important action)
2. Creating intelligent tracking focus points throughout the video timeline
3. Automatically reformatting content to maintain narrative focus across different aspect ratios

## ✨ Features

- **Upload 16:9 video content** - Work with standard TV/film footage
- **Define focus points throughout the video timeline** - Mark speakers and important elements
- **Auto-format videos for multiple platforms:**
  - 9:16 (TikTok, Instagram/Facebook Stories)
  - 1:1 (Instagram/Facebook Feed)
  - 4:5 (Instagram Feed optimal)
- **Intelligent tracking** of important elements (speakers, key action)
- **Live preview** across different aspect ratios
- **Project management** for storing and retrieving works in progress
- **Export functionality** for generating platform-specific videos

## 🛠️ Technology Stack

- **React 18+** with TypeScript
- **Vite** for fast development
- **Redux Toolkit** for state management
- **Tailwind CSS** for styling
- **FFmpeg WebAssembly** for video processing
- **React-Player** for video playback

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/tom2tomtomtom/video-reformatter.git

# Navigate to the project directory
cd video-reformatter

# Install dependencies
npm install

# Start the development server
npm run dev
```

## 📋 Usage Guide

### 1. Upload Video
- From the home page, click "Upload Video" to select a 16:9 video file
- Supported formats include MP4, MOV, and WebM

### 2. Define Focus Points
- In the editor, use the timeline to navigate through your video
- Click and drag on the video to create focus points for important subjects
- Add descriptions to each focus point (e.g., "Character speaking", "Important action")
- Adjust the duration of each focus point using the timeline markers

### 3. Preview Formats
- Use the format preview panel to see how your video will appear in different aspect ratios
- The preview updates in real-time as you navigate through the timeline

### 4. Export
- Navigate to the export page
- Select which aspect ratios you want to export
- Click "Export Selected Formats" to process and download your videos

## 🧩 Project Structure

```
video-reformatter/
├── src/
│   ├── components/
│   │   ├── common/          # Reusable UI components
│   │   │   ├── Button.tsx   # Custom button component
│   │   │   ├── Loader.tsx   # Loading indicator
│   │   │   └── Modal.tsx    # Modal dialog component
│   │   ├── layout/          # Layout components
│   │   │   ├── Header.tsx   # App header with navigation
│   │   │   └── Footer.tsx   # App footer
│   │   ├── video/           # Video playback and processing
│   │   │   ├── VideoPlayer.tsx       # Main video player
│   │   │   ├── VideoTimeline.tsx     # Timeline navigation
│   │   │   ├── AspectRatioPreview.tsx # Format previews
│   │   │   └── VideoExporter.tsx     # Video export functionality
│   │   └── editor/          # Focus point editing tools
│   │       └── FocusSelector.tsx     # Focus point creation UI
│   ├── pages/               # Main application pages
│   │   ├── Home.tsx         # Landing page with upload
│   │   ├── Editor.tsx       # Video editing interface
│   │   ├── Projects.tsx     # Project management
│   │   └── Export.tsx       # Export configuration
│   ├── store/               # Redux store configuration
│   │   ├── index.ts         # Store setup
│   │   └── slices/          # Redux slices for state
│   │       ├── videoSlice.ts         # Video playback state
│   │       ├── focusPointsSlice.ts   # Focus points data
│   │       └── projectsSlice.ts      # Project management
│   ├── main.tsx             # App entry point
│   ├── App.tsx              # Main application component
│   └── index.css            # Global styles with Tailwind
└── ...
```

## 🔄 Workflow Overview

1. **Upload:** 16:9 video is loaded into the application
2. **Analysis:** User navigates through the video to identify important elements
3. **Focus Points:** User creates focus points at specific timestamps
4. **Preview:** Application displays how content will appear across formats
5. **Export:** Processes video for multiple platforms using FFmpeg

## 🧠 How Focus Tracking Works

The focus tracking system uses a combination of manual selection and intelligent transformation:

1. **Focus Point Definition**
   - Users identify important subjects by drawing bounding boxes
   - Each focus point includes:
     - X/Y coordinates (percentage-based for responsiveness)
     - Width/height dimensions
     - Start and end timestamps
     - Description of the subject

2. **Aspect Ratio Transformation**
   - For each target format (9:16, 1:1, 4:5), the app calculates:
     - Scale factor based on source vs target ratio
     - Transform origin based on focus point coordinates
     - Optimal cropping to maintain subject visibility

3. **Timeline Integration**
   - The app automatically transitions between focus points as the video plays
   - Visual timeline markers show when focus points are active
   - Smooth transitions prevent jarring changes

4. **Export Processing**
   - FFmpeg WebAssembly processes the video client-side (no server needed)
   - Each format is rendered with dynamic cropping based on focus points
   - Video data is processed in chunks to handle large files

## 🌱 Future Enhancements

- **AI-powered subject detection** to automatically identify speakers and important elements
- **Cloud-based processing** for handling larger videos
- **Collaboration features** for team-based workflow
- **Direct publishing** to social media platforms
- **Frame extraction** for better editing precision
- **Automatic scene detection** to suggest focus points

## 🔧 Advanced Configuration

### Video Processing Settings

To optimize video output quality, the FFmpeg processing pipeline can be configured:

```javascript
// Example custom configuration
const ffmpegConfig = {
  codec: 'h264',           // Video codec
  preset: 'medium',        // Encoding speed/quality balance
  crf: 23,                 // Quality factor (lower = better quality)
  pixelFormat: 'yuv420p',  // Pixel format for compatibility
};
```

### Focus Point Fine-Tuning

Advanced users can manually edit JSON configuration for precise control:

```json
{
  "focusPoints": [
    {
      "id": "focus-1",
      "timeStart": 15.5,
      "timeEnd": 22.8,
      "x": 25,
      "y": 30,
      "width": 50,
      "height": 40,
      "description": "Character A speaking",
      "easing": "ease-in-out"
    }
  ]
}
```

## 📄 License

MIT

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! See our contribution guidelines for more information.

## Acknowledgements

- FFmpeg for video processing
- React and Vite teams for excellent development tools
- TailwindCSS for styling utilities
- Redux Toolkit for state management
