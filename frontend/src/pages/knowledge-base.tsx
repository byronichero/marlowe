import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Upload, FileText, Search, Loader2, Download, CheckCircle2, XCircle, Eye, FileDown } from 'lucide-react'

interface DocFile {
  name: string
  path: string
  size: number
}

interface UploadJob {
  job_id: string
  filename: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  chunks?: number
  error?: string
}

type UploadStatusState = { type: 'success'; message: string } | { type: 'error'; message: string } | { type: 'loading'; message: string } | null

const PREVIEW_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.htm', '.csv', '.txt', '.md', '.markdown']

export default function KnowledgeBase() {
  const [documents, setDocuments] = useState<DocFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploadStatus, setUploadStatus] = useState<UploadStatusState>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadJob | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerDoc, setViewerDoc] = useState<DocFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canPreview = (path: string) =>
    PREVIEW_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    if (uploadProgress && (uploadProgress.status === 'pending' || uploadProgress.status === 'running')) {
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/v1/documents/jobs/${uploadProgress.job_id}`)
          if (response.ok) {
            const job: UploadJob = await response.json()
            setUploadProgress(job)
            
            if (job.status === 'completed') {
              setUploadStatus({ type: 'success', message: `Successfully uploaded ${job.filename} - ${job.chunks || 0} chunks indexed` })
              clearInterval(pollInterval)
              loadDocuments()
              setTimeout(() => setUploadStatus(null), 5000)
            } else if (job.status === 'failed') {
              setUploadStatus({ type: 'error', message: `Upload failed: ${job.error || 'Unknown error'}` })
              clearInterval(pollInterval)
              setTimeout(() => setUploadStatus(null), 5000)
            }
          }
        } catch (error) {
          console.error('Error polling job status:', error)
          clearInterval(pollInterval)
        }
      }, 2000)

      return () => clearInterval(pollInterval)
    }
  }, [uploadProgress])

  const loadDocuments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/v1/documents/docs-files')
      if (response.ok) {
        const docs: DocFile[] = await response.json()
        setDocuments(docs)
      }
    } catch (error) {
      console.error('Error loading documents:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    setUploadStatus({ type: 'loading', message: `Uploading ${file.name}...` })

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        setUploadProgress({
          job_id: result.job_id,
          filename: result.filename,
          status: 'pending',
        })
      } else {
        setUploadStatus({ type: 'error', message: `Upload failed: ${response.statusText}` })
        setTimeout(() => setUploadStatus(null), 5000)
      }
    } catch (error) {
      setUploadStatus({ type: 'error', message: `Upload error: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setTimeout(() => setUploadStatus(null), 5000)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">AI Knowledge Base</h1>
        <p className="text-base text-muted-foreground">
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
                Click to select files to upload
              </p>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.docx,.txt"
                className="hidden"
                id="file-upload"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadProgress !== null && uploadProgress.status !== 'completed' && uploadProgress.status !== 'failed'}
              >
                {uploadProgress && (uploadProgress.status === 'pending' || uploadProgress.status === 'running') ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Select Files'
                )}
              </Button>
            </div>
            {uploadStatus && (
              <div className={`flex items-center gap-2 text-sm ${
                uploadStatus.type === 'success' ? 'text-green-600 dark:text-green-400' : uploadStatus.type === 'error' ? 'text-destructive' : 'text-muted-foreground'
              }`}>
                {uploadStatus.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
                {uploadStatus.type === 'error' && <XCircle className="h-4 w-4" />}
                {uploadStatus.type === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
                {uploadStatus.message}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Supported formats: PDF, DOCX, TXT. Files are processed with OCR and embedded for semantic search.
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
              Semantic search coming soon. Use the Chat page to ask questions about your documents.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
          <CardDescription>Documents stored in the knowledge base</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-24 rounded-md" />
                </div>
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p>No documents uploaded yet</p>
              <p className="text-sm mt-2">
                Upload documents to populate the knowledge base and enable AI-powered search
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-sm text-muted-foreground">{formatSize(doc.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canPreview(doc.path) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setViewerDoc(doc)
                            setViewerOpen(true)
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <a
                          href={`/api/v1/documents/download-md?path=${encodeURIComponent(doc.path)}`}
                          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <FileDown className="h-4 w-4 mr-1" />
                          Download MD
                        </a>
                      </>
                    )}
                    <a
                      href={`/api/v1/documents/download?path=${encodeURIComponent(doc.path)}`}
                      download
                      className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document viewer modal */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between gap-4">
              <span>{viewerDoc?.name ?? 'Document preview'}</span>
              {viewerDoc && canPreview(viewerDoc.path) && (
                <a
                  href={`/api/v1/documents/download-md?path=${encodeURIComponent(viewerDoc.path)}`}
                  className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium"
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  Download MD
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          <iframe
            src={viewerDoc ? `/api/v1/documents/preview?path=${encodeURIComponent(viewerDoc.path)}` : ''}
            title="Document preview"
            className="flex-1 w-full min-h-0 rounded border"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
