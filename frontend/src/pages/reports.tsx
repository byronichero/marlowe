import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { api } from '@/lib/api'
import type { Framework, GapReportItem, ReportItem } from '@/types'
import { FileText, Loader2, Table2 } from 'lucide-react'

export default function Reports() {
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [assessmentId, setAssessmentId] = useState('')
  const [frameworkId, setFrameworkId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reports, setReports] = useState<ReportItem[]>([])
  const [gapReports, setGapReports] = useState<GapReportItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedGapReport, setSelectedGapReport] = useState<GapReportItem | null>(null)

  useEffect(() => {
    api.getFrameworks().then(setFrameworks).catch(() => setFrameworks([]))
  }, [])

  async function handleGenerateReport() {
    setLoading(true)
    setError(null)
    setHasSearched(true)
    try {
      const filters: {
        assessment_id?: number
        framework_id?: number
        from_date?: string
        to_date?: string
      } = {}
      if (assessmentId.trim()) {
        const id = Number.parseInt(assessmentId.trim(), 10)
        if (!Number.isNaN(id)) filters.assessment_id = id
      }
      if (frameworkId) {
        const id = Number.parseInt(frameworkId, 10)
        if (!Number.isNaN(id)) filters.framework_id = id
      }
      if (fromDate) filters.from_date = fromDate
      if (toDate) filters.to_date = toDate

      const res = await api.getReports(filters)
      setReports(res.reports)
      setGapReports(res.gap_reports)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports')
      setReports([])
      setGapReports([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Reports</h1>
        <p className="text-base text-muted-foreground">
          Generate reports by assessment, framework, or date range
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Report Generation
          </CardTitle>
          <CardDescription>
            Filter and generate compliance reports from assessments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="report-assessment-id" className="text-sm font-medium">
                Assessment ID
              </label>
              <Input
                id="report-assessment-id"
                placeholder="Optional"
                value={assessmentId}
                onChange={(e) => setAssessmentId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="report-framework" className="text-sm font-medium">
                Framework
              </label>
              <Select
                id="report-framework"
                value={frameworkId}
                onChange={(e) => setFrameworkId(e.target.value)}
              >
                <option value="">All frameworks</option>
                {frameworks.map((fw) => (
                  <option key={fw.id} value={String(fw.id)}>
                    {fw.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="report-from-date" className="text-sm font-medium">
                From Date
              </label>
              <Input
                id="report-from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="report-to-date" className="text-sm font-medium">
                To Date
              </label>
              <Input
                id="report-to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleGenerateReport}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              'Generate Report'
            )}
          </Button>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {hasSearched && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Table2 className="h-5 w-5 text-primary" />
                Assessment Reports
              </CardTitle>
              <CardDescription>
                {reports.length === 0
                  ? 'No assessments match the selected filters.'
                  : `${reports.length} assessment(s) found.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reports.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Assessment</th>
                        <th className="px-4 py-3 text-left font-medium">Framework</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Requirements</th>
                        <th className="px-4 py-3 text-left font-medium">Evidence</th>
                        <th className="px-4 py-3 text-left font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="px-4 py-3 font-medium">{r.title}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {r.framework_name ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">{r.requirement_count}</td>
                          <td className="px-4 py-3">{r.evidence_count}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {r.created_at
                              ? new Date(r.created_at).toLocaleDateString()
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Gap Analysis Reports
              </CardTitle>
              <CardDescription>
                {gapReports.length === 0
                  ? 'No gap analysis reports match the selected filters.'
                  : `${gapReports.length} report(s) found.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gapReports.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Framework</th>
                        <th className="px-4 py-3 text-left font-medium">Assessment</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Created</th>
                        <th className="px-4 py-3 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gapReports.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="px-4 py-3 font-medium">
                            {r.framework_name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {r.assessment_id ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {r.created_at
                              ? new Date(r.created_at).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedGapReport(r)}
                            >
                              View report
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={selectedGapReport !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedGapReport(null)
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Gap Analysis Report</DialogTitle>
          </DialogHeader>
          {selectedGapReport ? (
            <div className="space-y-3 text-sm">
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">Framework:</span>{' '}
                {selectedGapReport.framework_name ?? '—'}
                {' · '}
                <span className="font-medium text-foreground">Status:</span>{' '}
                {selectedGapReport.status}
                {' · '}
                <span className="font-medium text-foreground">Created:</span>{' '}
                {selectedGapReport.created_at
                  ? new Date(selectedGapReport.created_at).toLocaleString()
                  : '—'}
              </div>
              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm">
                {selectedGapReport.report_text}
              </pre>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
