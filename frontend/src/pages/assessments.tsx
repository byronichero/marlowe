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
import { useChatModel } from '@/contexts/chat-model'
import { api } from '@/lib/api'
import type { Assessment, Framework, GapAnalysisReport, Requirement } from '@/types'
import {
  AlertTriangle,
  FileDown,
  FileSearch,
  FileUp,
  FileText,
  Loader2,
  Play,
  Plus,
  Shield,
  Calendar,
  ListChecks,
  CheckCircle2,
  Sparkles,
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

// ISO and NIST first—drives extraction patterns and crosswalk (baseline: ISO 42001 + NIST 800-53)
const FRAMEWORK_TYPE_OPTIONS = [
  { value: '', label: 'Select type (required)…' },
  { value: 'ISO', label: 'ISO (e.g. ISO/IEC 42001:2023)' },
  { value: 'NIST', label: 'NIST (baseline required)' },
  { value: 'Other', label: 'Other' },
]

const FRAMEWORK_TEMPLATES = {
  ISO: {
    name: 'ISO/IEC 42001:2023',
    slug: 'iso-42001-2023',
    description: 'AI management system standard — clauses and Annex A controls',
    type: 'ISO' as const,
  },
  NIST: {
    name: 'NIST Baseline (800-53 Rev 5)',
    slug: 'nist-800-53-rev5',
    description: 'Security and privacy controls for information systems',
    type: 'NIST' as const,
  },
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[^\w\s-]/g, '')
    .replaceAll(/[\s_-]+/g, '-')
    .replaceAll(/(?:^-+|-+$)/g, '')
}

export default function Assessments() {
  const { model } = useChatModel()
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [isLoadingFrameworks, setIsLoadingFrameworks] = useState(true)
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(true)
  const [isLoadingAssessments, setIsLoadingAssessments] = useState(true)
  const [runningFrameworkId, setRunningFrameworkId] = useState<number | null>(null)
  const [report, setReport] = useState<GapAnalysisReport | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [assessmentReports, setAssessmentReports] = useState<Record<number, GapAnalysisReport>>({})
  const [gapAnalysisJob, setGapAnalysisJob] = useState<{
    job_id: string
    status: string
    percent: number
    step: string
    framework_id: number
  } | null>(null)
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
  const [uploadStartedAt, setUploadStartedAt] = useState<number | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{
    job_id: string
    filename: string
    status: string
    chunks?: number
    percent?: number
    error?: string
  } | null>(null)
  const [showUploadBanner, setShowUploadBanner] = useState(false)
  const [frameworkEvidence, setFrameworkEvidence] = useState<
    Record<number, { chunk_count: number; documents: string[]; has_evidence: boolean }>
  >({})
  // Evidence upload (separate dialog and state from "Upload Standard")
  const [uploadEvidenceOpen, setUploadEvidenceOpen] = useState(false)
  const [uploadEvidenceFrameworkId, setUploadEvidenceFrameworkId] = useState<number | ''>('')
  const [uploadEvidenceFile, setUploadEvidenceFile] = useState<File | null>(null)
  const [uploadEvidenceStartedAt, setUploadEvidenceStartedAt] = useState<number | null>(null)
  const [uploadEvidenceProgress, setUploadEvidenceProgress] = useState<{
    job_id: string
    filename: string
    status: string
    chunks?: number
    percent?: number
    error?: string
  } | null>(null)
  const [showEvidenceBanner, setShowEvidenceBanner] = useState(false)
  const [extractingFrameworkId, setExtractingFrameworkId] = useState<number | null>(null)
  const [extractResult, setExtractResult] = useState<{ frameworkId: number; message: string } | null>(null)
  const [extractScope, setExtractScope] = useState<Record<number, string>>({})
  const [loadingNistSeed, setLoadingNistSeed] = useState(false)
  const [nistSeedReplaceConfirm, setNistSeedReplaceConfirm] = useState(false)

  const hasFramework = frameworks.length > 0
  const hasRequirement = requirements.length >= 1
  const hasEvidence = Object.values(frameworkEvidence).some((e) => e.has_evidence)
  const needsFirstStep = !hasFramework || !hasEvidence || !hasRequirement

  const hasIso = frameworks.some((f) => f.slug?.includes('42001') || f.name?.includes('42001'))
  const hasNist = frameworks.some(
    (f) => f.slug?.includes('nist-800-53') || f.name?.toLowerCase().includes('nist 800-53')
  )

  function refreshFrameworks() {
    api.getFrameworks().then(setFrameworks).catch(() => setFrameworks([]))
  }

  function refreshRequirements() {
    api.getRequirements().then(setRequirements).catch(() => setRequirements([]))
  }

  async function handleLoadNist80053(replace = false) {
    setLoadingNistSeed(true)
    setNistSeedReplaceConfirm(false)
    try {
      const result = await api.seedNist80053(replace)
      if (result.ok) {
        refreshFrameworks()
        refreshRequirements()
        setExtractResult({
          frameworkId: result.framework_id,
          message: `NIST SP 800-53 loaded: ${result.controls_created} controls (free, no upload needed).`,
        })
        setTimeout(() => setExtractResult(null), 8000)
      } else if (result.error) {
        setExtractResult({ frameworkId: 0, message: result.error })
        if (result.error.includes('already exists')) {
          setNistSeedReplaceConfirm(true)
        }
        setTimeout(() => setExtractResult(null), 6000)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load NIST catalog'
      setExtractResult({ frameworkId: 0, message: msg })
      if (msg.includes('409') || msg.includes('already exists')) {
        setNistSeedReplaceConfirm(true)
      }
      setTimeout(() => setExtractResult(null), 6000)
    } finally {
      setLoadingNistSeed(false)
    }
  }

  function getRequirementCountForFramework(frameworkId: number): number {
    return requirements.filter((r) => r.framework_id === frameworkId).length
  }

  function formatElapsed(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remaining = seconds % 60
    return minutes > 0 ? `${minutes}m ${remaining}s` : `${remaining}s`
  }

  function getUploadPhase(status?: string): { label: string; percent: number } {
    if (status === 'uploading') return { label: 'Uploading file', percent: 10 }
    if (status === 'running') return { label: 'Indexing chunks', percent: 75 }
    if (status === 'completed') return { label: 'Completed', percent: 100 }
    if (status === 'failed') return { label: 'Failed', percent: 100 }
    return { label: 'Queued & extracting', percent: 35 }
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

  function openUploadStandard(frameworkId?: number) {
    setUploadFrameworkId(frameworkId ?? '')
    setUploadFile(null)
    setUploadProgress(null)
    setUploadStandardOpen(true)
  }

  function openUploadEvidence(frameworkId?: number) {
    setUploadEvidenceFrameworkId(frameworkId ?? '')
    setUploadEvidenceFile(null)
    setUploadEvidenceProgress(null)
    setUploadEvidenceOpen(true)
  }

  async function handleUploadStandard(e: React.FormEvent) {
    e.preventDefault()
    const fwId = typeof uploadFrameworkId === 'number' ? uploadFrameworkId : null
    if (!fwId || !uploadFile) return
    try {
      setUploadStartedAt(Date.now())
      setShowUploadBanner(true)
      setUploadProgress({
        job_id: '',
        filename: uploadFile.name,
        status: 'uploading',
        percent: 0,
      })
      setUploadStandardOpen(false)
      const result = await api.uploadFrameworkDocument(fwId, uploadFile, (percent) => {
        setUploadProgress((prev) =>
          prev
            ? {
                ...prev,
                status: 'uploading',
                percent,
              }
            : prev
        )
      })
      setUploadProgress({
        job_id: result.job_id,
        filename: result.filename,
        status: 'pending',
      })
    } catch (err) {
      setShowUploadBanner(true)
      setUploadProgress({
        job_id: '',
        filename: uploadFile.name,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Upload failed',
      })
    }
  }

  async function handleUploadEvidence(e: React.FormEvent) {
    e.preventDefault()
    const fwId = typeof uploadEvidenceFrameworkId === 'number' ? uploadEvidenceFrameworkId : null
    if (!fwId || !uploadEvidenceFile) return
    try {
      setUploadEvidenceStartedAt(Date.now())
      setShowEvidenceBanner(true)
      setUploadEvidenceProgress({
        job_id: '',
        filename: uploadEvidenceFile.name,
        status: 'uploading',
        percent: 0,
      })
      setUploadEvidenceOpen(false)
      const result = await api.uploadFrameworkDocument(fwId, uploadEvidenceFile, (percent) => {
        setUploadEvidenceProgress((prev) =>
          prev
            ? {
                ...prev,
                status: 'uploading',
                percent,
              }
            : prev
        )
      })
      setUploadEvidenceProgress({
        job_id: result.job_id,
        filename: result.filename,
        status: 'pending',
      })
    } catch (err) {
      setShowEvidenceBanner(true)
      setUploadEvidenceProgress({
        job_id: '',
        filename: uploadEvidenceFile.name,
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
            setUploadFrameworkId('')
            setUploadFile(null)
            setUploadStartedAt(null)
          }
        } catch {
          // Keep polling
        }
      }
      const id = setInterval(poll, 2000)
      return () => clearInterval(id)
    }
  }, [uploadProgress, uploadFrameworkId])

  useEffect(() => {
    if (uploadEvidenceProgress && ['pending', 'running'].includes(uploadEvidenceProgress.status)) {
      const poll = async () => {
        try {
          const job = await api.getUploadJobStatus(uploadEvidenceProgress.job_id)
          setUploadEvidenceProgress(job)
          if (job.status === 'completed') {
            refreshFrameworkEvidence()
            setUploadEvidenceFrameworkId('')
            setUploadEvidenceFile(null)
            setUploadEvidenceStartedAt(null)
          }
        } catch {
          // Keep polling
        }
      }
      const id = setInterval(poll, 2000)
      return () => clearInterval(id)
    }
  }, [uploadEvidenceProgress, uploadEvidenceFrameworkId])

  function openAddFramework(template?: 'ISO' | 'NIST') {
    if (template) {
      const t = FRAMEWORK_TEMPLATES[template]
      setFormName(t.name)
      setFormSlug(t.slug)
      setFormDescription(t.description)
      setFormRegion('Global')
      setFormFrameworkType(t.type)
    } else {
      setFormName('')
      setFormSlug('')
      setFormDescription('')
      setFormRegion('')
      setFormFrameworkType('')
    }
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
    const fwType = formFrameworkType.trim()
    if (!name) {
      setAddFrameworkError('Name is required')
      return
    }
    if (!slug) {
      setAddFrameworkError('Slug is required')
      return
    }
    if (!fwType) {
      setAddFrameworkError('Framework type (ISO or NIST) is required for extraction and crosswalk')
      return
    }
    setAddFrameworkLoading(true)
    try {
      await api.createFramework({
        name,
        slug,
        description: formDescription.trim() || undefined,
        region: formRegion || undefined,
        framework_type: fwType,
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

  function getExtractScopeForFramework(fw: Framework): string {
    if ((fw.framework_type || '').toUpperCase() !== 'ISO') return 'full'
    return extractScope[fw.id] ?? 'annex_a_only'
  }

  async function handleExtractRequirements(frameworkId: number) {
    setExtractingFrameworkId(frameworkId)
    setExtractResult(null)
    const fw = frameworks.find((f) => f.id === frameworkId)
    const scope = fw ? getExtractScopeForFramework(fw) : undefined
    try {
      const result = await api.extractRequirements(frameworkId, model, scope)
      refreshRequirements()
      if (result.ok) {
        if (result.created > 0) {
          setExtractResult({
            frameworkId,
            message: `Created ${result.created} requirement${result.created === 1 ? '' : 's'}${result.skipped > 0 ? `, ${result.skipped} already existed` : ''}`,
          })
        } else if (result.error) {
          setExtractResult({ frameworkId, message: result.error })
        } else {
          setExtractResult({
            frameworkId,
            message: result.skipped > 0 ? 'All requirements already exist' : 'No requirements extracted',
          })
        }
      } else {
        setExtractResult({ frameworkId, message: result.error ?? 'Extraction failed' })
      }
      setTimeout(() => setExtractResult(null), 6000)
    } catch (err) {
      setExtractResult({
        frameworkId,
        message: err instanceof Error ? err.message : 'Extraction failed',
      })
      setTimeout(() => setExtractResult(null), 6000)
    } finally {
      setExtractingFrameworkId(null)
    }
  }

  async function handleRunGapAnalysis(frameworkId: number) {
    setRunningFrameworkId(frameworkId)
    setReport(null)
    setGapAnalysisJob(null)
    setReportOpen(true)
    try {
      const { job_id, framework_id } = await api.startGapAnalysis(frameworkId)
      setGapAnalysisJob({
        job_id,
        status: 'pending',
        percent: 0,
        step: 'Starting...',
        framework_id,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gap analysis failed.'
      setReport({ ok: false, framework_id: frameworkId, report: message })
      setRunningFrameworkId(null)
    }
  }

  useEffect(() => {
    if (!gapAnalysisJob || !['pending', 'running'].includes(gapAnalysisJob.status)) return
    const poll = async () => {
      try {
        const status = await api.getGapAnalysisJobStatus(gapAnalysisJob.job_id)
        setGapAnalysisJob((prev) =>
          prev
            ? {
                ...prev,
                status: status.status,
                percent: status.percent,
                step: status.step,
              }
            : prev
        )
        if (status.status === 'completed') {
          const newAssessmentId = Date.now()
          const completedReport: GapAnalysisReport = {
            ok: true,
            framework_id: status.framework_id ?? gapAnalysisJob.framework_id,
            report: status.report ?? '',
          }
          setReport(completedReport)
          setGapAnalysisJob(null)
          setRunningFrameworkId(null)
          setReportOpen(true)
          setAssessmentReports((prev) => ({ ...prev, [newAssessmentId]: completedReport }))
          setAssessments((prev) => [
            ...prev,
            {
              id: newAssessmentId,
              title:
                frameworks.find((f) => f.id === gapAnalysisJob.framework_id)?.name ??
                `Framework ${gapAnalysisJob.framework_id}`,
              status: 'completed',
              framework_id: gapAnalysisJob.framework_id,
              organization_id: null,
              started_at: null,
              completed_at: new Date().toISOString().slice(0, 10),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
        } else if (status.status === 'failed') {
          setReport({
            ok: false,
            framework_id: gapAnalysisJob.framework_id,
            report: status.error ?? 'Gap analysis failed.',
          })
          setGapAnalysisJob(null)
          setRunningFrameworkId(null)
          setReportOpen(true)
        }
      } catch {
        // Keep polling
      }
    }
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [gapAnalysisJob, frameworks])

  function openReportForAssessment(assessment: Assessment) {
    const stored = assessmentReports[assessment.id]
    setReport(stored ?? null)
    setReportOpen(true)
  }

  function downloadReportAsMd(r: GapAnalysisReport) {
    const frameworkName =
      frameworks.find((f) => f.id === r.framework_id)?.name ?? `framework-${r.framework_id}`
    const slug = frameworkName
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-|-$/g, '')
    const date = new Date().toISOString().slice(0, 10)
    const filename = `gap-analysis-${slug}-${date}.md`
    const content = `# Gap Analysis Report\n\n**Framework:** ${frameworkName}\n**Date:** ${date}\n\n---\n\n${r.report || 'No report content.'}\n`
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
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
        <h1 className="text-4xl font-bold tracking-tight">Compliance Frameworks & Gap Analysis</h1>
        <p className="text-base text-muted-foreground mt-1">
          AI standards (e.g. ISO/IEC 42001:2023) and run agent-driven gap analysis like a
          cybersecurity audit
        </p>
      </div>

      {showUploadBanner && uploadProgress && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Uploading standard</CardTitle>
                <CardDescription>
                  {uploadProgress.filename} — {getUploadPhase(uploadProgress.status).label}
                </CardDescription>
              </div>
              {(uploadProgress.status === 'completed' || uploadProgress.status === 'failed') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUploadBanner(false)}
                >
                  Dismiss
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{uploadProgress.filename}</span>
              {uploadStartedAt && (
                <span>Elapsed {formatElapsed(Date.now() - uploadStartedAt)}</span>
              )}
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className={`h-2 rounded-full ${
                  uploadProgress.status === 'failed' ? 'bg-destructive' : 'bg-primary'
                }`}
                style={{
                  width: `${
                    uploadProgress.status === 'uploading'
                      ? uploadProgress.percent ?? 10
                      : getUploadPhase(uploadProgress.status).percent
                  }%`,
                }}
              />
            </div>
            {uploadProgress.chunks && uploadProgress.status !== 'failed' && (
              <div className="text-xs text-muted-foreground">
                {uploadProgress.chunks} chunks indexed
              </div>
            )}
            {uploadProgress.status === 'failed' && uploadProgress.error && (
              <div className="text-xs text-destructive">{uploadProgress.error}</div>
            )}
          </CardContent>
        </Card>
      )}

      {showEvidenceBanner && uploadEvidenceProgress && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Uploading evidence</CardTitle>
                <CardDescription>
                  {uploadEvidenceProgress.filename} — {getUploadPhase(uploadEvidenceProgress.status).label}
                </CardDescription>
              </div>
              {(uploadEvidenceProgress.status === 'completed' || uploadEvidenceProgress.status === 'failed') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEvidenceBanner(false)}
                >
                  Dismiss
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{uploadEvidenceProgress.filename}</span>
              {uploadEvidenceStartedAt && (
                <span>Elapsed {formatElapsed(Date.now() - uploadEvidenceStartedAt)}</span>
              )}
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className={`h-2 rounded-full ${
                  uploadEvidenceProgress.status === 'failed' ? 'bg-destructive' : 'bg-primary'
                }`}
                style={{
                  width: `${
                    uploadEvidenceProgress.status === 'uploading'
                      ? uploadEvidenceProgress.percent ?? 10
                      : getUploadPhase(uploadEvidenceProgress.status).percent
                  }%`,
                }}
              />
            </div>
            {uploadEvidenceProgress.chunks && uploadEvidenceProgress.status !== 'failed' && (
              <div className="text-xs text-muted-foreground">
                {uploadEvidenceProgress.chunks} chunks indexed
              </div>
            )}
            {uploadEvidenceProgress.status === 'failed' && uploadEvidenceProgress.error && (
              <div className="text-xs text-destructive">{uploadEvidenceProgress.error}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* First step required – add framework and at least one requirement */}
      {!isLoadingFrameworks && !isLoadingRequirements && needsFirstStep && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              First step required
            </CardTitle>
            <CardDescription>
              Before running gap analysis: add a framework, upload the standard document, then
              extract requirements (AI) or add them manually. At least one requirement is needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] rounded-lg border p-4 bg-background">
              <h4 className="font-medium mb-1">
                {!hasFramework ? '1. ' : ''}Add framework (ISO or NIST)
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                ISO 42001 and NIST are recommended baselines. NIST 800-53 is free—load the official
                catalog (1,189 controls) with one click. ISO requires your own document.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => openAddFramework('ISO')}
                  variant={hasIso ? 'outline' : 'default'}
                  size="sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {hasIso ? 'ISO 42001 (added)' : 'Add ISO 42001'}
                </Button>
                <Button
                  onClick={() => {
                    if (!hasNist) {
                      handleLoadNist80053(nistSeedReplaceConfirm)
                    }
                  }}
                  variant={hasNist ? 'outline' : 'default'}
                  size="sm"
                  disabled={loadingNistSeed || (hasNist && !nistSeedReplaceConfirm)}
                >
                  {loadingNistSeed ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading…
                    </>
                  ) : hasNist ? (
                    'NIST 800-53 (loaded)'
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Load NIST 800-53
                    </>
                  )}
                </Button>
                {nistSeedReplaceConfirm && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleLoadNist80053(true)}
                    disabled={loadingNistSeed}
                  >
                    Replace existing
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => openAddFramework()}>
                  Add other
                </Button>
              </div>
            </div>
            {hasFramework && !hasEvidence && (
              <>
                <div className="flex-1 min-w-[200px] rounded-lg border p-4 bg-background">
                  <h4 className="font-medium mb-1">2. Upload standard document</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload the PDF or document for this framework so requirements can be extracted.
                  </p>
                  <Button onClick={() => openUploadStandard()} disabled={frameworks.length === 0}>
                    <FileUp className="mr-2 h-4 w-4" />
                    Upload Standard
                  </Button>
                </div>
                <div className="flex-1 min-w-[200px] rounded-lg border p-4 bg-background">
                  <h4 className="font-medium mb-1">3. Add at least one requirement</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Extract from the standard (after upload) or add manually.
                  </p>
                  <Button onClick={openAddRequirement} disabled={frameworks.length === 0}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Requirement
                  </Button>
                </div>
                <div className="flex-1 min-w-[200px] rounded-lg border p-4 bg-background">
                  <h4 className="font-medium mb-1">4. Upload evidence & run gap analysis</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload evidence (policies, procedures) then run gap analysis.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => openUploadEvidence()}
                    disabled={frameworks.length === 0}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Upload Evidence
                  </Button>
                </div>
              </>
            )}
            {hasFramework && hasEvidence && !hasRequirement && (
              <div className="flex-1 min-w-[200px] rounded-lg border p-4 bg-background">
                <h4 className="font-medium mb-1">4. Add at least one requirement</h4>
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
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-2 flex-wrap justify-end">
                <Button onClick={() => openUploadStandard()} variant="outline" size="sm">
                  <FileUp className="mr-2 h-4 w-4" />
                  Upload Standard
                </Button>
                <Button onClick={openAddRequirement} variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Requirement
                </Button>
                <Button onClick={() => openUploadEvidence()} variant="outline" size="sm">
                  <FileText className="mr-2 h-4 w-4" />
                  Upload Evidence
                </Button>
                <Button onClick={() => openAddFramework()} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Framework
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Templates:</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-0"
                  onClick={() => openAddFramework('ISO')}
                >
                  ISO 42001
                </Button>
                <span>•</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-0"
                  onClick={() => openAddFramework('NIST')}
                  title="NIST baseline required: 800-53"
                >
                  NIST baseline
                </Button>
              </div>
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
                    <div className="mt-4 flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUploadStandard(fw.id)}
                        title={`Upload standard document for ${fw.name}`}
                      >
                        <FileUp className="mr-2 h-4 w-4" />
                        Upload
                      </Button>
                      {hasFwEvidence && (
                        <>
                          {(fw.framework_type || '').toUpperCase() === 'ISO' && (
                            <div className="rounded-md border border-muted/60 bg-muted/20 p-2">
                              <label
                                htmlFor={`extract-scope-${fw.id}`}
                                className="text-xs font-medium text-muted-foreground"
                                title="Annex A only: 38 controls (recommended for ISO 42001). Full: clauses 4–10 + Annex A."
                              >
                                Extract scope
                              </label>
                              <Select
                                id={`extract-scope-${fw.id}`}
                                value={getExtractScopeForFramework(fw)}
                                onChange={(e) =>
                                  setExtractScope((prev) => ({ ...prev, [fw.id]: e.target.value }))
                                }
                                className="mt-2 h-9 w-full text-sm"
                                aria-label="Extract scope for ISO framework"
                              >
                                <option value="annex_a_only">
                                  Annex A only (38 controls) — recommended
                                </option>
                                <option value="full">Full standard (clauses 4–10 + Annex A)</option>
                              </Select>
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExtractRequirements(fw.id)}
                            disabled={extractingFrameworkId !== null}
                            title="Extract requirements from uploaded standard document"
                          >
                            {extractingFrameworkId === fw.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 h-4 w-4" />
                            )}
                            Extract Requirements
                          </Button>
                        </>
                      )}
                      <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-2 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Evidence & Gap Analysis</p>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openUploadEvidence(fw.id)}
                            title={`Upload evidence document for ${fw.name}`}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Upload Evidence
                          </Button>
                          <Button
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
                      </div>
                    </div>
                    {extractResult?.frameworkId === fw.id && (
                      <p className="mt-2 text-xs text-muted-foreground">{extractResult.message}</p>
                    )}
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openReportForAssessment(assessment)}
                      title={
                        assessmentReports[assessment.id]
                          ? 'View gap analysis report'
                          : 'Report available only for analyses run in this session'
                      }
                    >
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
              Choose ISO or NIST first—this drives extraction patterns and crosswalk. Baselines are
              ISO 42001 and NIST (800-53 required alongside ISO).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => openAddFramework('ISO')}>
              <Plus className="mr-2 h-4 w-4" />
              Use ISO 42001 template
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => openAddFramework('NIST')}>
              <Plus className="mr-2 h-4 w-4" />
              Use NIST template
            </Button>
          </div>
          <form onSubmit={handleSubmitAddFramework} className="space-y-4 mt-2">
            {addFrameworkError && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
                {addFrameworkError}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="framework-type" className="text-sm font-medium">
                Framework type *
              </label>
              <Select
                id="framework-type"
                value={formFrameworkType}
                onChange={(e) => setFormFrameworkType(e.target.value)}
                required
              >
                {FRAMEWORK_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'empty'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
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

      {/* Upload evidence document dialog (separate from Upload Standard) */}
      <Dialog
        open={uploadEvidenceOpen}
        onOpenChange={(open) => {
          setUploadEvidenceOpen(open)
          if (!open) {
            if (!uploadEvidenceProgress || ['completed', 'failed'].includes(uploadEvidenceProgress.status)) {
              setUploadEvidenceProgress(null)
              setUploadEvidenceFrameworkId('')
              setUploadEvidenceFile(null)
              setUploadEvidenceStartedAt(null)
            }
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Evidence Document</DialogTitle>
            <DialogDescription>
              Upload evidence for the selected framework (e.g. policies, procedures, or the standard
              PDF). The document will be linked to that framework and used by gap analysis to assess
              compliance.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUploadEvidence} className="space-y-4 mt-2">
            {uploadEvidenceProgress?.status === 'failed' && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
                {uploadEvidenceProgress.error}
              </div>
            )}
            {uploadEvidenceProgress?.status === 'completed' && (
              <div className="rounded-md bg-green-500/10 text-green-700 text-sm px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Uploaded {uploadEvidenceProgress.filename} — {uploadEvidenceProgress.chunks ?? 0} chunks indexed
              </div>
            )}
            {(!uploadEvidenceProgress || ['failed', 'completed'].includes(uploadEvidenceProgress.status)) && (
              <>
                <div className="space-y-2">
                  <label htmlFor="upload-evidence-framework" className="text-sm font-medium">
                    Framework *
                  </label>
                  <Select
                    id="upload-evidence-framework"
                    value={uploadEvidenceFrameworkId}
                    onChange={(e) =>
                      setUploadEvidenceFrameworkId(e.target.value ? Number(e.target.value) : '')
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
                  <label htmlFor="upload-evidence-file" className="text-sm font-medium">
                    Evidence document *
                  </label>
                  <Input
                    id="upload-evidence-file"
                    type="file"
                    accept=".pdf,.docx,.pptx,.xlsx,.html,.htm,.md,.txt"
                    onChange={(e) => setUploadEvidenceFile(e.target.files?.[0] ?? null)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    PDF, DOCX, PPTX, XLSX, HTML, Markdown, or TXT
                  </p>
                </div>
              </>
            )}
            {uploadEvidenceProgress?.status === 'pending' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing {uploadEvidenceProgress.filename}…
              </div>
            )}
            {uploadEvidenceProgress?.status === 'uploading' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Uploading {uploadEvidenceProgress.filename}…
              </div>
            )}
            {uploadEvidenceProgress?.status === 'running' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Indexing {uploadEvidenceProgress.filename}…
              </div>
            )}
            {uploadEvidenceProgress &&
              ['uploading', 'pending', 'running', 'completed', 'failed'].includes(uploadEvidenceProgress.status) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{getUploadPhase(uploadEvidenceProgress.status).label}</span>
                  {uploadEvidenceStartedAt && (
                    <span>Elapsed {formatElapsed(Date.now() - uploadEvidenceStartedAt)}</span>
                  )}
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full ${
                      uploadEvidenceProgress.status === 'failed' ? 'bg-destructive' : 'bg-primary'
                    }`}
                    style={{
                      width: `${
                        uploadEvidenceProgress.status === 'uploading'
                          ? uploadEvidenceProgress.percent ?? 10
                          : getUploadPhase(uploadEvidenceProgress.status).percent
                      }%`,
                    }}
                  />
                </div>
                {uploadEvidenceProgress.chunks && uploadEvidenceProgress.status !== 'failed' && (
                  <div className="text-xs text-muted-foreground">
                    {uploadEvidenceProgress.chunks} chunks indexed
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setUploadEvidenceOpen(false)
                  setUploadEvidenceProgress(null)
                  setUploadEvidenceFrameworkId('')
                }}
                disabled={['pending', 'running'].includes(uploadEvidenceProgress?.status ?? '')}
              >
                {['pending', 'running'].includes(uploadEvidenceProgress?.status ?? '') ? 'Processing…' : 'Close'}
              </Button>
              {(!uploadEvidenceProgress || ['failed', 'completed'].includes(uploadEvidenceProgress.status)) && (
                <Button type="submit" disabled={!uploadEvidenceFile || !uploadEvidenceFrameworkId}>
                  Upload Evidence
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload standard document dialog */}
      <Dialog
        open={uploadStandardOpen}
        onOpenChange={(open) => {
          setUploadStandardOpen(open)
          if (!open) {
            if (!uploadProgress || ['completed', 'failed'].includes(uploadProgress.status)) {
              setUploadProgress(null)
              setUploadFrameworkId('')
              setUploadFile(null)
              setUploadStartedAt(null)
            }
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Standard Document</DialogTitle>
            <DialogDescription>
              Upload the standard document for the selected framework. The document is linked only to
              that framework for extraction and gap analysis—select the correct one before uploading.
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
            {uploadProgress?.status === 'uploading' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Uploading {uploadProgress.filename}…
              </div>
            )}
            {uploadProgress?.status === 'running' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Indexing {uploadProgress.filename}…
              </div>
            )}
            {uploadProgress &&
              ['uploading', 'pending', 'running', 'completed', 'failed'].includes(uploadProgress.status) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{getUploadPhase(uploadProgress.status).label}</span>
                  {uploadStartedAt && (
                    <span>Elapsed {formatElapsed(Date.now() - uploadStartedAt)}</span>
                  )}
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full ${
                      uploadProgress.status === 'failed' ? 'bg-destructive' : 'bg-primary'
                    }`}
                    style={{
                      width: `${
                        uploadProgress.status === 'uploading'
                          ? uploadProgress.percent ?? 10
                          : getUploadPhase(uploadProgress.status).percent
                      }%`,
                    }}
                  />
                </div>
                {uploadProgress.chunks && uploadProgress.status !== 'failed' && (
                  <div className="text-xs text-muted-foreground">
                    {uploadProgress.chunks} chunks indexed
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setUploadStandardOpen(false)
                  setUploadProgress(null)
                  setUploadFrameworkId('')
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
              {gapAnalysisJob
                ? 'Running LangGraph agents. This may take several minutes.'
                : report?.ok
                  ? 'LangGraph agents have completed the analysis.'
                  : report
                    ? 'An error occurred during gap analysis.'
                    : 'Gap analysis report will appear here.'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Gap analyses are not saved.</strong> Download the report in MD format before
                closing. Reports are only available in this session.
              </span>
            </div>
            {gapAnalysisJob && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{gapAnalysisJob.step}</span>
                  <span className="font-medium">{gapAnalysisJob.percent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${gapAnalysisJob.percent}%` }}
                  />
                </div>
              </div>
            )}
            {!gapAnalysisJob && report && (
              <>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadReportAsMd(report)}
                    className="gap-2"
                  >
                    <FileDown className="h-4 w-4" />
                    Download MD
                  </Button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-md border">
                  <pre
                    className={`whitespace-pre-wrap text-sm p-4 font-sans ${
                      report.ok ? 'bg-muted/50' : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {report.report || 'No report content.'}
                  </pre>
                </div>
              </>
            )}
            {!gapAnalysisJob && !report && (
              <p className="text-sm text-muted-foreground py-4">
                No report available. Run gap analysis on a framework above to generate a report.
                Reports for past assessments are only available if the analysis was run in this
                browser session.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
