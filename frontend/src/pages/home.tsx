import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CopilotChat } from '@copilotkit/react-ui'
import { useChatModel } from '@/contexts/chat-model'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Database,
  MessageSquare,
  Network,
  Upload,
} from 'lucide-react'

export default function Home() {
  const { model, setModel } = useChatModel()
  const [models, setModels] = useState<string[]>([])
  const [isLoadingOverview, setIsLoadingOverview] = useState(true)
  const [health, setHealth] = useState<string>('—')
  const [frameworksCount, setFrameworksCount] = useState<number | string>('—')
  const [requirementsCount, setRequirementsCount] = useState<number | string>('—')
  const [assessmentsCount, setAssessmentsCount] = useState<number | string>('—')

  useEffect(() => {
    api
      .getModels()
      .then((list) => setModels(list))
      .catch(() => setModels([]))
  }, [])

  useEffect(() => {
    setIsLoadingOverview(true)
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
      setIsLoadingOverview(false)
    })
  }, [])

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-6">
      <div className="flex items-center gap-3">
        <img
          src="/marlowe.jpeg"
          alt="Marlowe"
          className="h-12 w-12 rounded-lg object-cover"
        />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marlowe Assistant</h1>
          <p className="text-muted-foreground">
            Ask about governance, frameworks, and your knowledge base. Uses the Marlowe system prompt and RAG.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Status</CardTitle>
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingOverview ? (
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
            {isLoadingOverview ? (
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
            {isLoadingOverview ? (
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
            {isLoadingOverview ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{assessmentsCount}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
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
              <span className="font-medium">Assessments</span>
            </Link>
            <Link
              to="/knowledge-base"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Upload className="h-5 w-5 text-primary" />
              <span className="font-medium">Upload Documents</span>
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
              Marlowe supports <strong>AI governance</strong>, responsible AI, privacy, and global
              regulations. Use frameworks (e.g. EU AI Act, GDPR, NIST AI RMF), run assessments,
              attach evidence, and explore the knowledge graph. Framework-agnostic.
            </p>
            <Link
              to="/about-marlowe"
              className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
            >
              Learn about Christopher Marlowe
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label htmlFor="chat-model" className="text-sm font-medium text-muted-foreground">
          Model:
        </label>
        <select
          id="chat-model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {['qwen3:latest', ...models.filter((m) => m !== 'qwen3:latest')].map((m) => (
            <option key={m} value={m}>
              {m === 'qwen3:latest' ? `${m} (default)` : m}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-h-0">
        <CopilotChat
          labels={{
            title: 'Marlowe Assistant',
            initial: 'Ask about governance, frameworks, or your knowledge base. Questions use RAG over your uploaded documents.',
          }}
        />
      </div>
    </div>
  )
}
