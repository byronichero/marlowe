import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select } from '@/components/ui/select'
import { api } from '@/lib/api'
import type { FrameworkLibraryItem } from '@/types'
import {
  BookOpen,
  ClipboardCheck,
  ExternalLink,
  Filter,
  Network,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

type StatusFilter = 'all' | 'ready' | 'incomplete'

function getStatus(item: FrameworkLibraryItem): 'ready' | 'incomplete' {
  return item.has_evidence && item.requirement_count >= 1 ? 'ready' : 'incomplete'
}

export default function StandardsLibrary() {
  const [items, setItems] = useState<FrameworkLibraryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    api
      .getFrameworksLibrary()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setIsLoading(false))
  }, [])

  const filteredItems = useMemo(() => {
    if (statusFilter === 'all') return items
    return items.filter((item) => getStatus(item) === statusFilter)
  }, [items, statusFilter])

  const readyCount = items.filter((i) => getStatus(i) === 'ready').length
  const incompleteCount = items.filter((i) => getStatus(i) === 'incomplete').length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-8 w-8" />
          Standards Library
        </h1>
        <p className="text-muted-foreground mt-1">
          Catalog of compliance frameworks with evidence status, documents, and requirements. Use this
          to see which standards are ready for gap analysis.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Frameworks & Standards</CardTitle>
              <CardDescription>
                {items.length} framework{items.length === 1 ? '' : 's'} • {readyCount} ready for gap
                analysis • {incompleteCount} incomplete
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-[200px]"
              >
                <option value="all">All frameworks</option>
                <option value="ready">Ready for gap analysis</option>
                <option value="incomplete">Incomplete</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Region</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Documents</th>
                    <th className="text-right p-3 font-medium">Requirements</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="p-3 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-56" />
                      </td>
                      <td className="p-3"><Skeleton className="h-4 w-12" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="p-3"><Skeleton className="h-5 w-28 rounded-full" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="p-3 text-right"><Skeleton className="h-4 w-6 ml-auto" /></td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-16" />
                          <Skeleton className="h-8 w-14" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && filteredItems.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p>
                {items.length === 0
                  ? 'No frameworks yet'
                  : `No frameworks match "${statusFilter}"`}
              </p>
              {items.length === 0 && (
                <Link to="/assessments" className="inline-block mt-4">
                  <Button variant="outline">Add Framework</Button>
                </Link>
              )}
            </div>
          )}

          {!isLoading && filteredItems.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Region</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Documents</th>
                    <th className="text-right p-3 font-medium">Requirements</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const status = getStatus(item)
                    return (
                      <tr
                        key={item.id}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-3">
                          <span className="font-medium">{item.name}</span>
                          {item.description && (
                            <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {item.region ?? '—'}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {item.framework_type ?? '—'}
                        </td>
                        <td className="p-3">
                          {status === 'ready' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 text-xs font-medium">
                              <CheckCircle2 className="h-3 w-3" />
                              Ready for gap analysis
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">
                              <AlertCircle className="h-3 w-3" />
                              Incomplete
                            </span>
                          )}
                        </td>
                        <td className="p-3 max-w-[200px]">
                          {item.documents.length > 0 ? (
                            <ul className="space-y-0.5">
                              {item.documents.slice(0, 3).map((doc) => (
                                <li key={doc} className="text-xs truncate" title={doc}>
                                  {doc}
                                </li>
                              ))}
                              {item.documents.length > 3 && (
                                <li className="text-xs text-muted-foreground">
                                  +{item.documents.length - 3} more
                                </li>
                              )}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground text-xs">No documents</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {item.requirement_count}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-2">
                            <Link to="/assessments">
                              <Button variant="ghost" size="sm" className="h-8">
                                <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                                Assess
                              </Button>
                            </Link>
                            <Link to="/knowledge-graph">
                              <Button variant="ghost" size="sm" className="h-8">
                                <Network className="mr-1 h-3.5 w-3.5" />
                                Graph
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4">
        <Link to="/assessments" className="inline-flex">
          <Button variant="outline" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Compliance & Gap Analysis
            <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
        <Link to="/knowledge-graph" className="inline-flex">
          <Button variant="outline" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Knowledge Graph
            <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
