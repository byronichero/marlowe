import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function Reports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate reports by assessment, framework, or date range
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Generation</CardTitle>
          <CardDescription>
            Filter and generate compliance reports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Assessment ID</label>
              <Input placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Framework ID</label>
              <Input placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Input type="date" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Input type="date" />
            </div>
          </div>
          <Button className="w-full">Generate Report</Button>
          <p className="text-sm text-muted-foreground">
            The API endpoint <code className="rounded bg-muted px-1">GET /api/v1/reports</code>{' '}
            accepts optional filters. Report content and AI-assisted summaries can be added in a
            future release.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
