import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, FileText, Search } from 'lucide-react'

export default function KnowledgeBase() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Knowledge Base</h1>
        <p className="text-muted-foreground">
          Upload documents and search through vectorized content
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Documents
            </CardTitle>
            <CardDescription>
              Upload PDFs, Word documents, or text files to the knowledge base
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop files here, or click to browse
              </p>
              <Button>Select Files</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Supported formats: PDF, DOCX, TXT. Max size: 50MB per file.
            </p>
          </CardContent>
        </Card>

        {/* Search Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Documents
            </CardTitle>
            <CardDescription>
              Find relevant content using semantic search
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Search for content..." className="flex-1" />
              <Button>Search</Button>
            </div>
            <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
              No results yet. Try searching after uploading documents.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Documents</CardTitle>
          <CardDescription>Documents stored in the knowledge base</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-3 opacity-50" />
            <p>No documents uploaded yet</p>
            <p className="text-sm mt-2">
              Upload documents to populate the knowledge base and enable AI-powered search
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
