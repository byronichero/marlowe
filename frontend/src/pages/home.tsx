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
  GraduationCap,
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

  const quickActionLink =
    'flex items-center gap-2.5 rounded-lg border p-2.5 text-sm transition-colors hover:bg-accent hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Main: Chat — prominent, stands out */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center gap-2">
          <img
            src="/marlowe.jpeg"
            alt="Marlowe"
            className="h-9 w-9 rounded-lg object-cover"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Marlowe Assistant</h1>
            <p className="text-xs text-muted-foreground">
              Ask about governance, frameworks, and your knowledge base
            </p>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-primary/20 bg-card shadow-lg ring-1 ring-primary/5">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-1">
            <CopilotChat
              className="flex min-h-0 flex-1 flex-col"
              labels={{
                title: 'Marlowe Assistant',
                initial:
                  'Ask about governance, frameworks, or your knowledge base. Questions use RAG over your uploaded documents.',
              }}
            />
          </div>
        </div>
      </div>

      {/* Right sidebar: stats, model, quick actions, about */}
      <aside className="flex w-full flex-shrink-0 flex-col gap-4 lg:w-72 lg:pt-[52px]">
        {/* Stats grid */}
        <div className="rounded-lg border border-border/60 bg-card/50 p-2">
          <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">API</CardTitle>
              <Activity className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {isLoadingOverview ? (
                <Skeleton className="h-6 w-10" />
              ) : (
                <span className="text-lg font-bold">{health}</span>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Frameworks</CardTitle>
              <BookOpen className="h-3.5 w-3.5 text-primary" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {isLoadingOverview ? (
                <Skeleton className="h-6 w-8" />
              ) : (
                <span className="text-lg font-bold">{frameworksCount}</span>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Requirements</CardTitle>
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {isLoadingOverview ? (
                <Skeleton className="h-6 w-8" />
              ) : (
                <span className="text-lg font-bold">{requirementsCount}</span>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Assessments</CardTitle>
              <ClipboardList className="h-3.5 w-3.5 text-accent-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {isLoadingOverview ? (
                <Skeleton className="h-6 w-8" />
              ) : (
                <span className="text-lg font-bold">{assessmentsCount}</span>
              )}
            </CardContent>
          </Card>
          </div>
        </div>

        {/* Model selector */}
        <Card>
          <CardContent className="p-3">
            <label htmlFor="chat-model" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Model
            </label>
            <select
              id="chat-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
            >
              {['qwen3:latest', ...models.filter((m) => m !== 'qwen3:latest')].map((m) => (
                <option key={m} value={m}>
                  {m === 'qwen3:latest' ? `${m} (default)` : m}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 p-3 pt-0">
            <Link to="/tutorial" className={quickActionLink}>
              <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
              <span>Getting Started</span>
            </Link>
            <Link to="/knowledge-base" className={quickActionLink}>
              <Database className="h-4 w-4 shrink-0 text-primary" />
              <span>AI Knowledge Base</span>
            </Link>
            <Link to="/assessments" className={quickActionLink}>
              <ClipboardCheck className="h-4 w-4 shrink-0 text-primary" />
              <span>Assessments</span>
            </Link>
            <Link to="/knowledge-base" className={quickActionLink}>
              <Upload className="h-4 w-4 shrink-0 text-primary" />
              <span>Upload Documents</span>
            </Link>
            <Link to="/" className={quickActionLink}>
              <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
              <span>Marlowe Assistant</span>
            </Link>
            <Link to="/knowledge-graph" className={quickActionLink}>
              <Network className="h-4 w-4 shrink-0 text-primary" />
              <span>Knowledge Graph</span>
            </Link>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">About Marlowe</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Supports AI governance, responsible AI, privacy, and global regulations. EU AI Act,
              GDPR, NIST AI RMF, assessments, and the knowledge graph.
            </p>
            <Link
              to="/about-marlowe"
              className="mt-2 inline-flex text-xs font-medium text-primary hover:underline"
            >
              Learn more
            </Link>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
