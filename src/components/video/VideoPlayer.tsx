import { useEffect, useRef, useState } from 'react'
import ReactPlayer from 'react-player'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../store'
import { setCurrentTime, setDuration, setIsPlaying } from '../../store/slices/videoSlice'

const VideoPlayer = () => {
  const dispatch = useDispatch()
  const playerRef = useRef<ReactPlayer>(null)
  const { url, currentTime, isPlaying, volume } = useSelector((state: RootState) => state.video)
  const [videoError, setVideoError] = useState(false)

  useEffect(() => {
    if (playerRef.current && Math.abs(playerRef.current.getCurrentTime() - currentTime) > 0.5) {
      playerRef.current.seekTo(currentTime)
    }
  }, [currentTime])

  useEffect(() => {
    // Reset error state when URL changes
    if (url) {
      setVideoError(false)
    }
  }, [url])

  const handleDuration = (duration: number) => {
    dispatch(setDuration(duration))
  }

  const handleProgress = ({ playedSeconds }: { playedSeconds: number }) => {
    dispatch(setCurrentTime(playedSeconds))
  }

  const handlePlay = () => {
    dispatch(setIsPlaying(true))
  }

  const handlePause = () => {
    dispatch(setIsPlaying(false))
  }

  const handleError = () => {
    console.error('Error playing video')
    setVideoError(true)
  }

  if (!url) {
    return (
      <div className="bg-gray-100 rounded-md flex items-center justify-center h-96">
        <p className="text-gray-500">No video loaded. Please upload a video to begin.</p>
      </div>
    )
  }

  if (videoError) {
    return (
      <div className="bg-red-50 rounded-md flex items-center justify-center h-96">
        <div className="text-center p-4">
          <p className="text-red-600 font-medium mb-2">Error playing video</p>
          <p className="text-gray-600">The uploaded file might not be a supported video format.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative bg-black rounded-md overflow-hidden aspect-video w-full">
      <ReactPlayer
        ref={playerRef}
        url={url}
        width="100%"
        height="100%"
        playing={isPlaying}
        volume={volume}
        onDuration={handleDuration}
        onProgress={handleProgress}
        onPlay={handlePlay}
        onPause={handlePause}
        onError={handleError}
        progressInterval={100}
        fallback={
          <div className="flex items-center justify-center h-full bg-gray-100">
            <p className="text-gray-500">Loading video...</p>
          </div>
        }
      />
    </div>
  )
}

export default VideoPlayer
