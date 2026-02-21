import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Book, MessageSquare, FileText, Network, Database, Theater } from 'lucide-react'

const helpSections = [
  {
    title: 'Getting Started',
    icon: Book,
    description: 'Learn how to set up and use Marlowe',
    items: [
      'Create your first assessment',
      'Upload documents to the knowledge base',
      'Explore the knowledge graph',
      'Chat with the AI assistant',
    ],
  },
  {
    title: 'Knowledge Base',
    icon: Database,
    description: 'Managing your documents and data',
    items: [
      'Supported file formats (PDF, DOCX, TXT)',
      'OCR and text extraction',
      'Semantic search with embeddings',
      'Document metadata and tagging',
    ],
  },
  {
    title: 'Knowledge Graph',
    icon: Network,
    description: 'Understanding relationships',
    items: [
      'Neo4j graph database',
      'Automatic sync from PostgreSQL',
      'Node types and relationships',
      'Interactive visualization',
    ],
  },
  {
    title: 'AI Chat',
    icon: MessageSquare,
    description: 'Using the AI assistant',
    items: [
      'RAG (Retrieval Augmented Generation)',
      'Model selection',
      'Context from uploaded documents',
      'Conversation history',
    ],
  },
]

export default function Help() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help & Documentation</h1>
        <p className="text-muted-foreground">
          Learn how to use Marlowe's features effectively
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {helpSections.map((section, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <section.icon className="h-5 w-5 text-primary" />
                {section.title}
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-1">•</span>
                    <span>{item}</span>
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
            Marlowe® is a registered trademark of GallowGlass AI
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
            See <code className="rounded bg-muted px-1">LICENSE-TODO.md</code> in the project repository for
            detailed license and trademark planning information.
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
