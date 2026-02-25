import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { api } from '@/lib/api'
import type { Framework, GraphHealth, GraphStats } from '@/types'
import { Network, Loader2, RefreshCw, GitCompare, LocateFixed, Info, FileSearch } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GraphApiNode {
  id: string
  label: string
  type?: string
  properties?: Record<string, unknown>
}

interface GraphApiEdge {
  source: string
  target: string
  type?: string
}

interface GraphApiResponse {
  nodes: GraphApiNode[]
  edges: GraphApiEdge[]
}

function clusterFrameworks(
  instance: { clusterByConnection?: (nodeId: string, options?: unknown) => void },
  nodes: GraphApiNode[]
): void {
  if (!instance.clusterByConnection) return
  const frameworkLabels = new Map(
    nodes.filter((n) => (n.type ?? '').toLowerCase() === 'framework').map((n) => [n.id, n.label])
  )
  frameworkLabels.forEach((label, frameworkId) => {
    instance.clusterByConnection?.(frameworkId, {
      joinCondition: (nodeOptions: { group?: string; id?: string }) =>
        nodeOptions.group === 'requirement' && nodeOptions.id !== frameworkId,
      clusterNodeProperties: {
        id: `cluster_${frameworkId}`,
        label: `${label} requirements`,
        shape: 'dot',
        size: 30,
        color: { background: '#fde047', border: '#f59e0b' },
        font: { size: 14, color: '#7c2d12' },
      },
    })
  })
}

interface CrosswalkMapping {
  requirement_a: { id: number; identifier: string; title: string; description?: string }
  requirement_b: { id: number; identifier: string; title: string; description?: string }
  similarity: number
}

interface CrosswalkResponse {
  mappings: CrosswalkMapping[]
  framework_a: { id: number; name: string }
  framework_b: { id: number; name: string }
}

const LAST_GAP_ANALYSIS_KEY = 'lastGapAnalysisFrameworkId'

const FEDRAMP_BASELINE_INFO: Record<
  string,
  { level: number; label: string; count: number; color: { active: string; inactive: string } }
> = {
  low: {
    level: 1,
    label: 'Low',
    count: 149,
    color: { active: 'bg-green-600 text-white border-green-600 hover:bg-green-700', inactive: 'border-green-500 text-green-700 hover:bg-green-100 dark:text-green-400' },
  },
  moderate: {
    level: 2,
    label: 'Moderate',
    count: 287,
    color: { active: 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600', inactive: 'border-orange-500 text-orange-700 hover:bg-orange-100 dark:text-orange-400' },
  },
  high: {
    level: 3,
    label: 'High',
    count: 370,
    color: { active: 'bg-red-600 text-white border-red-600 hover:bg-red-700', inactive: 'border-red-500 text-red-700 hover:bg-red-100 dark:text-red-400' },
  },
}

export default function KnowledgeGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<{
    setData: (data: { nodes: unknown[]; edges: unknown[] }) => void
    setOptions?: (options: unknown) => void
    on?: (event: string, callback: (params: { nodes?: string[] }) => void) => void
    openCluster?: (clusterNodeId: string) => void
    once?: (event: string, callback: () => void) => void
    clusterByConnection?: (nodeId: string, options?: unknown) => void
    fit?: (options?: { animation?: { duration?: number } }) => void
    destroy: () => void
  } | null>(null)
  const expandClustersOnClickRef = useRef(true)
  const graphAbortRef = useRef<AbortController | null>(null)
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [isLoadingGraph, setIsLoadingGraph] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [frameworkA, setFrameworkA] = useState<number | ''>('')
  const [frameworkB, setFrameworkB] = useState<number | ''>('')
  const [crosswalk, setCrosswalk] = useState<CrosswalkResponse | null>(null)
  const [isLoadingCrosswalk, setIsLoadingCrosswalk] = useState(false)
  const [crosswalkError, setCrosswalkError] = useState<string | null>(null)
  const [hasGraphData, setHasGraphData] = useState(false)
  const [showLabelsOnHover, setShowLabelsOnHover] = useState(false)
  const [expandClustersOnClick, setExpandClustersOnClick] = useState(true)
  const [graphStats, setGraphStats] = useState<GraphStats | null>(null)
  const [graphHealth, setGraphHealth] = useState<GraphHealth | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const lastGapFrameworkId = (() => {
    try {
      const id = localStorage.getItem(LAST_GAP_ANALYSIS_KEY)
      return id ? Number(id) : null
    } catch {
      return null
    }
  })()
  const lastGapFramework = lastGapFrameworkId != null
    ? frameworks.find((f) => f.id === lastGapFrameworkId)
    : null
  const [graphFrameworkId, setGraphFrameworkId] = useState<number | ''>('')
  const [fedrampBaseline, setFedrampBaseline] = useState<string>('')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null)
  const [graphError, setGraphError] = useState<string | null>(null)

  const nistFramework = frameworks.find(
    (f) =>
      f.slug?.includes('nist-800-53') || f.name?.toLowerCase().includes('nist 800-53')
  )

  async function loadGraph(
    selectedFrameworkId?: number | '',
    baseline?: string | '',
    signal?: AbortSignal
  ) {
    setIsLoadingGraph(true)
    try {
      const frameworkId = typeof selectedFrameworkId === 'number' ? selectedFrameworkId : undefined
      const bl = baseline ?? fedrampBaseline
      const data = (await api.getGraph(
        frameworkId,
        bl || undefined,
        signal
      )) as unknown as GraphApiResponse
      setHasGraphData((data?.nodes?.length ?? 0) > 0)
      setGraphError(null)
      if (containerRef.current && data?.nodes?.length) {
        const seen = new Set<string>()
        const visNodes = data.nodes
          .filter((n) => {
            if (seen.has(n.id)) return false
            seen.add(n.id)
            return true
          })
          .map((n) => ({
            id: n.id,
            label:
              showLabelsOnHover && (n.type ?? '').toLowerCase() !== 'framework' ? '' : n.label,
            group: n.type?.toLowerCase() ?? 'node',
            title: n.label,
          }))
        const visEdges = data.edges.map((e) => ({
          from: e.source,
          to: e.target,
          label: e.type ?? '',
        }))
        const visData = { nodes: visNodes, edges: visEdges }

        if (networkRef.current) {
          networkRef.current.setData(visData)
          clusterFrameworks(networkRef.current, data.nodes)
          // Re-fit view when data changes (e.g. FedRAMP filter)
          const inst = networkRef.current as { fit?: (opts?: { animation?: { duration?: number } }) => void }
          inst.fit?.({ animation: { duration: 300 } })
        } else {
          const visNetwork = await import('vis-network')
          // @ts-expect-error - CSS module
          await import('vis-network/styles/vis-network.min.css')
          const VisNetwork = visNetwork.Network as new (a: HTMLElement, b: unknown, c?: unknown) => { setData: (d: unknown) => void; destroy: () => void }
          const instance = new VisNetwork(containerRef.current, visData, {
            nodes: {
              shape: 'dot',
              font: { size: 12 },
            },
            edges: {
              arrows: { to: { enabled: true } },
              font: { size: 10, align: 'middle' },
            },
            physics: {
              enabled: true,
              forceAtlas2Based: {
                gravitationalConstant: -50,
                centralGravity: 0.01,
                springLength: 150,
                springConstant: 0.08,
              },
              stabilization: { iterations: 150 },
            },
            interaction: { hover: true, tooltipDelay: 200 },
          })
          networkRef.current = instance
          const visInstance = instance as unknown as {
            on?: (event: string, callback: (params: { nodes?: string[] }) => void) => void
            openCluster?: (clusterNodeId: string) => void
            once?: (event: string, callback: () => void) => void
            setOptions?: (options: unknown) => void
            clusterByConnection?: (nodeId: string, options?: unknown) => void
          }
          clusterFrameworks(visInstance, data.nodes)
          visInstance.on?.('selectNode', (params) => {
            if (!expandClustersOnClickRef.current) return
            const selected = params?.nodes?.[0]
            if (selected?.startsWith('cluster_')) {
              visInstance.openCluster?.(selected)
            }
          })
          visInstance.once?.('stabilizationIterationsDone', () => {
            visInstance.setOptions?.({ physics: { enabled: false } })
          })
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setHasGraphData(false)
      setGraphError(err instanceof Error ? err.message : 'Failed to load graph')
    } finally {
      setIsLoadingGraph(false)
    }
  }

  async function loadGraphMeta(
    selectedFrameworkId?: number | '',
    baseline?: string | '',
    signal?: AbortSignal
  ) {
    setIsLoadingStats(true)
    try {
      const frameworkId = typeof selectedFrameworkId === 'number' ? selectedFrameworkId : undefined
      const bl = baseline ?? fedrampBaseline
      const [stats, health] = await Promise.all([
        api.getGraphStats(frameworkId, bl || undefined, signal),
        api.getGraphHealth(),
      ])
      setGraphStats(stats)
      setGraphHealth(health)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setGraphStats(null)
      setGraphHealth(null)
    } finally {
      setIsLoadingStats(false)
    }
  }

  async function handleSync() {
    setSyncError(null)
    setSyncSuccess(null)
    setIsSyncing(true)
    try {
      const result = await api.syncGraph()
      await loadGraph(graphFrameworkId, fedrampBaseline)
      await loadGraphMeta(graphFrameworkId, fedrampBaseline)
      const f = result.frameworks ?? 0
      const r = result.requirements ?? 0
      const e = result.evidence ?? 0
      if (f === 0 && r === 0) {
        setSyncSuccess('Sync completed but 0 frameworks and 0 requirements in database. Add frameworks in Standards Library first.')
      } else {
        const parts = [`Synced ${f} framework(s), ${r} requirement(s)`]
        if (e > 0) parts.push(`${e} evidence`)
        setSyncSuccess(parts.join(', ') + '.')
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  function handleFedrampBaseline(level: 'low' | 'moderate' | 'high') {
    if (nistFramework) {
      setGraphFrameworkId(nistFramework.id)
      setFedrampBaseline(level)
    }
  }

  async function handleGenerateCrosswalk() {
    const a = typeof frameworkA === 'number' ? frameworkA : null
    const b = typeof frameworkB === 'number' ? frameworkB : null
    if (!a || !b || a === b) {
      setCrosswalkError('Select two different frameworks')
      return
    }
    setCrosswalkError(null)
    setIsLoadingCrosswalk(true)
    try {
      const result = await api.getCrosswalk(a, b) as CrosswalkResponse
      setCrosswalk(result)
      if (networkRef.current && result.mappings.length > 0) {
        const existing = (await api.getGraph(
          typeof graphFrameworkId === 'number' ? graphFrameworkId : undefined,
          fedrampBaseline || undefined
        )) as unknown as GraphApiResponse
        const crosswalkEdges = result.mappings.map((m, i) => ({
          from: `requirement_${m.requirement_a.id}`,
          to: `requirement_${m.requirement_b.id}`,
          label: `${(m.similarity * 100).toFixed(0)}%`,
          id: `crosswalk_${i}`,
          dashes: true,
          color: { color: '#6366f1' },
        }))
        const visEdges = [
          ...(existing.edges.map((e) => ({ from: e.source, to: e.target }))),
          ...crosswalkEdges,
        ]
        const crosswalkSeen = new Set<string>()
        const visNodes = existing.nodes
          .filter((n) => {
            if (crosswalkSeen.has(n.id)) return false
            crosswalkSeen.add(n.id)
            return true
          })
          .map((n) => ({
            id: n.id,
            label: n.label,
            group: n.type?.toLowerCase(),
            title: n.label,
          }))
        networkRef.current.setData({ nodes: visNodes, edges: visEdges })
      }
    } catch (err) {
      setCrosswalkError(err instanceof Error ? err.message : 'Failed to generate crosswalk')
    } finally {
      setIsLoadingCrosswalk(false)
    }
  }

  const hasSetDefaultFramework = useRef(false)

  useEffect(() => {
    api.getFrameworks().then(setFrameworks).catch(() => [])
  }, [])

  // Apply framework from URL (e.g. from Standards Library) or default to NIST when frameworks load
  useEffect(() => {
    if (frameworks.length === 0) return
    const fwIdParam = searchParams.get('framework_id')
    if (fwIdParam) {
      const id = Number(fwIdParam)
      if (frameworks.some((f) => f.id === id)) {
        hasSetDefaultFramework.current = true
        setGraphFrameworkId(id)
        return
      }
    }
    const nist = frameworks.find(
      (f) =>
        f.slug?.includes('nist-800-53') || f.name?.toLowerCase().includes('nist 800-53')
    )
    if (
      nist &&
      !hasSetDefaultFramework.current &&
      (graphFrameworkId === '' || graphFrameworkId === undefined)
    ) {
      hasSetDefaultFramework.current = true
      setGraphFrameworkId(nist.id)
    }
  }, [frameworks, searchParams])

  useEffect(() => {
    if (graphAbortRef.current) graphAbortRef.current.abort()
    graphAbortRef.current = new AbortController()
    const signal = graphAbortRef.current.signal

    loadGraph(graphFrameworkId, fedrampBaseline, signal)
    loadGraphMeta(graphFrameworkId, fedrampBaseline, signal)
  }, [graphFrameworkId, fedrampBaseline])

  useEffect(() => {
    return () => {
      graphAbortRef.current?.abort()
      networkRef.current?.destroy()
      networkRef.current = null
    }
  }, [])

  useEffect(() => {
    expandClustersOnClickRef.current = expandClustersOnClick
  }, [expandClustersOnClick])

  useEffect(() => {
    if (hasGraphData) loadGraph(graphFrameworkId, fedrampBaseline)
  }, [showLabelsOnHover])

  function handleResetView() {
    networkRef.current?.fit?.({ animation: { duration: 400 } })
  }

  function handleViewLastGapAnalysis() {
    if (!lastGapFramework) return
    setGraphFrameworkId(lastGapFramework.id)
    setSearchParams({ framework_id: String(lastGapFramework.id) })
    if (lastGapFramework.id !== nistFramework?.id) setFedrampBaseline('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Knowledge Graph</h1>
        <p className="text-base text-muted-foreground mt-1">
          Explore relationships between frameworks, requirements, evidence linked to requirements,
          and crosswalk mappings between standards
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total nodes</CardDescription>
            <CardTitle className="text-3xl">
              {isLoadingStats ? '—' : graphStats?.total_nodes ?? '0'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Frameworks: {graphStats?.framework_nodes ?? 0} • Requirements:{' '}
            {graphStats?.requirement_nodes ?? 0} • Evidence:{' '}
            {graphStats?.evidence_nodes ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total relationships</CardDescription>
            <CardTitle className="text-3xl">
              {isLoadingStats ? '—' : graphStats?.total_relationships ?? '0'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Avg per requirement:{' '}
            {graphStats?.avg_relationships_per_requirement?.toFixed(2) ?? '0.00'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Assessments</CardDescription>
            <CardTitle className="text-3xl">
              {isLoadingStats ? '—' : graphStats?.assessment_nodes ?? '0'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Reflects assessment links in Neo4j
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Neo4j status</CardDescription>
            <CardTitle className="text-3xl capitalize">
              {isLoadingStats ? '—' : graphHealth?.status ?? 'unknown'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Version: {graphHealth?.version ?? 'unknown'}
          </CardContent>
        </Card>
      </div>

      {/* Graph visualization - main content first */}
      <Card className="min-h-[500px] flex flex-col">
        <CardHeader className="shrink-0">
          <div className="flex flex-col gap-4">
            <div>
              <CardTitle>Graph Visualization</CardTitle>
              <CardDescription>
                Frameworks, requirements, and evidence from Neo4j. Evidence nodes show standards-to-evidence links.
                Crosswalk mappings appear as dashed edges.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {lastGapFramework && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewLastGapAnalysis}
                  title={`Show graph for last gap analysis (${lastGapFramework.name})`}
                  className="gap-2"
                >
                  <FileSearch className="h-4 w-4" />
                  View last gap analysis
                </Button>
              )}
              <div className="flex items-center gap-2">
                <label htmlFor="graph-framework" className="text-muted-foreground">
                  Framework
                </label>
                <Select
                  id="graph-framework"
                  value={graphFrameworkId === '' ? '' : String(graphFrameworkId)}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : ''
                    setGraphFrameworkId(v)
                    if (!v || v !== nistFramework?.id) setFedrampBaseline('')
                  }}
                >
                  <option value="">All frameworks</option>
                  {frameworks.map((fw) => (
                    <option key={fw.id} value={String(fw.id)}>
                      {fw.name}
                    </option>
                  ))}
                </Select>
              </div>
              {nistFramework && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">FedRAMP:</span>
                    {(['low', 'moderate', 'high'] as const).map((level) => {
                      const info = FEDRAMP_BASELINE_INFO[level]
                      const isActive = fedrampBaseline === level
                      return (
                        <Button
                          key={level}
                          variant="outline"
                          size="sm"
                          onClick={() => handleFedrampBaseline(level)}
                          className={cn(
                            'border',
                            isActive ? info.color.active : info.color.inactive
                          )}
                        >
                          Level {info.level}
                        </Button>
                      )
                    })}
                    {fedrampBaseline && (
                      <span className="text-muted-foreground text-xs">
                        ({FEDRAMP_BASELINE_INFO[fedrampBaseline]?.label} ·{' '}
                        {FEDRAMP_BASELINE_INFO[fedrampBaseline]?.count} controls)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <a
                      href="https://github.com/usnistgov/oscal-content/tree/main/nist.gov/SP800-53/rev5"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      <Info className="h-3 w-3" />
                      Source: NIST SP 800-53 Rev 5 (OSCAL)
                    </a>
                    {fedrampBaseline &&
                      graphStats &&
                      (() => {
                        const expected = FEDRAMP_BASELINE_INFO[fedrampBaseline]?.count ?? 0
                        const actual = graphStats.requirement_nodes ?? 0
                        const diff = actual - expected
                        if (diff < -2) {
                          return (
                            <span className="text-amber-600 dark:text-amber-500">
                              Graph: {actual} (expected {expected}) — sync may be needed
                            </span>
                          )
                        }
                        if (diff > 2) {
                          return (
                            <span className="text-amber-600 dark:text-amber-500">
                              Graph: {actual} — filter may not be applied
                            </span>
                          )
                        }
                        return null
                      })()}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={showLabelsOnHover}
                  onChange={(e) => setShowLabelsOnHover(e.target.checked)}
                />
                <span>Labels on hover</span>
              </label>
              <label className="flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={expandClustersOnClick}
                  onChange={(e) => setExpandClustersOnClick(e.target.checked)}
                />
                <span>Expand clusters on click</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
                  {isSyncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync from DB
                </Button>
                {syncError && (
                  <span className="text-sm text-destructive">{syncError}</span>
                )}
                {syncSuccess && (
                  <span className="text-sm text-muted-foreground">{syncSuccess}</span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleResetView} disabled={!hasGraphData}>
                <LocateFixed className="mr-2 h-4 w-4" />
                Reset view
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-[400px] relative">
          <div
            ref={containerRef}
            className="absolute inset-0 rounded-lg border-2 border-dashed min-h-[300px]"
          />
          {isLoadingGraph && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg z-10">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoadingGraph && !hasGraphData && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-muted-foreground max-w-md">
                <Network className="mx-auto h-16 w-16 mb-4 opacity-50" />
                <p>
                  {graphError ?? 'No graph data yet. Sync from DB to load frameworks, requirements, and evidence.'}
                </p>
                {graphError && (
                  <p className="mt-2 text-sm">
                    Ensure Neo4j is running and click Sync from DB to copy data from Postgres.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Crosswalk section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Crosswalk: Map requirements between two standards
          </CardTitle>
          <CardDescription>
            Select two frameworks to generate a semantic mapping of requirements. Uses embeddings to
            find the best match in Standard B for each requirement in Standard A.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label htmlFor="crosswalk-fw-a" className="text-sm font-medium block">
                Standard A
              </label>
              <Select
                id="crosswalk-fw-a"
                value={frameworkA === '' ? '' : String(frameworkA)}
                onChange={(e) => setFrameworkA(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Select framework…</option>
                {frameworks.map((fw) => (
                  <option key={fw.id} value={String(fw.id)}>
                    {fw.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="crosswalk-fw-b" className="text-sm font-medium block">
                Standard B
              </label>
              <Select
                id="crosswalk-fw-b"
                value={frameworkB === '' ? '' : String(frameworkB)}
                onChange={(e) => setFrameworkB(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Select framework…</option>
                {frameworks.map((fw) => (
                  <option key={fw.id} value={String(fw.id)}>
                    {fw.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              onClick={handleGenerateCrosswalk}
              disabled={isLoadingCrosswalk || !frameworkA || !frameworkB || frameworkA === frameworkB}
            >
              {isLoadingCrosswalk ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GitCompare className="mr-2 h-4 w-4" />
              )}
              Generate Crosswalk
            </Button>
          </div>
          {crosswalkError && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
              {crosswalkError}
            </div>
          )}
          {crosswalk && crosswalk.mappings.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 text-sm font-medium flex justify-between">
                <span>
                  {crosswalk.framework_a.name} → {crosswalk.framework_b.name}
                </span>
                <span>{crosswalk.mappings.length} mappings</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2">Standard A (Requirement)</th>
                      <th className="text-left px-4 py-2">Standard B (Mapped)</th>
                      <th className="text-left px-4 py-2 w-20">Similarity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crosswalk.mappings.map((m) => (
                      <tr
                        key={`${m.requirement_a.id}-${m.requirement_b.id}`}
                        className="border-b hover:bg-muted/20"
                      >
                        <td className="px-4 py-2">
                          <span className="font-medium">{m.requirement_a.identifier}</span>
                          {m.requirement_a.title && (
                            <span className="text-muted-foreground ml-2">
                              {m.requirement_a.title}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span className="font-medium">{m.requirement_b.identifier}</span>
                          {m.requirement_b.title && (
                            <span className="text-muted-foreground ml-2">
                              {m.requirement_b.title}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">{(m.similarity * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {crosswalk?.mappings.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No mappings generated. Ensure both frameworks have requirements defined.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
