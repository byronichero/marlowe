export interface HealthResponse {
  status: string
}

export interface Framework {
  id: number
  name: string
  slug: string
  description?: string
  region?: string
  framework_type?: string
}

export interface FrameworkLibraryItem {
  id: number
  name: string
  slug: string
  description: string | null
  region: string | null
  framework_type: string | null
  has_evidence: boolean
  documents: string[]
  chunk_count: number
  requirement_count: number
}

export interface Requirement {
  id: number
  framework_id: number
  parent_id?: number | null
  identifier: string
  title: string
  description?: string
  level?: string
  family?: string
}

export interface Assessment {
  id: number
  title: string
  status: string
  framework_id: number | null
  organization_id: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface GapAnalysisReport {
  ok: boolean
  framework_id: number
  report: string
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

export interface GraphStats {
  total_nodes: number
  total_relationships: number
  framework_nodes: number
  requirement_nodes: number
  assessment_nodes: number
  avg_relationships_per_requirement: number
}

export interface GraphHealth {
  status: string
  version: string
  timestamp: string
}
