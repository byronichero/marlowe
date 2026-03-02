import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import type { Assessment, Framework, RequirementAssessmentItem } from '@/types'
import { Loader2, ArrowLeft, Filter } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'complete', label: 'Complete' },
  { value: 'not_applicable', label: 'Not applicable' },
]

const MATURITY_OPTIONS = [
  { value: 0, label: '0 — Not started' },
  { value: 1, label: '1 — Ad hoc' },
  { value: 2, label: '2 — Defined' },
  { value: 3, label: '3 — Implemented' },
  { value: 4, label: '4 — Measured' },
  { value: 5, label: '5 — Optimized' },
]

export default function TaxonomyAssessment() {
  const params = useParams()
  const frameworkId = Number(params.frameworkId)
  const [framework, setFramework] = useState<Framework | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [rows, setRows] = useState<RequirementAssessmentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [familyFilter, setFamilyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [savingId, setSavingId] = useState<number | null>(null)

  useEffect(() => {
    if (!Number.isFinite(frameworkId)) return
    let active = true
    async function load() {
      try {
        const frameworks = await api.getFrameworks()
        const found = frameworks.find((fw) => fw.id === frameworkId) ?? null
        if (!active) return
        setFramework(found)
        if (!found) return
        const assessments = await api.getAssessments(frameworkId)
        let target = assessments[0]
        if (!target) {
          target = await api.createAssessment({
            title: `${found.name} Entry Table`,
            status: 'in_progress',
            framework_id: found.id,
          })
        }
        if (!active) return
        setAssessment(target)
        await api.initAssessmentRequirements(target.id)
        const items = await api.getAssessmentRequirements(target.id)
        if (!active) return
        setRows(items)
      } catch {
        setRows([])
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [frameworkId])

  const stageOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((r) => r.level).filter(Boolean))) as string[]
    return ['all', ...values]
  }, [rows])

  const familyOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((r) => r.family).filter(Boolean))) as string[]
    return ['all', ...values]
  }, [rows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (stageFilter !== 'all' && row.level !== stageFilter) return false
      if (familyFilter !== 'all' && row.family !== familyFilter) return false
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (!q) return true
      return (
        row.identifier.toLowerCase().includes(q) ||
        row.title.toLowerCase().includes(q) ||
        (row.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, search, stageFilter, familyFilter, statusFilter])

  const stageMaturity = useMemo(() => {
    const entries = new Map<string, { total: number; count: number }>()
    rows.forEach((row) => {
      if (!row.level || row.maturity_score == null) return
      const current = entries.get(row.level) ?? { total: 0, count: 0 }
      entries.set(row.level, {
        total: current.total + row.maturity_score,
        count: current.count + 1,
      })
    })
    return Array.from(entries.entries()).map(([stage, { total, count }]) => ({
      stage,
      avg: Number((total / count).toFixed(2)),
      count,
    }))
  }, [rows])

  const characteristicMaturity = useMemo(() => {
    const entries = new Map<string, { total: number; count: number }>()
    rows.forEach((row) => {
      if (!row.family || row.maturity_score == null) return
      const current = entries.get(row.family) ?? { total: 0, count: 0 }
      entries.set(row.family, {
        total: current.total + row.maturity_score,
        count: current.count + 1,
      })
    })
    return Array.from(entries.entries()).map(([family, { total, count }]) => ({
      family,
      avg: Number((total / count).toFixed(2)),
      count,
    }))
  }, [rows])

  function handleStatusChange(requirementId: number, value: string) {
    updateRow(requirementId, { status: value })
  }

  function handleNotesChange(requirementId: number, value: string) {
    setRows((prev) =>
      prev.map((item) =>
        item.requirement_id === requirementId ? { ...item, notes: value } : item
      )
    )
  }

  function handleNotesBlur(requirementId: number, value: string) {
    updateRow(requirementId, { notes: value || null })
  }

  function handleMaturityChange(requirementId: number, value: string) {
    const nextValue = value === '' ? null : Number(value)
    updateRow(requirementId, { maturity_score: nextValue })
  }

  async function updateRow(
    requirementId: number,
    payload: { status?: string; notes?: string | null; maturity_score?: number | null }
  ) {
    if (!assessment) return
    setSavingId(requirementId)
    try {
      const updated = await api.updateAssessmentRequirement(
        assessment.id,
        requirementId,
        payload
      )
      setRows((prev) =>
        prev.map((row) => (row.requirement_id === requirementId ? updated : row))
      )
    } finally {
      setSavingId(null)
    }
  }

  if (!Number.isFinite(frameworkId)) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Taxonomy Entry Table</CardTitle>
            <CardDescription>Invalid framework.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/standards-library">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Standards Library
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Taxonomy Entry Table</CardTitle>
          <CardDescription>
            {framework
              ? `${framework.name} • ${rows.length} properties`
              : 'Load the taxonomy framework to begin.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[2fr_repeat(3,1fr)]">
          <div className="space-y-2">
            <label htmlFor="taxonomy-search" className="text-sm font-medium">
              Search
            </label>
            <Input
              id="taxonomy-search"
              placeholder="Search by identifier, title, or description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="taxonomy-stage" className="text-sm font-medium">
              Stage
            </label>
            <Select
              id="taxonomy-stage"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              {stageOptions.map((stage) => (
                <option key={stage} value={stage}>
                  {stage === 'all' ? 'All stages' : stage}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="taxonomy-family" className="text-sm font-medium">
              Characteristic
            </label>
            <Select
              id="taxonomy-family"
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
            >
              {familyOptions.map((family) => (
                <option key={family} value={family}>
                  {family === 'all' ? 'All characteristics' : family}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="taxonomy-status" className="text-sm font-medium">
              Status
            </label>
            <Select
              id="taxonomy-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Maturity summary</CardTitle>
          <CardDescription>Average maturity (0–5) by stage and characteristic.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">By stage</h4>
            {stageMaturity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scores yet</p>
            ) : (
              <div className="space-y-1 text-sm">
                {stageMaturity.map((item) => (
                  <div key={item.stage} className="flex items-center justify-between">
                    <span>{item.stage}</span>
                    <span className="text-muted-foreground">
                      {item.avg} · {item.count} scored
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium">By characteristic</h4>
            {characteristicMaturity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scores yet</p>
            ) : (
              <div className="space-y-1 text-sm">
                {characteristicMaturity.map((item) => (
                  <div key={item.family} className="flex items-center justify-between">
                    <span>{item.family}</span>
                    <span className="text-muted-foreground">
                      {item.avg} · {item.count} scored
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Properties
            </CardTitle>
            <CardDescription>
              {filteredRows.length} shown of {rows.length}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          {!isLoading && filteredRows.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No properties match the current filters.
            </div>
          )}
          {!isLoading && filteredRows.length > 0 && (
            <div className="space-y-4">
              {filteredRows.map((row) => (
                <TaxonomyRow
                  key={row.requirement_id}
                  row={row}
                  savingId={savingId}
                  onStatusChange={handleStatusChange}
                  onMaturityChange={handleMaturityChange}
                  onNotesChange={handleNotesChange}
                  onNotesBlur={handleNotesBlur}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TaxonomyRow({
  row,
  savingId,
  onStatusChange,
  onMaturityChange,
  onNotesChange,
  onNotesBlur,
}: Readonly<{
  row: RequirementAssessmentItem
  savingId: number | null
  onStatusChange: (requirementId: number, value: string) => void
  onMaturityChange: (requirementId: number, value: string) => void
  onNotesChange: (requirementId: number, value: string) => void
  onNotesBlur: (requirementId: number, value: string) => void
}>) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap gap-3 items-start justify-between">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{row.identifier}</div>
          <h3 className="font-medium">{row.title}</h3>
          {row.description && (
            <p className="text-sm text-muted-foreground">{row.description}</p>
          )}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {row.level && <span>{row.level}</span>}
            {row.family && <span>• {row.family}</span>}
          </div>
        </div>
        <div className="min-w-[240px] space-y-2">
          <label
            htmlFor={`status-${row.requirement_id}`}
            className="text-xs font-medium text-muted-foreground"
          >
            Status
          </label>
          <Select
            id={`status-${row.requirement_id}`}
            value={row.status}
            onChange={(e) => onStatusChange(row.requirement_id, e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <label
            htmlFor={`maturity-${row.requirement_id}`}
            className="text-xs font-medium text-muted-foreground"
          >
            Maturity (0–5)
          </label>
          <Select
            id={`maturity-${row.requirement_id}`}
            value={row.maturity_score?.toString() ?? ''}
            onChange={(e) => onMaturityChange(row.requirement_id, e.target.value)}
          >
            <option value="">Not scored</option>
            {MATURITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          {savingId === row.requirement_id && (
            <div className="text-xs text-muted-foreground">Saving…</div>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <label
          htmlFor={`notes-${row.requirement_id}`}
          className="text-xs font-medium text-muted-foreground"
        >
          Notes
        </label>
        <Textarea
          id={`notes-${row.requirement_id}`}
          rows={3}
          value={row.notes ?? ''}
          onChange={(e) => onNotesChange(row.requirement_id, e.target.value)}
          onBlur={(e) => onNotesBlur(row.requirement_id, e.target.value)}
        />
      </div>
    </div>
  )
}
