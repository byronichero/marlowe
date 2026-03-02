import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { X, Play, Volume2, VolumeX } from 'lucide-react'

const SPLASH_DISMISSED_KEY = 'marlowe-splash-dismissed'
const SPLASH_VIDEO_SRC = '/marlowe.mp4'

interface SplashOverlayProps {
  onDismiss?: () => void
}

export function SplashOverlay({ onDismiss }: SplashOverlayProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(SPLASH_DISMISSED_KEY) === 'true'
      if (!dismissed) {
        setIsVisible(true)
      }
    } catch {
      setIsVisible(true)
    }
  }, [])

  const toggleMute = () => setIsMuted((prev) => !prev)

  const handleDismiss = (persist = false) => {
    try {
      if (persist || dontShowAgain) {
        localStorage.setItem(SPLASH_DISMISSED_KEY, 'true')
      }
    } catch {
      // ignore
    }
    setIsVisible(false)
    onDismiss?.()
  }

  if (!isVisible) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
      role="dialog"
      aria-label="Marlowe introduction"
    >
      {/* Video container */}
      <div className="relative flex min-h-0 w-full max-w-7xl flex-1 items-center justify-center p-4">
        <video
          ref={videoRef}
          src={SPLASH_VIDEO_SRC}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl ring-2 ring-primary/20"
          autoPlay
          muted={isMuted}
          playsInline
          loop={false}
          onCanPlay={() => setIsLoaded(true)}
          onEnded={() => handleDismiss(false)}
        />
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-muted/80">
            <div className="flex flex-col items-center gap-3">
              <Play className="h-12 w-12 animate-pulse text-primary" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls overlay */}
      <div className="flex w-full max-w-7xl flex-col items-center gap-4 px-4 pb-8 pt-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={() => handleDismiss()} className="gap-2">
            Enter Marlowe
          </Button>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <span>Don&apos;t show again</span>
          </label>
        </div>
      </div>

      {/* Top-right controls: Unmute, Skip */}
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full shadow-md"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          onClick={toggleMute}
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5" aria-hidden />
          ) : (
            <Volume2 className="h-5 w-5" aria-hidden />
          )}
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full shadow-md"
          aria-label="Skip intro"
          onClick={() => handleDismiss()}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}

/** Reset splash so it shows again (e.g. for "Watch intro" link) */
export function resetSplashPreference() {
  try {
    localStorage.removeItem(SPLASH_DISMISSED_KEY)
  } catch {
    // ignore
  }
}
