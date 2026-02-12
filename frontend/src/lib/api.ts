import type {
  HealthResponse,
  Framework,
  Requirement,
  Assessment,
  ChatMessage,
  ChatResponse,
  GraphData,
} from '@/types'

const API_BASE = '/api/v1'

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`)
  }

  return response.json()
}

export const api = {
  // Health check
  getHealth: () => fetchAPI<HealthResponse>('health'),

  // Frameworks
  getFrameworks: () => fetchAPI<Framework[]>('frameworks'),
  getFramework: (id: number) => fetchAPI<Framework>(`frameworks/${id}`),

  // Requirements
  getRequirements: (frameworkId?: number) => {
    const params = frameworkId ? `?framework_id=${frameworkId}` : ''
    return fetchAPI<Requirement[]>(`requirements${params}`)
  },

  // Assessments
  getAssessments: () => fetchAPI<Assessment[]>('assessments'),
  getAssessment: (id: number) => fetchAPI<Assessment>(`assessments/${id}`),

  // Chat
  chat: (message: ChatMessage) =>
    fetchAPI<ChatResponse>('chat', {
      method: 'POST',
      body: JSON.stringify(message),
    }),

  // Ollama models
  getModels: () => fetchAPI<string[]>('ollama/models'),

  // Knowledge graph
  getGraph: () => fetchAPI<GraphData>('graph'),
}
