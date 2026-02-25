import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ChevronRight,
  BookOpen,
  FileUp,
  FileText,
  Sparkles,
  Play,
  Terminal,
  Copy,
  Check,
  Shield,
  Database,
  MessageSquare,
  Network,
} from 'lucide-react'
import { useState } from 'react'

const steps = [
  {
    num: 1,
    title: 'Add a framework',
    description: 'Add ISO 42001, load NIST 800-53, or create a custom framework.',
    action: 'Go to Assessments',
    href: '/assessments',
    icon: BookOpen,
  },
  {
    num: 2,
    title: 'Upload standard document',
    description: 'Upload the framework PDF (e.g. ISO 27001 standard) so Marlowe can extract requirements.',
    action: 'Upload Standard',
    href: '/assessments',
    icon: FileUp,
  },
  {
    num: 3,
    title: 'Upload evidence',
    description: 'Upload policies, procedures, or audit artifacts (scope, SOA, risk register) for gap analysis.',
    action: 'Upload Evidence',
    href: '/assessments',
    icon: FileText,
  },
  {
    num: 4,
    title: 'Add requirements',
    description: 'Extract requirements from the standard (AI) or add them manually. At least one is needed.',
    action: 'Extract or Add',
    href: '/assessments',
    icon: Sparkles,
  },
  {
    num: 5,
    title: 'Run gap analysis',
    description: 'Run the LangGraph agents (Framework Analyst → Evidence Reviewer → Gap Assessor) to produce a report.',
    action: 'Run Gap Analysis',
    href: '/assessments',
    icon: Play,
  },
]

const synthCommandIso = 'python scripts/synth_iso27001.py'
const synthCommandFedramp = 'python scripts/synth_fedramp_low.py'

export default function Tutorial() {
  const [copiedIso, setCopiedIso] = useState(false)
  const [copiedFedramp, setCopiedFedramp] = useState(false)

  const handleCopyIso = () => {
    navigator.clipboard.writeText(synthCommandIso)
    setCopiedIso(true)
    setTimeout(() => setCopiedIso(false), 2000)
  }

  const handleCopyFedramp = () => {
    navigator.clipboard.writeText(synthCommandFedramp)
    setCopiedFedramp(true)
    setTimeout(() => setCopiedFedramp(false), 2000)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Getting Started</h1>
        <p className="text-base text-muted-foreground mt-1">
          Like a tutorial at the start of a video game—here are all the moves you need to run your
          first gap analysis.
        </p>
      </div>

      {/* Main workflow */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gap Analysis in 5 Steps
          </CardTitle>
          <CardDescription>
            Follow this workflow on the Compliance & Gap Analysis page. Each step has a button or
            dialog.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step) => (
            <div
              key={step.num}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border bg-background p-4"
            >
              <div className="flex items-center gap-3 sm:w-64">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {step.num}
                </span>
                <step.icon className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="text-xs text-muted-foreground sm:hidden">{step.description}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground hidden sm:block flex-1">{step.description}</p>
              <Link to={step.href} className="shrink-0">
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  {step.action}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Try with synthetic data - ISO */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Try with Synthetic Data (ISO 27001)
          </CardTitle>
          <CardDescription>
            Generate fake ISO 27001 audit data (scope, risk register, SOA, asset inventory, audit
            log) and upload it as evidence. No real documents needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">Run this in your project root:</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 rounded-md border bg-muted px-4 py-3 text-sm font-mono">
              {synthCommandIso}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyIso}
              className="shrink-0"
              aria-label="Copy command"
            >
              {copiedIso ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Output: <code className="rounded bg-muted px-1">synthetic_iso27001/synthetic_evidence.md</code>. Upload
            that file as evidence on the Assessments page, then run gap analysis.
          </p>
          <Link to="/assessments">
            <Button>Go to Assessments</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Try with synthetic data - FedRAMP */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Try with Synthetic Data (FedRAMP Low)
          </CardTitle>
          <CardDescription>
            Generate fake FedRAMP Low audit data (system inventory, risk assessment, controls, ACL,
            audit log, backup plan) and upload it as evidence. No real documents needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">Run this in your project root:</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 rounded-md border bg-muted px-4 py-3 text-sm font-mono">
              {synthCommandFedramp}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyFedramp}
              className="shrink-0"
              aria-label="Copy command"
            >
              {copiedFedramp ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Output: <code className="rounded bg-muted px-1">fedramp_low_demo/synthetic_evidence.md</code>. Upload
            that file as evidence on the Assessments page, then run gap analysis.
          </p>
          <Link to="/assessments">
            <Button>Go to Assessments</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Other features */}
      <Card>
        <CardHeader>
          <CardTitle>More Moves</CardTitle>
          <CardDescription>Other features you can explore.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link to="/knowledge-base">
              <div className="rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                <Database className="h-5 w-5 text-primary mb-2" />
                <h3 className="font-medium">AI Knowledge Base</h3>
                <p className="text-sm text-muted-foreground">
                  Upload documents, search semantically. Chat uses this for RAG.
                </p>
              </div>
            </Link>
            <Link to="/">
              <div className="rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                <MessageSquare className="h-5 w-5 text-primary mb-2" />
                <h3 className="font-medium">Chat with Evidence</h3>
                <p className="text-sm text-muted-foreground">
                  Ask questions about your uploaded documents and frameworks.
                </p>
              </div>
            </Link>
            <Link to="/knowledge-graph">
              <div className="rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                <Network className="h-5 w-5 text-primary mb-2" />
                <h3 className="font-medium">Knowledge Graph</h3>
                <p className="text-sm text-muted-foreground">
                  Visualize frameworks and requirements in Neo4j.
                </p>
              </div>
            </Link>
            <Link to="/help">
              <div className="rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                <BookOpen className="h-5 w-5 text-primary mb-2" />
                <h3 className="font-medium">Help & Docs</h3>
                <p className="text-sm text-muted-foreground">
                  FAQ, license, and more.
                </p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
