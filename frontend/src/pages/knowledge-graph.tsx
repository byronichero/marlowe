import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Network } from 'lucide-react'

export default function KnowledgeGraph() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Knowledge Graph</h1>
        <p className="text-muted-foreground">
          Explore relationships between frameworks, requirements, and assessments
        </p>
      </div>

      <Card className="h-[calc(100vh-16rem)]">
        <CardHeader>
          <CardTitle>Graph Visualization</CardTitle>
          <CardDescription>
            Interactive visualization powered by Neo4j and vis-network
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-5rem)]">
          <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed">
            <div className="text-center">
              <Network className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Graph visualization will appear here</p>
              <p className="text-sm text-muted-foreground mt-2">
                Integrating vis-network library for interactive graph rendering
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
