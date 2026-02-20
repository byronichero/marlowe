import { useEffect, useState } from 'react'
import { useChatModel } from '@/contexts/chat-model'
import { CopilotChat } from '@copilotkit/react-ui'
import { api } from '@/lib/api'

export default function Home() {
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
      <div className="flex items-center gap-3">
        <img
          src="/marlowe.jpeg"
          alt="Marlowe"
          className="h-12 w-12 rounded-lg object-cover"
        />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marlowe Assistant</h1>
          <p className="text-muted-foreground">
            Ask about governance, frameworks, and your knowledge base. Uses the Marlowe system prompt and RAG.
          </p>
        </div>
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
          {['qwen3:latest', ...models.filter((m) => m !== 'qwen3:latest')].map((m) => (
            <option key={m} value={m}>
              {m === 'qwen3:latest' ? `${m} (default)` : m}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4 flex-1 min-h-0">
        <CopilotChat
          labels={{
            title: 'Marlowe Assistant',
            initial: 'Ask about governance, frameworks, or your knowledge base. Questions use RAG over your uploaded documents.',
          }}
        />
      </div>
    </div>
  )
}
