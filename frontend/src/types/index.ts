export interface HealthResponse {
  status: string
}

export interface Framework {
  id: number
  name: string
  version?: string
  description?: string
  url?: string
}

export interface Requirement {
  id: number
  framework_id: number
  identifier: string
  title: string
  description?: string
  level?: string
  family?: string
}

export interface Assessment {
  id: number
  framework_id: number
  organization?: string
  scope?: string
  status: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  message: string
  model?: string
  context_document_ids?: number[]
}

export interface ChatResponse {
  reply: string
  model_used?: string
}

export interface GraphNode {
  id: string
  label: string
  group?: string
  title?: string
}

export interface GraphEdge {
  from: string
  to: string
  label?: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
