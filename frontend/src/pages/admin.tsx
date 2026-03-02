import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import {
  Activity,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  Server,
  ExternalLink,
} from 'lucide-react'

const SERVICE_LABELS: Record<string, string> = {
  api: 'Backend API',
  postgres: 'PostgreSQL',
  redis: 'Redis',
  qdrant: 'Qdrant',
  neo4j: 'Neo4j',
  minio: 'MinIO / S3',
  llm: 'LLM Provider',
}

const CLI_COMMANDS = [
  { cmd: 'pip install marlowe', label: 'Install' },
  { cmd: 'marlowe --version', label: 'Version' },
  { cmd: 'marlowe health', label: 'Health check' },
]

export default function Admin() {
  const [services, setServices] = useState<Record<string, { status: string; message: string }> | null>(null)
  const [version, setVersion] = useState<{ app_version: string; cli_version: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [svc, ver] = await Promise.all([api.getAdminServices(), api.getAdminVersion()])
      setServices(svc.services)
      setVersion(ver)
    } catch {
      setServices(null)
      setVersion(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function handleCopy(cmd: string) {
    navigator.clipboard.writeText(cmd)
    setCopiedCmd(cmd)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  const statusColor = (status: string) => {
    if (status === 'healthy') return 'text-green-600 dark:text-green-500'
    if (status === 'degraded') return 'text-amber-600 dark:text-amber-500'
    return 'text-red-600 dark:text-red-500'
  }

  const statusIcon = (status: string) => {
    if (status === 'healthy') return '●'
    if (status === 'degraded') return '◆'
    return '○'
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Admin</h1>
        <p className="text-base text-muted-foreground">
          Service status and CLI for Marlowe
        </p>
      </div>

      {/* Service status table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Service Status
            </CardTitle>
            <CardDescription>Per-service health. No observability stack included.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="py-8 text-center text-muted-foreground">Loading…</div>
          )}
          {!loading && services && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left font-medium">Service</th>
                    <th className="pb-3 text-left font-medium">Status</th>
                    <th className="pb-3 text-left font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(services).map(([key, info]) => (
                    <tr key={key} className="border-b last:border-0">
                      <td className="py-3 font-medium">
                        {SERVICE_LABELS[key] ?? key}
                      </td>
                      <td className={`py-3 ${statusColor(info.status)}`}>
                        <span className="font-mono">{statusIcon(info.status)}</span>{' '}
                        {info.status}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {info.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && !services && (
            <div className="py-8 text-center text-muted-foreground">
              Failed to load service status. Ensure the backend is running.
            </div>
          )}
        </CardContent>
      </Card>

      {/* CLI card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            Marlowe CLI
          </CardTitle>
          <CardDescription>
            Installable command-line tool. Version{' '}
            <code className="rounded bg-muted px-1">
              {version?.cli_version ?? '—'}
            </code>{' '}
            (live from backend)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Run these commands in your terminal. Requires the package to be installed.
          </p>
          <div className="space-y-3">
            {CLI_COMMANDS.map((item) => (
              <div
                key={item.cmd}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-muted/30 p-3"
              >
                <code className="flex-1 font-mono text-sm break-all">{item.cmd}</code>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleCopy(item.cmd)}
                    aria-label="Copy"
                  >
                    {copiedCmd === item.cmd ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Install with <code className="rounded bg-muted px-1">pip install .</code> from the project root, or{' '}
            <code className="rounded bg-muted px-1">pip install marlowe</code> when published.
          </p>
        </CardContent>
      </Card>

      {/* Link to Observability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Observability
          </CardTitle>
          <CardDescription>Grafana, Tempo, Prometheus (enterprise/admin)</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/admin/observability">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Observability
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
