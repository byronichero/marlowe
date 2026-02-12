import { useEffect, useState } from 'react'
import { useChatModel } from '@/contexts/chat-model'
import { api } from '@/lib/api'

export default function Chat() {
  const { model, setModel } = useChatModel()
  const [models, setModels] = useState<string[]>([])

  useEffect(() => {
    api
      .getModels()
      .then((list) => setModels(list))
      .catch(() => setModels([]))
  }, [])

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Chat</h1>
        <p className="text-muted-foreground">
          Ask the Marlowe assistant about governance and compliance. Uses your knowledge base when available.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label htmlFor="chat-model" className="text-sm font-medium text-muted-foreground">
          Model:
        </label>
        <select
          id="chat-model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {['granite3.2:latest', ...models.filter((m) => m !== 'granite3.2:latest')].map((m) => (
            <option key={m} value={m}>
              {m === 'granite3.2:latest' ? `${m} (default)` : m}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4 flex-1">
        <p className="text-sm text-muted-foreground">
          Use the <strong>chat bubble in the bottom-right corner</strong> of the screen to open the assistant. Questions are answered with RAG over your uploaded documents.
        </p>
      </div>
    </div>
  )
}
