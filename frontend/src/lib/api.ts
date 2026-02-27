import type {
  HealthResponse,
  Framework,
  FrameworkLibraryItem,
  Requirement,
  Assessment,
  ChatMessage,
  ChatResponse,
  GraphData,
  GraphHealth,
  GraphStats,
  ReportsResponse,
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
    let message = response.statusText
    try {
      const body = await response.json() as { detail?: string }
      if (body?.detail) {
        message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
      }
    } catch {
      // Ignore JSON parse error
    }
    throw new Error(message)
  }

  return response.json()
}

export const api = {
  // Health check
  getHealth: () => fetchAPI<HealthResponse>('health'),

  // Frameworks
  getFrameworks: () => fetchAPI<Framework[]>('frameworks'),
  getFrameworksLibrary: () => fetchAPI<FrameworkLibraryItem[]>('frameworks/library'),
  getFramework: (id: number) => fetchAPI<Framework>(`frameworks/${id}`),
  createFramework: (data: Omit<Framework, 'id'>) =>
    fetchAPI<Framework>('frameworks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getFrameworkEvidence: (frameworkId: number) =>
    fetchAPI<{ framework_id: number; chunk_count: number; documents: string[]; has_evidence: boolean }>(
      `frameworks/${frameworkId}/evidence`
    ),
  extractRequirements: (frameworkId: number, model?: string, scope?: string) => {
    const searchParams = new URLSearchParams()
    if (model) searchParams.set('model', model)
    if (scope) searchParams.set('scope', scope)
    const params = searchParams.toString() ? `?${searchParams}` : ''
    return fetchAPI<{ ok: boolean; extracted: number; created: number; skipped: number; error?: string }>(
      `frameworks/${frameworkId}/extract-requirements${params}`,
      { method: 'POST' }
    )
  },

  // Documents (for framework-linked uploads)
  uploadFrameworkDocument: (
    frameworkId: number,
    file: File,
    onProgress?: (percent: number) => void
  ) =>
    new Promise<{ job_id: string; filename: string }>((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('framework_id', String(frameworkId))

      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API_BASE}/documents/upload`, true)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch (err) {
            reject(err)
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`))
        }
      }
      xhr.onerror = () => reject(new Error('Upload failed'))
      xhr.send(formData)
    }),
  getUploadJobStatus: (jobId: string) =>
    fetchAPI<{
      job_id: string
      status: string
      filename: string
      chunks?: number
      error?: string
    }>(`documents/jobs/${jobId}`),

  // Semantic search over knowledge base (Qdrant)
  searchDocuments: (query: string, limit?: number) => {
    const params = new URLSearchParams({ q: query })
    if (limit != null) params.set('limit', String(limit))
    return fetchAPI<{
      results: Array<{ text: string; source: string; score: number }>
    }>(`documents/search?${params.toString()}`)
  },

  // Requirements
  getRequirements: (frameworkId?: number) => {
    const params = frameworkId ? `?framework_id=${frameworkId}` : ''
    return fetchAPI<Requirement[]>(`requirements${params}`)
  },
  createRequirement: (data: Omit<Requirement, 'id'>) =>
    fetchAPI<Requirement>('requirements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Reports
  getReports: (filters?: {
    assessment_id?: number
    framework_id?: number
    from_date?: string
    to_date?: string
  }) => {
    const params = new URLSearchParams()
    if (filters?.assessment_id != null) params.set('assessment_id', String(filters.assessment_id))
    if (filters?.framework_id != null) params.set('framework_id', String(filters.framework_id))
    if (filters?.from_date) params.set('from_date', filters.from_date)
    if (filters?.to_date) params.set('to_date', filters.to_date)
    const query = params.toString() ? `?${params}` : ''
    return fetchAPI<ReportsResponse>(`reports${query}`)
  },

  // Assessments
  getAssessments: (frameworkId?: number) => {
    const params = frameworkId ? `?framework_id=${frameworkId}` : ''
    return fetchAPI<Assessment[]>(`assessments${params}`)
  },
  getAssessment: (id: number) => fetchAPI<Assessment>(`assessments/${id}`),

  // Gap analysis (background job)
  startGapAnalysis: (frameworkId: number) =>
    fetchAPI<{ job_id: string; framework_id: number; message?: string }>(
      `gap-analysis/run?framework_id=${frameworkId}`,
      { method: 'POST' }
    ),
  getGapAnalysisJobStatus: (jobId: string) =>
    fetchAPI<{
      job_id: string
      status: string
      percent: number
      step: string
      framework_id?: number
      report?: string | null
      error?: string | null
    }>(`gap-analysis/jobs/${jobId}`),

  // Chat
  chat: (message: ChatMessage) =>
    fetchAPI<ChatResponse>('chat', {
      method: 'POST',
      body: JSON.stringify(message),
    }),

  // Ollama models
  getModels: () => fetchAPI<string[]>('ollama/models'),

  // NIST 800-53 seed (official catalog, no upload needed)
  seedNist80053: (replace?: boolean) =>
    fetchAPI<{ ok: boolean; framework_id: number; controls_created: number; error?: string }>(
      `nist/seed?replace_existing=${replace ?? false}`,
      { method: 'POST' }
    ),
  // NIST AI RMF Trustworthiness Taxonomy seed (docs/taxonomy-ai.md)
  seedNistAiRmfTaxonomy: (replace?: boolean, mvpOnly?: boolean) =>
    fetchAPI<{ ok: boolean; framework_id: number; properties_created: number; error?: string }>(
      `nist/taxonomy/seed?replace_existing=${replace ?? false}&mvp_only=${mvpOnly ?? false}`,
      { method: 'POST' }
    ),

  // Knowledge graph (optional signal for abort/cancel)
  getGraph: (frameworkId?: number, fedrampBaseline?: string, signal?: AbortSignal) => {
    const params = new URLSearchParams()
    if (frameworkId) params.set('framework_id', String(frameworkId))
    if (fedrampBaseline) params.set('fedramp_baseline', fedrampBaseline)
    return fetchAPI<GraphData>(
      params.toString() ? `graph?${params}` : 'graph',
      signal ? { signal } : undefined
    )
  },
  getGraphStats: (frameworkId?: number, fedrampBaseline?: string, signal?: AbortSignal) => {
    const params = new URLSearchParams()
    if (frameworkId) params.set('framework_id', String(frameworkId))
    if (fedrampBaseline) params.set('fedramp_baseline', fedrampBaseline)
    return fetchAPI<GraphStats>(
      params.toString() ? `graph/stats?${params}` : 'graph/stats',
      signal ? { signal } : undefined
    )
  },
  getGraphHealth: () => fetchAPI<GraphHealth>('graph/health'),
  syncGraph: () =>
    fetchAPI<{ ok: boolean; frameworks: number; requirements: number; evidence?: number }>(
      'graph/sync',
      { method: 'POST' }
    ),
  getCrosswalk: (frameworkA: number, frameworkB: number) =>
    fetchAPI<{
      mappings: Array<{
        requirement_a: { id: number; identifier: string; title: string; description?: string }
        requirement_b: { id: number; identifier: string; title: string; description?: string }
        similarity: number
      }>
      framework_a: { id: number; name: string }
      framework_b: { id: number; name: string }
    }>(`graph/crosswalk?framework_a=${frameworkA}&framework_b=${frameworkB}`),

  // Voice STT: upload audio, get transcribed text
  transcribe: async (audioBlob: Blob, language?: string): Promise<{ text: string }> => {
    const form = new FormData()
    form.append('audio', audioBlob, 'recording.webm')
    const url = language
      ? `${API_BASE}/voice/transcribe?language=${encodeURIComponent(language)}`
      : `${API_BASE}/voice/transcribe`
    const response = await fetch(url, {
      method: 'POST',
      body: form,
    })
    if (!response.ok) {
      let message = response.statusText
      try {
        const body = (await response.json()) as { detail?: string }
        if (body?.detail) {
          message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
        }
      } catch {
        /* ignore */
      }
      throw new Error(message)
    }
    return response.json()
  },
}
