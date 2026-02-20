import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'

const DEFAULT_MODEL = 'qwen3:latest'

interface ChatModelContextValue {
  model: string
  setModel: (model: string) => void
}

const ChatModelContext = createContext<ChatModelContextValue | null>(null)

interface ChatModelProviderProps {
  readonly children: ReactNode
}

export function ChatModelProvider({ children }: ChatModelProviderProps) {
  const [model, setModel] = useState(DEFAULT_MODEL)
  const value = useMemo(() => ({ model, setModel }), [model])
  return (
    <ChatModelContext.Provider value={value}>
      {children}
    </ChatModelContext.Provider>
  )
}

export function useChatModel(): ChatModelContextValue {
  const ctx = useContext(ChatModelContext)
  if (!ctx) throw new Error('useChatModel must be used within ChatModelProvider')
  return ctx
}

export { DEFAULT_MODEL }
