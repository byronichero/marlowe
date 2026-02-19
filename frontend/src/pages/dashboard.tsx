import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import {
  Database,
  ClipboardCheck,
  Upload,
  MessageSquare,
  Network,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Activity,
} from 'lucide-react'

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const [health, setHealth] = useState<string>('—')
  const [frameworksCount, setFrameworksCount] = useState<number | string>('—')
  const [requirementsCount, setRequirementsCount] = useState<number | string>('—')
  const [assessmentsCount, setAssessmentsCount] = useState<number | string>('—')

  useEffect(() => {
    setIsLoading(true)
    Promise.all([
      api.getHealth().then((d) => (d.status === 'ok' ? 'OK' : 'Unknown')).catch(() => 'Offline'),
      api.getFrameworks().then((d) => d.length).catch(() => '—' as const),
      api.getRequirements().then((d) => d.length).catch(() => '—' as const),
      api.getAssessments().then((d) => d.length).catch(() => '—' as const),
    ]).then(([h, f, r, a]) => {
      setHealth(h)
      setFrameworksCount(f)
      setRequirementsCount(r)
      setAssessmentsCount(a)
      setIsLoading(false)
    })
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of frameworks, requirements, and assessments
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Status</CardTitle>
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{health}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Frameworks</CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <BookOpen className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{frameworksCount}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requirements</CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{requirementsCount}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessments</CardTitle>
            <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-accent-foreground">
              <ClipboardList className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{assessmentsCount}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions and About */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              to="/knowledge-base"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Database className="h-5 w-5 text-primary" />
              <span className="font-medium">AI Knowledge Base</span>
            </Link>
            <Link
              to="/assessments"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <span className="font-medium">View Assessments</span>
            </Link>
            <Link
              to="/knowledge-base"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Upload className="h-5 w-5 text-primary" />
              <span className="font-medium">Upload to Knowledge Base</span>
            </Link>
            <Link
              to="/"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="font-medium">Marlowe Assistant</span>
            </Link>
            <Link
              to="/knowledge-graph"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Network className="h-5 w-5 text-primary" />
              <span className="font-medium">Knowledge Graph</span>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About Marlowe</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Marlowe supports <strong>AI governance</strong>, responsible AI, privacy,
              and global regulations. Use frameworks (e.g. EU AI Act, GDPR, NIST AI RMF),
              run assessments, attach evidence, and explore the knowledge graph.
              Framework-agnostic.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
