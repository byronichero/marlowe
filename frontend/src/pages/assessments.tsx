import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { Assessment } from '@/types'
import { Plus, Calendar, Building } from 'lucide-react'

export default function Assessments() {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api
      .getAssessments()
      .then(setAssessments)
      .catch(() => setAssessments([]))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assessments</h1>
          <p className="text-muted-foreground">
            Create and manage assessments linked to frameworks
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Assessment
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Assessments</CardTitle>
          <CardDescription>
            View and manage framework assessments for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : assessments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p>No assessments yet</p>
              <p className="text-sm mt-2">Create your first assessment to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assessments.map((assessment) => (
                <div
                  key={assessment.id}
                  className="rounded-lg border p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold">
                        {assessment.organization || 'Unnamed Assessment'}
                      </h3>
                      <p className="text-sm text-muted-foreground">{assessment.scope}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(assessment.created_at).toLocaleDateString()}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            assessment.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : assessment.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {assessment.status}
                        </span>
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
    </div>
  )
}
