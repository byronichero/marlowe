'use client'

import { useCallback, useRef, useState } from 'react'
import { Mic, Loader2 } from 'lucide-react'
import { useCopilotChatInternal } from '@copilotkit/react-core'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface VoiceButtonProps {
  readonly className?: string
}

export function VoiceButton({ className }: VoiceButtonProps) {
  const { sendMessage } = useCopilotChatInternal({})
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start(200)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Microphone access failed')
    }
  }, [])

  const stopRecordingAndTranscribe = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
    mediaRecorderRef.current = null
    setIsRecording(false)
    const chunks = chunksRef.current
    if (chunks.length === 0) return
    setIsTranscribing(true)
    setError(null)
    try {
      const blob = new Blob(chunks, { type: 'audio/webm' })
      const { text } = await api.transcribe(blob)
      if (text?.trim()) {
        await sendMessage(
          {
            id: crypto.randomUUID(),
            role: 'user',
            content: text.trim(),
          },
          { followUp: true }
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transcription failed')
    } finally {
      setIsTranscribing(false)
    }
  }, [sendMessage])

  const toggle = useCallback(() => {
    if (isTranscribing) return
    if (isRecording) {
      stopRecordingAndTranscribe()
    } else {
      startRecording()
    }
  }, [isRecording, isTranscribing, startRecording, stopRecordingAndTranscribe])

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={toggle}
        disabled={isTranscribing}
        className={cn(
          'h-10 w-10 rounded-full',
          isRecording && 'animate-pulse bg-destructive/20 text-destructive',
          className
        )}
        title={isRecording ? 'Stop and transcribe' : 'Voice input (record, then stop)'}
        aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
      >
        {isTranscribing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>
      {error && (
        <span className="text-xs text-destructive max-w-[120px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  )
}
