import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CopilotKit } from '@copilotkit/react-core'
import '@copilotkit/react-ui/styles.css'
import { ChatModelProvider, useChatModel } from './contexts/chat-model'
import App from './App.tsx'
import './index.css'

function CopilotKitWithModel() {
  const { model } = useChatModel()
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="marlowe_agent"
      properties={{ model }}
    >
      <App />
    </CopilotKit>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ChatModelProvider>
        <CopilotKitWithModel />
      </ChatModelProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
