import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, ExternalLink, Info } from 'lucide-react'

export default function AdminObservability() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Observability</h1>
        <p className="text-base text-muted-foreground">
          Local tracing and metrics for Marlowe. Use Grafana to explore traces and health.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Grafana Dashboard
          </CardTitle>
          <CardDescription>Self-hosted on the Marlowe stack</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Open Grafana to view traces (Tempo) and metrics (Prometheus). The default login is{' '}
            <code className="mx-1 rounded bg-muted px-1">admin</code> /{' '}
            <code className="mx-1 rounded bg-muted px-1">admin</code>.
          </p>
          <a
            href="http://localhost:5017"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Open Grafana
            <ExternalLink className="h-4 w-4" />
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Local Stack Ports
          </CardTitle>
          <CardDescription>Default ports for the observability stack</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>
            Grafana:{' '}
            <code className="ml-2 rounded bg-muted px-1">http://localhost:5017</code>
          </div>
          <div>
            Tempo:{' '}
            <code className="ml-2 rounded bg-muted px-1">http://localhost:5018</code>
          </div>
          <div>
            Prometheus:{' '}
            <code className="ml-2 rounded bg-muted px-1">http://localhost:5019</code>
          </div>
          <div>
            OTLP gRPC:{' '}
            <code className="ml-2 rounded bg-muted px-1">http://localhost:4317</code>
          </div>
          <div>
            OTLP HTTP:{' '}
            <code className="ml-2 rounded bg-muted px-1">http://localhost:4318</code>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
