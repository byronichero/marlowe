import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpCircle } from 'lucide-react'

const faqs = [
  {
    question: 'What is Marlowe?',
    answer:
      'Marlowe is an AI governance platform that helps organizations manage compliance with AI regulations like the EU AI Act, GDPR, NIST AI RMF, and more.',
  },
  {
    question: 'How does the knowledge graph work?',
    answer:
      'The knowledge graph visualizes relationships between frameworks, requirements, and assessments using Neo4j. It syncs automatically with the PostgreSQL database.',
  },
  {
    question: 'What file formats can I upload?',
    answer:
      'You can upload PDF, DOCX, and TXT files to the AI Knowledge Base. Files are processed using OCR and embeddings for semantic search.',
  },
  {
    question: 'How does the AI chat work?',
    answer:
      'The chat uses Ollama models with RAG (Retrieval Augmented Generation) to answer questions using your uploaded documents as context.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'All data is stored locally in Docker containers. No data is sent to external services except for the self-hosted Ollama instance.',
  },
]

export default function Faq() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Frequently Asked Questions</h1>
        <p className="text-muted-foreground">Common questions about Marlowe</p>
      </div>

      <div className="space-y-4">
        {faqs.map((faq) => (
          <Card key={faq.question}>
            <CardHeader>
              <CardTitle className="flex items-start gap-3 text-lg">
                <HelpCircle className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                {faq.question}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{faq.answer}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
