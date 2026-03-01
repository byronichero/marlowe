import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, ArrowLeft } from 'lucide-react'

interface ReadinessChecklist {
  ai_trustworthiness_taxonomy: {
    title: string
    description: string
    dimensions: Array<{
      name: string
      checks: string[]
    }>
    implementation_questions: string[]
    scoring_guide: {
      scale: string
      categories: string[]
    }
    action_plan_template: {
      immediate_actions: string[]
      short_term_actions: string[]
      long_term_actions: string[]
    }
    notes: string
  }
}

interface CheckState {
  checked: boolean
  score: number | null
  notes: string
}

interface ReadinessState {
  version: string
  updated_at: string
  checks: Record<string, CheckState>
}

interface ActionPlanItem {
  id: string
  text: string
  score: number
}

const STORAGE_KEY = 'aiReadiness:v1'
const SCORE_OPTIONS = [1, 2, 3, 4, 5]

function buildCheckId(dimensionName: string, index: number): string {
  const code = dimensionName
    .replaceAll('&', 'and')
    .replaceAll(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
  return `${code}.${String(index + 1).padStart(2, '0')}`
}

function loadStoredState(): ReadinessState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ReadinessState
  } catch {
    return null
  }
}

function saveStoredState(state: ReadinessState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function isReadinessState(value: unknown): value is ReadinessState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as ReadinessState
  if (typeof candidate.version !== 'string') return false
  if (typeof candidate.updated_at !== 'string') return false
  if (!candidate.checks || typeof candidate.checks !== 'object') return false
  return Object.values(candidate.checks).every((entry) => {
    if (!entry || typeof entry !== 'object') return false
    const record = entry as unknown as Record<string, unknown>
    const checked = record.checked
    const score = record.score
    const notes = record.notes
    const hasValidScore = score === null || typeof score === 'number'
    return typeof checked === 'boolean' && hasValidScore && typeof notes === 'string'
  })
}

export default function AiReadiness() {
  const [data, setData] = useState<ReadinessChecklist | null>(null)
  const [state, setState] = useState<ReadinessState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const path = encodeURIComponent('AI Trustworthiness Checklist.json')
        const res = await fetch(`/api/v1/documents/download?path=${path}`)
        if (!res.ok) {
          throw new Error('Failed to load checklist')
        }
        const json = (await res.json()) as ReadinessChecklist
        if (!active) return
        setData(json)
        const stored = loadStoredState()
        if (stored) {
          setState(stored)
        } else {
          setState({
            version: 'v1',
            updated_at: new Date().toISOString(),
            checks: {},
          })
        }
      } catch {
        setData(null)
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const filteredDimensions = useMemo(() => {
    if (!data) return []
    const term = search.trim().toLowerCase()
    if (!term) return data.ai_trustworthiness_taxonomy.dimensions
    return data.ai_trustworthiness_taxonomy.dimensions.filter((dimension) =>
      dimension.checks.some((check) => check.toLowerCase().includes(term))
    )
  }, [data, search])

  const scoresSummary = useMemo(() => {
    if (!data || !state) return { overall: null, byDimension: new Map<string, number>() }
    const byDimension = new Map<string, number>()
    let total = 0
    let count = 0
    data.ai_trustworthiness_taxonomy.dimensions.forEach((dimension) => {
      let sum = 0
      let dimCount = 0
      dimension.checks.forEach((_, idx) => {
        const id = buildCheckId(dimension.name, idx)
        const score = state.checks[id]?.score ?? null
        if (score != null) {
          sum += score
          dimCount += 1
          total += score
          count += 1
        }
      })
      if (dimCount > 0) {
        byDimension.set(dimension.name, Number((sum / dimCount).toFixed(2)))
      }
    })
    return { overall: count ? Number((total / count).toFixed(2)) : null, byDimension }
  }, [data, state])

  const radarData = useMemo(() => {
    if (!data) return []
    const maxScore = SCORE_OPTIONS.length
    return data.ai_trustworthiness_taxonomy.dimensions.map((dimension) => {
      const avg = scoresSummary.byDimension.get(dimension.name) ?? 0
      return {
        label: dimension.name,
        value: avg,
        ratio: maxScore > 0 ? avg / maxScore : 0,
      }
    })
  }, [data, scoresSummary])

  function updateCheck(id: string, updater: (prev: CheckState) => CheckState) {
    setState((prev) => {
      if (!prev) return prev
      const current = prev.checks[id] ?? { checked: false, score: null, notes: '' }
      const next = updater(current)
      const updated: ReadinessState = {
        ...prev,
        updated_at: new Date().toISOString(),
        checks: { ...prev.checks, [id]: next },
      }
      saveStoredState(updated)
      return updated
    })
  }

  function handleExport() {
    if (!state) return
    const payload = { ...state, exported_at: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ai-readiness-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!isReadinessState(parsed)) {
        throw new Error('Invalid readiness export format')
      }
      const updated: ReadinessState = {
        ...parsed,
        version: parsed.version || 'v1',
        updated_at: new Date().toISOString(),
      }
      saveStoredState(updated)
      setState(updated)
      setImportError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed'
      setImportError(message)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!data || !state) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Readiness Check</CardTitle>
          <CardDescription>Checklist data could not be loaded.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const taxonomy = data.ai_trustworthiness_taxonomy

  const actionPlan = buildActionPlan(
    taxonomy.dimensions,
    state,
    buildCheckId
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/assessments">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to GRC
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{taxonomy.title}</CardTitle>
          <CardDescription>{taxonomy.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-2">
            <label htmlFor="readiness-search" className="text-sm font-medium">
              Search
            </label>
            <Input
              id="readiness-search"
              placeholder="Search checks"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Overall score</div>
            <div className="text-2xl font-semibold">
              {scoresSummary.overall ?? 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground">{taxonomy.scoring_guide.scale}</div>
          </div>
        </CardContent>
        <CardContent className="flex flex-wrap items-center gap-2 border-t">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportChange}
            className="hidden"
          />
          <Button variant="secondary" onClick={handleExport}>
            Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Import JSON
          </Button>
          {importError ? (
            <span className="text-xs text-destructive">{importError}</span>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {filteredDimensions.map((dimension) => (
            <Card key={dimension.name}>
              <CardHeader>
                <CardTitle className="text-lg">{dimension.name}</CardTitle>
                <CardDescription>
                  Score: {scoresSummary.byDimension.get(dimension.name) ?? 'N/A'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dimension.checks.map((check, idx) => {
                  const id = buildCheckId(dimension.name, idx)
                  const current = state.checks[id] ?? {
                    checked: false,
                    score: null,
                    notes: '',
                  }
                  return (
                    <ReadinessCheckRow
                      key={id}
                      id={id}
                      check={check}
                      value={current}
                      onUpdate={updateCheck}
                    />
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Readiness radar</CardTitle>
              <CardDescription>Average score by dimension (1–5)</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-6">
              <RadarChart data={radarData} size={520} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Implementation questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {taxonomy.implementation_questions.map((question) => (
                <div key={question}>- {question}</div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Action plan</CardTitle>
              <CardDescription>Auto-assigned based on checklist scores.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <ActionPlanSection
                title="Immediate actions"
                items={actionPlan.immediate}
                bulletClass="text-red-500"
              />
              <ActionPlanSection
                title="Short term actions"
                items={actionPlan.shortTerm}
                bulletClass="text-orange-500"
              />
              <ActionPlanSection
                title="Long term actions"
                items={actionPlan.longTerm}
                bulletClass="text-yellow-500"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {taxonomy.notes}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function RadarChart({
  data,
  size,
}: Readonly<{
  data: Array<{ label: string; value: number; ratio: number }>
  size: number
}>) {
  const center = size / 2
  const radius = size * 0.38
  const ringCount = 4
  if (!data.length) {
    return (
      <div className="text-sm text-muted-foreground">No scores yet</div>
    )
  }
  const angleStep = (Math.PI * 2) / data.length
  const points = data
    .map((item, idx) => {
      const angle = -Math.PI / 2 + idx * angleStep
      const r = radius * item.ratio
      const x = center + Math.cos(angle) * r
      const y = center + Math.sin(angle) * r
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {new Array(ringCount).fill(0).map((_, idx) => {
        const r = radius * ((idx + 1) / ringCount)
        return (
          <circle
            key={`ring-${r}`}
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="hsl(var(--border))"
            strokeOpacity={0.5}
          />
        )
      })}
      {data.map((item, idx) => {
        const angle = -Math.PI / 2 + idx * angleStep
        const x = center + Math.cos(angle) * radius
        const y = center + Math.sin(angle) * radius
        return (
          <line
            key={`axis-${item.label}`}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="hsl(var(--border))"
            strokeOpacity={0.6}
          />
        )
      })}
      <polygon
        points={points}
        fill="hsl(var(--primary))"
        fillOpacity={0.2}
        stroke="hsl(var(--primary))"
        strokeWidth={2}
      />
      {data.map((item, idx) => {
        const angle = -Math.PI / 2 + idx * angleStep
        const x = center + Math.cos(angle) * (radius + 14)
        const y = center + Math.sin(angle) * (radius + 14)
        let anchor: 'start' | 'end' | 'middle' = 'middle'
        if (Math.cos(angle) > 0.2) {
          anchor = 'start'
        } else if (Math.cos(angle) < -0.2) {
          anchor = 'end'
        }
        return (
          <text
            key={`label-${item.label}`}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={10}
            fill="hsl(var(--muted-foreground))"
          >
            {item.label}
          </text>
        )
      })}
    </svg>
  )
}

function buildActionPlan(
  dimensions: Array<{ name: string; checks: string[] }>,
  state: ReadinessState,
  idBuilder: (dimensionName: string, index: number) => string
): { immediate: ActionPlanItem[]; shortTerm: ActionPlanItem[]; longTerm: ActionPlanItem[] } {
  const immediate: ActionPlanItem[] = []
  const shortTerm: ActionPlanItem[] = []
  const longTerm: ActionPlanItem[] = []
  for (const dimension of dimensions) {
    dimension.checks.forEach((check, idx) => {
      const id = idBuilder(dimension.name, idx)
      const score = state.checks[id]?.score
      if (typeof score !== 'number') return
      const item: ActionPlanItem = { id, text: check, score }
      if (score <= 2) {
        immediate.push(item)
      } else if (score === 3) {
        shortTerm.push(item)
      } else {
        longTerm.push(item)
      }
    })
  }
  return { immediate, shortTerm, longTerm }
}

function ActionPlanSection({
  title,
  items,
  bulletClass,
}: Readonly<{
  title: string
  items: ActionPlanItem[]
  bulletClass: string
}>) {
  return (
    <div>
      <div className="font-medium text-foreground">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">No items yet</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            return (
              <div key={item.id} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 text-base ${bulletClass}`}>●</span>
                <span>
                  {item.text}
                  <span className="ml-2 text-xs text-muted-foreground">
                    (Score {item.score})
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReadinessCheckRow({
  id,
  check,
  value,
  onUpdate,
}: Readonly<{
  id: string
  check: string
  value: CheckState
  onUpdate: (id: string, updater: (prev: CheckState) => CheckState) => void
}>) {
  function handleCheckedChange(checked: boolean) {
    onUpdate(id, (prev) => ({ ...prev, checked }))
  }

  function handleScoreChange(score: number | null) {
    onUpdate(id, (prev) => ({ ...prev, score }))
  }

  function handleNotesChange(notes: string) {
    onUpdate(id, (prev) => ({ ...prev, notes }))
  }

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={value.checked}
            onChange={(e) => handleCheckedChange(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <div>
            <div className="text-sm font-medium">{check}</div>
            <div className="text-xs text-muted-foreground">{id}</div>
          </div>
        </div>
        <div className="min-w-[120px]">
          <Select
            value={value.score?.toString() ?? ''}
            onChange={(e) =>
              handleScoreChange(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">Score</option>
            {SCORE_OPTIONS.map((score) => (
              <option key={score} value={score}>
                {score}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Textarea
        rows={2}
        placeholder="Notes"
        value={value.notes}
        onChange={(e) => handleNotesChange(e.target.value)}
      />
    </div>
  )
}
