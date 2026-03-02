import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react'

export default function Splash() {
  const [isMuted, setIsMuted] = useState(true)

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Marlowe Introduction</h1>
      <div className="relative w-full max-w-7xl overflow-hidden rounded-xl border-2 border-primary/20 bg-muted/30 shadow-lg">
        <video
          src="/marlowe.mp4"
          className="w-full"
          controls
          autoPlay
          muted={isMuted}
          playsInline
        />
        <Button
          variant="secondary"
          size="icon"
          className="absolute right-3 top-3 z-10 rounded-full shadow-md"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          onClick={() => setIsMuted((m) => !m)}
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5" aria-hidden />
          ) : (
            <Volume2 className="h-5 w-5" aria-hidden />
          )}
        </Button>
      </div>
      <Link to="/">
        <Button variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Button>
      </Link>
    </div>
  )
}
