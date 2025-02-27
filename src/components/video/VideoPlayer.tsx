import { useEffect, useRef } from 'react'
import ReactPlayer from 'react-player'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../store'
import { setCurrentTime, setDuration, setIsPlaying } from '../../store/slices/videoSlice'

const VideoPlayer = () => {
  const dispatch = useDispatch()
  const playerRef = useRef<ReactPlayer>(null)
  const { url, currentTime, isPlaying, volume } = useSelector((state: RootState) => state.video)

  useEffect(() => {
    if (playerRef.current && Math.abs(playerRef.current.getCurrentTime() - currentTime) > 0.5) {
      playerRef.current.seekTo(currentTime)
    }
  }, [currentTime])

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

  if (!url) {
    return (
      <div className="bg-gray-100 rounded-md flex items-center justify-center h-96">
        <p className="text-gray-500">No video loaded. Please upload a video to begin.</p>
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
        progressInterval={100}
      />
    </div>
  )
}

export default VideoPlayer
