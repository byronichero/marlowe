import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import type { Assessment, Framework, GapAnalysisReport, Requirement } from '@/types'
import {
  FileSearch,
  FileUp,
  Loader2,
  Play,
  Plus,
  Shield,
  Calendar,
  ListChecks,
  CheckCircle2,
} from 'lucide-react'

const REGION_OPTIONS = [
  { value: '', label: 'Select region…' },
  { value: 'EU', label: 'EU' },
  { value: 'US', label: 'US' },
  { value: 'UK', label: 'UK' },
  { value: 'Global', label: 'Global' },
  { value: 'APAC', label: 'APAC' },
  { value: 'Other', label: 'Other' },
]

const FRAMEWORK_TYPE_OPTIONS = [
  { value: '', label: 'Select type…' },
  { value: 'Standard', label: 'Standard' },
  { value: 'Regulation', label: 'Regulation' },
  { value: 'Guideline', label: 'Guideline' },
  { value: 'Framework', label: 'Framework' },
  { value: 'Other', label: 'Other' },
]

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[^\w\s-]/g, '')
    .replaceAll(/[\s_-]+/g, '-')
    .replaceAll(/(?:^-+|-+$)/g, '')
}

export default function Assessments() {
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [isLoadingFrameworks, setIsLoadingFrameworks] = useState(true)
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(true)
  const [isLoadingAssessments, setIsLoadingAssessments] = useState(true)
  const [runningFrameworkId, setRunningFrameworkId] = useState<number | null>(null)
  const [report, setReport] = useState<GapAnalysisReport | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [addFrameworkOpen, setAddFrameworkOpen] = useState(false)
  const [addFrameworkLoading, setAddFrameworkLoading] = useState(false)
  const [addFrameworkError, setAddFrameworkError] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formRegion, setFormRegion] = useState('')
  const [formFrameworkType, setFormFrameworkType] = useState('')
  const [addRequirementOpen, setAddRequirementOpen] = useState(false)
  const [addRequirementLoading, setAddRequirementLoading] = useState(false)
  const [addRequirementError, setAddRequirementError] = useState<string | null>(null)
  const [reqFormFrameworkId, setReqFormFrameworkId] = useState<number | ''>('')
  const [reqFormIdentifier, setReqFormIdentifier] = useState('')
  const [reqFormTitle, setReqFormTitle] = useState('')
  const [reqFormDescription, setReqFormDescription] = useState('')
  const [uploadStandardOpen, setUploadStandardOpen] = useState(false)
  const [uploadFrameworkId, setUploadFrameworkId] = useState<number | ''>('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{
    job_id: string
    filename: string
    status: string
    chunks?: number
    error?: string
  } | null>(null)
  const [frameworkEvidence, setFrameworkEvidence] = useState<
    Record<number, { chunk_count: number; documents: string[]; has_evidence: boolean }>
  >({})

  const hasFramework = frameworks.length > 0
  const hasRequirement = requirements.length >= 1
  const hasEvidence = Object.values(frameworkEvidence).some((e) => e.has_evidence)
  const needsFirstStep = !hasFramework || !hasEvidence || !hasRequirement

  function refreshFrameworks() {
    api.getFrameworks().then(setFrameworks).catch(() => setFrameworks([]))
  }

  function refreshRequirements() {
    api.getRequirements().then(setRequirements).catch(() => setRequirements([]))
  }

  function getRequirementCountForFramework(frameworkId: number): number {
    return requirements.filter((r) => r.framework_id === frameworkId).length
  }

  function getEvidenceForFramework(frameworkId: number) {
    return frameworkEvidence[frameworkId]
  }

  async function refreshFrameworkEvidence() {
    if (frameworks.length === 0) return
    const map: Record<number, { chunk_count: number; documents: string[]; has_evidence: boolean }> =
      {}
    await Promise.all(
      frameworks.map(async (fw) => {
        try {
          const ev = await api.getFrameworkEvidence(fw.id)
          map[fw.id] = ev
        } catch {
          map[fw.id] = { chunk_count: 0, documents: [], has_evidence: false }
        }
      })
    )
    setFrameworkEvidence(map)
  }

  function openUploadStandard() {
    setUploadFrameworkId(frameworks[0]?.id ?? '')
    setUploadFile(null)
    setUploadProgress(null)
    setUploadStandardOpen(true)
  }

  async function handleUploadStandard(e: React.FormEvent) {
    e.preventDefault()
    const fwId = typeof uploadFrameworkId === 'number' ? uploadFrameworkId : null
    if (!fwId || !uploadFile) return
    try {
      const result = await api.uploadFrameworkDocument(fwId, uploadFile)
      setUploadProgress({
        job_id: result.job_id,
        filename: result.filename,
        status: 'pending',
      })
    } catch (err) {
      setUploadProgress({
        job_id: '',
        filename: uploadFile.name,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Upload failed',
      })
    }
  }

  useEffect(() => {
    if (uploadProgress && ['pending', 'running'].includes(uploadProgress.status)) {
      const poll = async () => {
        try {
          const job = await api.getUploadJobStatus(uploadProgress.job_id)
          setUploadProgress(job)
          if (job.status === 'completed') {
            refreshFrameworkEvidence()
            setUploadStandardOpen(false)
          }
        } catch {
          // Keep polling
        }
      }
      const id = setInterval(poll, 2000)
      return () => clearInterval(id)
    }
  }, [uploadProgress, uploadFrameworkId])

  function openAddFramework() {
    setFormName('')
    setFormSlug('')
    setFormDescription('')
    setFormRegion('')
    setFormFrameworkType('')
    setAddFrameworkError(null)
    setAddFrameworkOpen(true)
  }

  function handleGenerateSlug() {
    if (formName.trim()) setFormSlug(slugify(formName))
  }

  async function handleSubmitAddFramework(e: React.FormEvent) {
    e.preventDefault()
    setAddFrameworkError(null)
    const name = formName.trim()
    const slug = formSlug.trim()
    if (!name) {
      setAddFrameworkError('Name is required')
      return
    }
    if (!slug) {
      setAddFrameworkError('Slug is required')
      return
    }
    setAddFrameworkLoading(true)
    try {
      await api.createFramework({
        name,
        slug,
        description: formDescription.trim() || undefined,
        region: formRegion || undefined,
        framework_type: formFrameworkType || undefined,
      })
      setAddFrameworkOpen(false)
      refreshFrameworks()
    } catch (err) {
      setAddFrameworkError(err instanceof Error ? err.message : 'Failed to create framework')
    } finally {
      setAddFrameworkLoading(false)
    }
  }

  function openAddRequirement() {
    setReqFormFrameworkId(frameworks[0]?.id ?? '')
    setReqFormIdentifier('')
    setReqFormTitle('')
    setReqFormDescription('')
    setAddRequirementError(null)
    setAddRequirementOpen(true)
  }

  async function handleSubmitAddRequirement(e: React.FormEvent) {
    e.preventDefault()
    setAddRequirementError(null)
    const frameworkId = typeof reqFormFrameworkId === 'number' ? reqFormFrameworkId : null
    const identifier = reqFormIdentifier.trim()
    const title = reqFormTitle.trim()
    if (!frameworkId) {
      setAddRequirementError('Please select a framework')
      return
    }
    if (!identifier) {
      setAddRequirementError('Identifier is required')
      return
    }
    if (!title) {
      setAddRequirementError('Title is required')
      return
    }
    setAddRequirementLoading(true)
    try {
      await api.createRequirement({
        framework_id: frameworkId,
        identifier,
        title,
        description: reqFormDescription.trim() || undefined,
      })
      setAddRequirementOpen(false)
      refreshRequirements()
    } catch (err) {
      setAddRequirementError(
        err instanceof Error ? err.message : 'Failed to create requirement'
      )
    } finally {
      setAddRequirementLoading(false)
    }
  }

  useEffect(() => {
    api
      .getFrameworks()
      .then(setFrameworks)
      .catch(() => setFrameworks([]))
      .finally(() => setIsLoadingFrameworks(false))
  }, [])

  useEffect(() => {
    api
      .getRequirements()
      .then(setRequirements)
      .catch(() => setRequirements([]))
      .finally(() => setIsLoadingRequirements(false))
  }, [])

  useEffect(() => {
    if (frameworks.length > 0) {
      refreshFrameworkEvidence()
    } else {
      setFrameworkEvidence({})
    }
  }, [frameworks])

  useEffect(() => {
    api
      .getAssessments()
      .then(setAssessments)
      .catch(() => setAssessments([]))
      .finally(() => setIsLoadingAssessments(false))
  }, [])

  async function handleRunGapAnalysis(frameworkId: number) {
    setRunningFrameworkId(frameworkId)
    setReport(null)
    setReportOpen(true)
    try {
      const result = await api.runGapAnalysis(frameworkId)
      setReport(result)
      setAssessments((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: frameworks.find((f) => f.id === frameworkId)?.name ?? `Framework ${frameworkId}`,
          status: 'completed',
          framework_id: frameworkId,
          organization_id: null,
          started_at: null,
          completed_at: new Date().toISOString().slice(0, 10),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
    } catch {
      setReport({ ok: false, framework_id: frameworkId, report: 'Gap analysis failed.' })
    } finally {
      setRunningFrameworkId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-100 text-green-700',
      in_progress: 'bg-blue-100 text-blue-700',
      draft: 'bg-gray-100 text-gray-700',
    }
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs ${styles[status] ?? styles.draft}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compliance Frameworks & Gap Analysis</h1>
        <p className="text-muted-foreground mt-1">
          AI standards (e.g. ISO/IEC 42001:2023) and run agent-driven gap analysis like a
          cybersecurity audit
        </p>
      </div>

      {/* First step required – add framework and at least one requirement */}
      {!isLoadingFrameworks && !isLoadingRequirements && needsFirstStep && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              First step required
            </CardTitle>
            <CardDescription>
              Before running gap analysis: add a framework, upload the standard document, and add
              at least one requirement.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4">
            {!hasFramework && (
              <div className="flex-1 min-w-[200px] rounded-lg border p-4 bg-background">
                <h4 className="font-medium mb-1">1. Add a framework</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Add the standard or regulation you want to assess (e.g. ISO/IEC 42001:2023).
                </p>
                <Button onClick={openAddFramework}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Framework
                </Button>
              </div>
            )}
            {hasFramework && !hasEvidence && (
              <div className="flex-1 min-w-[200px] rounded-lg border p-4 bg-background">
                <h4 className="font-medium mb-1">2. Upload standard document</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload the PDF or document for this framework so gap analysis has evidence to
                  assess.
                </p>
                <Button onClick={openUploadStandard} disabled={frameworks.length === 0}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Upload Standard
                </Button>
              </div>
            )}
            {hasFramework && hasEvidence && !hasRequirement && (
              <div className="flex-1 min-w-[200px] rounded-lg border p-4 bg-background">
                <h4 className="font-medium mb-1">3. Add at least one requirement</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Add a clause or control to assess. At least one requirement is required before
                  running gap analysis.
                </p>
                <Button onClick={openAddRequirement} disabled={frameworks.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Requirement
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Frameworks – primary view */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                AI Frameworks & Standards
              </CardTitle>
              <CardDescription>
                Select a framework and run gap analysis using LangGraph agents (Framework Analyst,
                Evidence Reviewer, Gap Assessor)
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={openUploadStandard} variant="outline" size="sm">
                <FileUp className="mr-2 h-4 w-4" />
                Upload Standard
              </Button>
              <Button onClick={openAddRequirement} variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Requirement
              </Button>
              <Button onClick={openAddFramework} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Framework
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingFrameworks && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          {!isLoadingFrameworks && frameworks.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileSearch className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p>No frameworks yet</p>
              <p className="text-sm mt-2">
                Add a framework above (e.g. ISO/IEC 42001:2023, EU AI Act)
              </p>
            </div>
          )}
          {!isLoadingFrameworks && frameworks.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {frameworks.map((fw) => {
                const reqCount = getRequirementCountForFramework(fw.id)
                const hasFwEvidence = getEvidenceForFramework(fw.id)?.has_evidence ?? false
                const canRunGap = reqCount >= 1 && hasFwEvidence
                let gapDisabledTitle: string | undefined
                if (canRunGap) {
                  gapDisabledTitle = undefined
                } else if (hasFwEvidence) {
                  gapDisabledTitle = 'Add at least one requirement before running gap analysis'
                } else {
                  gapDisabledTitle = 'Upload standard document and add at least one requirement'
                }
                return (
                  <div
                    key={fw.id}
                    className="rounded-lg border p-4 flex flex-col hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold">{fw.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {fw.description ?? fw.framework_type ?? 'No description'}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {fw.region && (
                          <span className="text-xs text-muted-foreground">{fw.region}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {reqCount} requirement{reqCount === 1 ? '' : 's'}
                        </span>
                        {getEvidenceForFramework(fw.id)?.has_evidence ? (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Standard uploaded
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600">No standard document</span>
                        )}
                      </div>
                    </div>
                    <Button
                      className="mt-4"
                      size="sm"
                      onClick={() => handleRunGapAnalysis(fw.id)}
                      disabled={runningFrameworkId !== null || !canRunGap}
                      title={gapDisabledTitle}
                    >
                      {runningFrameworkId === fw.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      Run Gap Analysis
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent assessments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Gap Analyses</CardTitle>
          <CardDescription>
            Past assessments linked to frameworks. View and manage results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAssessments && (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          )}
          {!isLoadingAssessments && assessments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No assessments yet</p>
              <p className="text-sm mt-2">Run gap analysis on a framework above to get started</p>
            </div>
          )}
          {!isLoadingAssessments && assessments.length > 0 && (
            <div className="space-y-4">
              {assessments.map((assessment) => (
                <div
                  key={assessment.id}
                  className="rounded-lg border p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold">{assessment.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(assessment.created_at).toLocaleDateString()}
                        </span>
                        {getStatusBadge(assessment.status)}
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Framework dialog */}
      <Dialog open={addFrameworkOpen} onOpenChange={setAddFrameworkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Framework</DialogTitle>
            <DialogDescription>
              Create a new compliance framework. Name and slug are required.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAddFramework} className="space-y-4 mt-2">
            {addFrameworkError && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
                {addFrameworkError}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="framework-name" className="text-sm font-medium">
                Name *
              </label>
              <Input
                id="framework-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. ISO/IEC 42001:2023"
                maxLength={255}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="framework-slug" className="text-sm font-medium">
                Slug *
              </label>
              <div className="flex gap-2">
                <Input
                  id="framework-slug"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="e.g. iso-42001-2023"
                  maxLength={100}
                  required
                />
                <Button type="button" variant="outline" size="sm" onClick={handleGenerateSlug}>
                  Generate
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="framework-description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="framework-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of the framework"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="framework-region" className="text-sm font-medium">
                Region
              </label>
              <Select
                id="framework-region"
                value={formRegion}
                onChange={(e) => setFormRegion(e.target.value)}
              >
                {REGION_OPTIONS.map((opt) => (
                  <option key={opt.value || 'empty'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="framework-type" className="text-sm font-medium">
                Framework Type
              </label>
              <Select
                id="framework-type"
                value={formFrameworkType}
                onChange={(e) => setFormFrameworkType(e.target.value)}
              >
                {FRAMEWORK_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'empty'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddFrameworkOpen(false)}
                disabled={addFrameworkLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addFrameworkLoading}>
                {addFrameworkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Framework
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Requirement dialog */}
      <Dialog open={addRequirementOpen} onOpenChange={setAddRequirementOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Requirement</DialogTitle>
            <DialogDescription>
              Add a clause or control to a framework. At least one requirement is needed before
              running gap analysis.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAddRequirement} className="space-y-4 mt-2">
            {addRequirementError && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
                {addRequirementError}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="requirement-framework" className="text-sm font-medium">
                Framework *
              </label>
              <Select
                id="requirement-framework"
                value={reqFormFrameworkId}
                onChange={(e) =>
                  setReqFormFrameworkId(e.target.value ? Number(e.target.value) : '')
                }
                required
              >
                <option value="">Select framework…</option>
                {frameworks.map((fw) => (
                  <option key={fw.id} value={fw.id}>
                    {fw.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="requirement-identifier" className="text-sm font-medium">
                Identifier *
              </label>
              <Input
                id="requirement-identifier"
                value={reqFormIdentifier}
                onChange={(e) => setReqFormIdentifier(e.target.value)}
                placeholder="e.g. 4.2.1, A.5.1"
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="requirement-title" className="text-sm font-medium">
                Title *
              </label>
              <Input
                id="requirement-title"
                value={reqFormTitle}
                onChange={(e) => setReqFormTitle(e.target.value)}
                placeholder="Short title for the requirement"
                maxLength={500}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="requirement-description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="requirement-description"
                value={reqFormDescription}
                onChange={(e) => setReqFormDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddRequirementOpen(false)}
                disabled={addRequirementLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addRequirementLoading}>
                {addRequirementLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Requirement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload standard document dialog */}
      <Dialog open={uploadStandardOpen} onOpenChange={setUploadStandardOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Standard Document</DialogTitle>
            <DialogDescription>
              Upload the standard document (e.g. ISO PDF) for a framework. It becomes the evidence
              source for gap analysis.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUploadStandard} className="space-y-4 mt-2">
            {uploadProgress?.status === 'failed' && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
                {uploadProgress.error}
              </div>
            )}
            {uploadProgress?.status === 'completed' && (
              <div className="rounded-md bg-green-500/10 text-green-700 text-sm px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Uploaded {uploadProgress.filename} — {uploadProgress.chunks ?? 0} chunks indexed
              </div>
            )}
            {(!uploadProgress || ['failed', 'completed'].includes(uploadProgress.status)) && (
              <>
                <div className="space-y-2">
                  <label htmlFor="upload-framework" className="text-sm font-medium">
                    Framework *
                  </label>
                  <Select
                    id="upload-framework"
                    value={uploadFrameworkId}
                    onChange={(e) =>
                      setUploadFrameworkId(e.target.value ? Number(e.target.value) : '')
                    }
                    required
                  >
                    <option value="">Select framework…</option>
                    {frameworks.map((fw) => (
                      <option key={fw.id} value={fw.id}>
                        {fw.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="upload-file" className="text-sm font-medium">
                    Document *
                  </label>
                  <Input
                    id="upload-file"
                    type="file"
                    accept=".pdf,.docx,.pptx,.xlsx,.html,.htm,.md,.txt"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    PDF, DOCX, PPTX, XLSX, HTML, Markdown, or TXT
                  </p>
                </div>
              </>
            )}
            {uploadProgress?.status === 'pending' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing {uploadProgress.filename}…
              </div>
            )}
            {uploadProgress?.status === 'running' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Indexing {uploadProgress.filename}…
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setUploadStandardOpen(false)
                  setUploadProgress(null)
                }}
                disabled={['pending', 'running'].includes(uploadProgress?.status ?? '')}
              >
                {['pending', 'running'].includes(uploadProgress?.status ?? '') ? 'Processing…' : 'Close'}
              </Button>
              {(!uploadProgress || ['failed', 'completed'].includes(uploadProgress.status)) && (
                <Button type="submit" disabled={!uploadFile || !uploadFrameworkId}>
                  Upload
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Gap analysis report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gap Analysis Report</DialogTitle>
            <DialogDescription>
              {report?.ok ? 'LangGraph agents have completed the analysis.' : 'An error occurred during gap analysis.'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {runningFrameworkId != null && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Running LangGraph agents (Framework Analyst → Evidence Reviewer → Gap Assessor)…
              </div>
            )}
            {runningFrameworkId == null && report && (
              <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-md font-sans">
                {report.report || 'No report content.'}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
