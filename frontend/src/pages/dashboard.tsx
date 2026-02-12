import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { api } from '@/lib/api'
import { Database, ClipboardCheck, Upload, MessageSquare, Network } from 'lucide-react'

export default function Dashboard() {
  const [health, setHealth] = useState<string>('—')
  const [frameworksCount, setFrameworksCount] = useState<number | string>('—')
  const [requirementsCount, setRequirementsCount] = useState<number | string>('—')
  const [assessmentsCount, setAssessmentsCount] = useState<number | string>('—')

  useEffect(() => {
    // Load health status
    api
      .getHealth()
      .then((data) => setHealth(data.status === 'ok' ? 'OK' : 'Unknown'))
      .catch(() => setHealth('Offline'))

    // Load counts
    api
      .getFrameworks()
      .then((data) => setFrameworksCount(data.length))
      .catch(() => setFrameworksCount('—'))

    api
      .getRequirements()
      .then((data) => setRequirementsCount(data.length))
      .catch(() => setRequirementsCount('—'))

    api
      .getAssessments()
      .then((data) => setAssessmentsCount(data.length))
      .catch(() => setAssessmentsCount('—'))
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
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-green-600"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Frameworks</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              📚
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{frameworksCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requirements</CardTitle>
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              ✓
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requirementsCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessments</CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              📋
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assessmentsCount}</div>
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
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <Database className="h-5 w-5 text-primary" />
              <span className="font-medium">AI Knowledge Base</span>
            </Link>
            <Link
              to="/assessments"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <span className="font-medium">View Assessments</span>
            </Link>
            <Link
              to="/knowledge-base"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <Upload className="h-5 w-5 text-primary" />
              <span className="font-medium">Upload to Knowledge Base</span>
            </Link>
            <Link
              to="/chat"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="font-medium">AI Chat</span>
            </Link>
            <Link
              to="/knowledge-graph"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
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
