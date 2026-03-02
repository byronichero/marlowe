import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BookOpen,
  ExternalLink,
  Quote,
  MessageSquare,
  Database,
  ClipboardCheck,
  FileText,
  Network,
  Server,
  Brain,
  Monitor,
  Laptop,
  Shield,
  Sparkles,
  ChevronRight,
} from 'lucide-react'

const plays = [
  {
    title: 'Doctor Faustus',
    subtitle: 'The Tragical History of Doctor Faustus',
    url: '/api/v1/documents/preview?path=dr-faustus/pg811-images.html',
    description:
      'The scholar who sells his soul to the devil—a tale of ambition, knowledge, and damnation.',
  },
  {
    title: 'The Jew of Malta',
    url: '/api/v1/documents/preview?path=jew-of-malta/pg901-images.html',
    description: 'Barabas and the fraught politics of Malta—revenge, intrigue, and moral complexity.',
  },
  {
    title: 'Tamburlaine the Great',
    url: 'https://www.gutenberg.org/ebooks/1094',
    description: 'The rise of the Scythian shepherd who became conqueror of empires.',
  },
  {
    title: 'Edward II',
    url: 'https://www.gutenberg.org/ebooks/38246',
    description: 'The troubled reign of Edward II—power, rebellion, and tragedy.',
  },
]

const quotes = [
  {
    text: "Was this the face that launch'd a thousand ships",
    source: 'Doctor Faustus',
  },
  {
    text: 'Infinite riches in a little room',
    source: 'The Jew of Malta',
  },
]

const platformCards = [
  {
    icon: MessageSquare,
    title: 'AI Chat & Knowledge Base',
    description:
      'RAG-powered chat over your documents, framework context, and knowledge graph with optional voice input.',
  },
  {
    icon: ClipboardCheck,
    title: 'GRC & Gap Analysis',
    description:
      'Frameworks (ISO, NIST), evidence upload, requirement extraction, and LangGraph multi-agent gap assessment.',
  },
  {
    icon: Shield,
    title: 'AI RMF Taxonomy',
    description:
      '150 outcome-based trustworthiness properties with CMMI-style maturity scoring and entry-table assessment.',
  },
  {
    icon: FileText,
    title: 'Reports & Standards Library',
    description: 'Gap analysis reports, AI Readiness checklist, and a curated standards library.',
  },
]

const coreFeatures = [
  {
    icon: MessageSquare,
    title: 'AI Chat System',
    items: [
      'RAG over uploaded documents and knowledge base',
      'Framework and requirement context',
      'Multiple LLM model selection (Ollama or vLLM)',
      'CopilotKit integration with voice support',
    ],
  },
  {
    icon: ClipboardCheck,
    title: 'GRC & Gap Analysis',
    items: [
      'ISO 42001, NIST 800-53, and custom frameworks',
      'AI requirement extraction from standards',
      'Evidence upload and management',
      'Multi-agent gap analysis (Framework Analyst, Evidence Reviewer, Gap Assessor)',
    ],
  },
  {
    icon: Shield,
    title: 'AI Trustworthiness Assessment',
    items: [
      'NIST AI RMF Trustworthiness Taxonomy (150 properties)',
      'CMMI-style maturity scoring (0–5)',
      'AI Readiness checklist with radar visualization',
      'Stage and characteristic rollups',
    ],
  },
  {
    icon: Database,
    title: 'Knowledge Base & Reports',
    items: [
      'Document ingestion into Qdrant vector store',
      'Knowledge graph (Neo4j) for frameworks and requirements',
      'Gap analysis report persistence',
      'Standards library and document preview',
    ],
  },
]

const techArch = [
  {
    icon: Server,
    title: 'Backend Services',
    items: [
      'FastAPI — Web framework',
      'PostgreSQL — Primary database',
      'Qdrant — Vector store for embeddings',
      'Neo4j — Knowledge graph',
      'Redis — Caching',
      'MinIO / S3 — Object storage',
    ],
  },
  {
    icon: Brain,
    title: 'AI & ML',
    items: [
      'Ollama (default) or vLLM — LLM inference',
      'RAG with semantic search',
      'Vector embeddings (nomic-embed-text)',
      'Docling — Document extraction (PDF, DOCX, etc.)',
    ],
  },
  {
    icon: Monitor,
    title: 'Frontend',
    items: [
      'React + Vite + TypeScript',
      'Tailwind CSS + Shadcn UI',
      'CopilotKit — AI chat and agents',
      'vis-network — Knowledge graph visualization',
    ],
  },
]

const futureFeatures = [
  {
    icon: Sparkles,
    title: 'CLI',
    description: 'Installable command-line tool for backup, health checks, and admin tasks',
  },
  {
    icon: Database,
    title: 'Backup & Recovery',
    description: 'Full backup and restore for databases and documents',
  },
  {
    icon: BookOpen,
    title: 'More Frameworks',
    description: 'Additional compliance and trustworthiness frameworks',
  },
  {
    icon: Network,
    title: 'API Integrations',
    description: 'Third-party GRC and ticketing system connections',
  },
]

export default function AboutMarlowe() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-8 md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">About Marlowe</h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              An AI-powered GRC (Governance, Risk, Compliance) platform for framework assessments, gap analysis, and AI
              trustworthiness. Built for practitioners who need evidence-driven compliance and readiness insights.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/">
                <Button size="lg" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Try AI Chat
                </Button>
              </Link>
              <Link to="/assessments">
                <Button variant="outline" size="lg" className="gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Go to GRC
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="hidden shrink-0 md:block">
            <img
              src="/marlowe.jpeg"
              alt="Marlowe"
              className="h-32 w-32 rounded-2xl object-cover shadow-lg ring-2 ring-primary/20"
            />
          </div>
        </div>
      </section>

      {/* Platform Overview */}
      <section>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Platform Overview</h2>
          <p className="mt-1 text-muted-foreground">
            Enterprise-grade GRC combining AI chat, gap analysis, taxonomy assessment, and knowledge management
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {platformCards.map((card) => (
            <Card key={card.title} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <card.icon className="h-10 w-10 text-primary" />
                <CardTitle className="text-base">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <hr className="border-primary/20" />

      {/* Core Features */}
      <section>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Core Features</h2>
          <p className="mt-1 text-muted-foreground">Functionality designed for GRC practitioners</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {coreFeatures.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <feature.icon className="h-5 w-5 text-primary" />
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {feature.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <hr className="border-primary/20" />

      {/* Technical Architecture */}
      <section>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Technical Architecture</h2>
          <p className="mt-1 text-muted-foreground">Modern stack for reliability and performance</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {techArch.map((arch) => (
            <Card key={arch.title}>
              <CardHeader>
                <arch.icon className="h-8 w-8 text-primary" />
                <CardTitle className="text-base">{arch.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {arch.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <hr className="border-primary/20" />

      {/* System Requirements */}
      <section>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight">System Requirements</h2>
          <p className="mt-1 text-muted-foreground">What you need to run Marlowe</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Laptop className="h-5 w-5 text-primary" />
                Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Modern web browser (Chrome, Firefox, Safari, Edge)</li>
                <li>Network access to the Marlowe backend</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-5 w-5 text-primary" />
                Server
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Docker and Docker Compose</li>
                <li>PostgreSQL, Redis, Qdrant, Neo4j, MinIO</li>
                <li>Ollama (default) or vLLM for LLM inference</li>
                <li>16 GB+ RAM recommended for AI workloads</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <hr className="border-primary/20" />

      {/* Future Enhancements */}
      <section>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Future Enhancements</h2>
          <p className="mt-1 text-muted-foreground">Planned for upcoming releases</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {futureFeatures.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <f.icon className="h-8 w-8 text-primary" />
                <CardTitle className="text-sm">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <hr className="border-primary/20" />

      {/* About the Namesake */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              About the Namesake
            </CardTitle>
            <CardDescription>Why this AI governance app bears his name</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              <strong className="text-foreground">Christopher Marlowe</strong> (1564–1593) was an Elizabethan playwright,
              poet, and contemporary of Shakespeare. His work combined sharp structure, craft, and a touch of
              intrigue—qualities we aspire to in building tools for responsible AI governance.
            </p>
            <p>
              Marlowe pioneered blank verse drama and influenced generations of writers. From <em>Doctor Faustus</em> to{' '}
              <em>The Jew of Malta</em>, his plays explore ambition, power, and the human condition—themes that resonate
              as we navigate the risks and opportunities of artificial intelligence.
            </p>
            <p className="text-sm">
              <span className="font-medium text-foreground">Marlowe</span> — bridging 16th-century literary innovation
              with 21st-century AI governance. Marlowe is a trademark of GallowGlass AI.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Famous Lines</CardTitle>
            <CardDescription>A few of Marlowe&apos;s enduring phrases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {quotes.map((q) => (
                <blockquote
                  key={q.source}
                  className="flex gap-3 border-l-2 border-primary/50 pl-4 italic"
                >
                  <Quote className="mt-0.5 h-5 w-5 shrink-0 text-primary/70" />
                  <div>
                    <p className="text-foreground">&ldquo;{q.text}&rdquo;</p>
                    <cite className="text-sm not-italic text-muted-foreground">— {q.source}</cite>
                  </div>
                </blockquote>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Major Plays</CardTitle>
            <CardDescription>Read Marlowe&apos;s works (local copies and public domain sources)</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {plays.map((play) => (
                <li key={play.title} className="flex flex-col gap-1">
                  <a
                    href={play.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    {play.title}
                    <ExternalLink className="h-4 w-4 shrink-0" />
                  </a>
                  {play.subtitle && (
                    <span className="text-sm text-muted-foreground">{play.subtitle}</span>
                  )}
                  <p className="text-sm text-muted-foreground">{play.description}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t pt-6">
        <div className="flex flex-wrap items-center justify-center gap-4 text-center text-sm text-muted-foreground">
          <span>© 2025 Marlowe. AI-powered GRC platform.</span>
          <span>·</span>
          <Link to="/help" className="underline hover:text-foreground">
            Help & License
          </Link>
          <span>·</span>
          <a
            href="https://en.wikipedia.org/wiki/Christopher_Marlowe"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Wikipedia: Christopher Marlowe
          </a>
        </div>
      </footer>
    </div>
  )
}
