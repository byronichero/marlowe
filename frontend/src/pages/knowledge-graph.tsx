import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { api } from '@/lib/api'
import type { Framework } from '@/types'
import { Network, Loader2, RefreshCw, GitCompare } from 'lucide-react'

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

export default function KnowledgeGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<{
    setData: (data: { nodes: unknown[]; edges: unknown[] }) => void
    setOptions?: (options: unknown) => void
    once?: (event: string, callback: () => void) => void
    destroy: () => void
  } | null>(null)
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [isLoadingGraph, setIsLoadingGraph] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [frameworkA, setFrameworkA] = useState<number | ''>('')
  const [frameworkB, setFrameworkB] = useState<number | ''>('')
  const [crosswalk, setCrosswalk] = useState<CrosswalkResponse | null>(null)
  const [isLoadingCrosswalk, setIsLoadingCrosswalk] = useState(false)
  const [crosswalkError, setCrosswalkError] = useState<string | null>(null)
  const [hasGraphData, setHasGraphData] = useState(false)

  async function loadGraph() {
    setIsLoadingGraph(true)
    try {
      const data = (await api.getGraph()) as unknown as GraphApiResponse
      setHasGraphData((data?.nodes?.length ?? 0) > 0)
      if (containerRef.current && data?.nodes?.length) {
        const visNodes = data.nodes.map((n) => ({
          id: n.id,
          label: n.label,
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
            once?: (event: string, callback: () => void) => void
            setOptions?: (options: unknown) => void
          }
          visInstance.once?.('stabilizationIterationsDone', () => {
            visInstance.setOptions?.({ physics: { enabled: false } })
          })
        }
      }
    } catch {
      setHasGraphData(false)
    } finally {
      setIsLoadingGraph(false)
    }
  }

  async function handleSync() {
    setIsSyncing(true)
    try {
      await api.syncGraph()
      await loadGraph()
    } catch {
      // Ignore
    } finally {
      setIsSyncing(false)
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
        const existing = (await api.getGraph()) as unknown as GraphApiResponse
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
        const visNodes = existing.nodes.map((n) => ({
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

  useEffect(() => {
    api.getFrameworks().then(setFrameworks).catch(() => [])
  }, [])

  useEffect(() => {
    loadGraph()
    return () => {
      networkRef.current?.destroy()
      networkRef.current = null
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Knowledge Graph</h1>
        <p className="text-base text-muted-foreground mt-1">
          Explore relationships between frameworks, requirements, and crosswalk mappings between
          standards
        </p>
      </div>

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
                value={frameworkA}
                onChange={(e) => setFrameworkA(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Select framework…</option>
                {frameworks.map((fw) => (
                  <option key={fw.id} value={fw.id}>
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
                value={frameworkB}
                onChange={(e) => setFrameworkB(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Select framework…</option>
                {frameworks.map((fw) => (
                  <option key={fw.id} value={fw.id}>
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

      {/* Graph visualization */}
      <Card className="h-[calc(100vh-28rem)] min-h-[400px]">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Graph Visualization</CardTitle>
              <CardDescription>
                Frameworks and requirements from Neo4j. Crosswalk mappings appear as dashed edges.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync from DB
            </Button>
          </div>
        </CardHeader>
        <CardContent className="h-[calc(100%-5rem)]">
          <div
            ref={containerRef}
            className="h-full w-full rounded-lg border-2 border-dashed min-h-[300px]"
          />
          {isLoadingGraph && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoadingGraph && !hasGraphData && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Network className="mx-auto h-16 w-16 mb-4 opacity-50" />
                <p>No graph data yet. Sync from DB to load frameworks and requirements.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
