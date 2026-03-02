import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Book, MessageSquare, FileText, Network, Database, Theater } from 'lucide-react'

interface HelpItem {
  title: string
  description: string
  href?: string
}

const helpSections: Array<{
  title: string
  icon: typeof Book
  description: string
  items: HelpItem[]
}> = [
  {
    title: 'Getting Started',
    icon: Book,
    description: 'Learn how to set up and use Marlowe',
    items: [
      {
        title: 'Watch the Marlowe introduction',
        description: 'View a short video overview of Marlowe. You can turn off the splash on first visit via "Don\'t show again".',
        href: '/splash',
      },
      {
        title: 'Create your first assessment',
        description:
          'Go to GRC & Gap Analysis, add a framework (e.g. ISO 42001 or NIST 800-53), upload evidence, and run a gap analysis to identify compliance gaps.',
        href: '/assessments',
      },
      {
        title: 'Upload documents to the knowledge base',
        description:
          'Visit Knowledge Base to upload PDF, DOCX, or TXT files. Documents are indexed for semantic search and RAG. You can also try synthetic AI RMF data from the Tutorial.',
        href: '/knowledge-base',
      },
      {
        title: 'Explore the knowledge graph',
        description:
          'The Knowledge Graph page shows relationships between frameworks, requirements, and controls. Data syncs from PostgreSQL to Neo4j. Use filters and zoom to navigate.',
        href: '/knowledge-graph',
      },
      {
        title: 'Chat with the AI assistant',
        description:
          'Use the AI Chat to ask questions about your documents, frameworks, and compliance posture. Answers use RAG with context from your knowledge base.',
      },
    ],
  },
  {
    title: 'Knowledge Base',
    icon: Database,
    description: 'Managing your documents and data',
    items: [
      {
        title: 'Supported file formats (PDF, DOCX, TXT)',
        description:
          'Upload PDFs, Word documents, or plain text files. PDFs are parsed for text; scanned PDFs may use OCR for extraction.',
      },
      {
        title: 'OCR and text extraction',
        description:
          'Documents are processed to extract text. Scanned or image-based PDFs can use OCR when enabled to make content searchable.',
      },
      {
        title: 'Semantic search with embeddings',
        description:
          'Content is embedded into vectors (e.g. via Chroma or Qdrant). Semantic search finds relevant passages by meaning, not just keywords.',
      },
      {
        title: 'Document metadata and tagging',
        description:
          'Documents can have metadata and tags to organize and filter. Use these to group by project, framework, or compliance domain.',
      },
    ],
  },
  {
    title: 'Knowledge Graph',
    icon: Network,
    description: 'Understanding relationships',
    items: [
      {
        title: 'Neo4j graph database',
        description:
          'Marlowe uses Neo4j to store entities (frameworks, requirements, controls) and their relationships. Query with Cypher for advanced analysis.',
      },
      {
        title: 'Automatic sync from PostgreSQL',
        description:
          'Frameworks, requirements, and controls are synced from PostgreSQL into Neo4j. The graph reflects the current GRC data.',
      },
      {
        title: 'Node types and relationships',
        description:
          'Nodes represent frameworks, requirements, and controls. Edges show containment, mapping, and inheritance between them.',
      },
      {
        title: 'Interactive visualization',
        description:
          'Use the graph view to zoom, pan, and click nodes. Filters let you focus on specific frameworks or requirement types.',
      },
    ],
  },
  {
    title: 'AI Chat',
    icon: MessageSquare,
    description: 'Using the AI assistant',
    items: [
      {
        title: 'RAG (Retrieval Augmented Generation)',
        description:
          'Answers are grounded in your documents and knowledge base. The system retrieves relevant passages and passes them to the LLM for context-aware responses.',
      },
      {
        title: 'Model selection',
        description:
          'Choose an LLM (e.g. via Ollama or an API provider). Different models trade off speed, cost, and quality for your use case.',
      },
      {
        title: 'Context from uploaded documents',
        description:
          'The chat pulls context from documents you’ve uploaded. More documents improve relevance and reduce hallucinations.',
      },
      {
        title: 'Conversation history',
        description:
          'Sessions keep conversation history so you can refer back to earlier questions and answers within the same chat.',
      },
    ],
  },
]

export default function Help() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Help & Documentation</h1>
        <p className="text-base text-muted-foreground">
          Learn how to use Marlowe's features effectively
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {helpSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <section.icon className="h-5 w-5 text-primary" />
                {section.title}
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {section.items.map((item) => (
                  <li key={item.title} className="flex items-start gap-3">
                    <span className="text-primary mt-1 shrink-0">•</span>
                    <div className="min-w-0">
                      {item.href ? (
                        <Link
                          to={item.href}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">{item.title}</span>
                      )}
                      <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Link to="/about-marlowe" className="block">
        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Theater className="h-5 w-5 text-primary" />
              Christopher Marlowe
            </CardTitle>
            <CardDescription>
              Who was Marlowe? The Elizabethan playwright behind the name—and why his work inspired ours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Learn about Doctor Faustus, The Jew of Malta, and the connection between 16th-century drama and AI governance.
            </p>
          </CardContent>
        </Card>
      </Link>

      <Card id="trademark">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Trademark & License
          </CardTitle>
          <CardDescription>
            Marlowe is a trademark of GallowGlass AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            The name &quot;Marlowe&quot; and associated branding are trademarks of GallowGlass AI. The software may
            be used under its open source license (e.g. Apache 2.0), but the name &quot;Marlowe&quot; may not be
            used for forks, distributions, or services without permission. Forks and derivatives should use a
            different name.
          </p>
          <p>
            See <code className="rounded bg-muted px-1">LICENSE</code> and <code className="rounded bg-muted px-1">TRADEMARK</code> in the
            project repository for license and trademark information.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            API Documentation
          </CardTitle>
          <CardDescription>
            Backend API endpoints for integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The backend API is available at <code className="rounded bg-muted px-1">/api/v1/</code>
          </p>
          <div className="space-y-2 text-sm">
            <div>
              <code className="rounded bg-muted px-1">GET /api/v1/health</code> - Health check
            </div>
            <div>
              <code className="rounded bg-muted px-1">GET /api/v1/frameworks</code> - List frameworks
            </div>
            <div>
              <code className="rounded bg-muted px-1">GET /api/v1/requirements</code> - List requirements
            </div>
            <div>
              <code className="rounded bg-muted px-1">POST /api/v1/chat</code> - AI chat endpoint
            </div>
            <div>
              <code className="rounded bg-muted px-1">GET /api/v1/graph</code> - Knowledge graph data
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
