import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { Framework } from '@/types'
import { Loader2, Sparkles, ClipboardCheck } from 'lucide-react'

const TAXONOMY_SLUG = 'nist-ai-rmf-trustworthiness-taxonomy'

export default function Taxonomy() {
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingTaxonomySeed, setLoadingTaxonomySeed] = useState(false)
  const [taxonomySeedReplaceConfirm, setTaxonomySeedReplaceConfirm] = useState(false)
  const [taxonomySeedMessage, setTaxonomySeedMessage] = useState<string | null>(null)

  useEffect(() => {
    api
      .getFrameworks()
      .then(setFrameworks)
      .catch(() => setFrameworks([]))
      .finally(() => setIsLoading(false))
  }, [])

  const taxonomyFramework = frameworks.find(
    (f) =>
      f.slug === TAXONOMY_SLUG ||
      f.name?.toLowerCase().includes('trustworthiness taxonomy')
  )
  const hasTaxonomy = Boolean(taxonomyFramework)
  let taxonomyButtonContent: JSX.Element | string
  if (loadingTaxonomySeed) {
    taxonomyButtonContent = (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading…
      </>
    )
  } else if (hasTaxonomy) {
    taxonomyButtonContent = 'Taxonomy (loaded)'
  } else {
    taxonomyButtonContent = (
      <>
        <Sparkles className="mr-2 h-4 w-4" />
        Load Taxonomy
      </>
    )
  }

  async function handleLoadTrustworthinessTaxonomy(replace = false) {
    setLoadingTaxonomySeed(true)
    setTaxonomySeedReplaceConfirm(false)
    setTaxonomySeedMessage(null)
    try {
      const result = await api.seedNistAiRmfTaxonomy(replace, false)
      if (result.ok) {
        const next = await api.getFrameworks()
        setFrameworks(next)
        setTaxonomySeedMessage(
          `NIST AI RMF Trustworthiness Taxonomy loaded: ${result.properties_created} properties.`
        )
        setTimeout(() => setTaxonomySeedMessage(null), 8000)
      } else if (result.error) {
        setTaxonomySeedMessage(result.error)
        if (result.error.includes('already exists')) {
          setTaxonomySeedReplaceConfirm(true)
        }
        setTimeout(() => setTaxonomySeedMessage(null), 6000)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load taxonomy'
      setTaxonomySeedMessage(msg)
      if (msg.includes('409') || msg.includes('already exists')) {
        setTaxonomySeedReplaceConfirm(true)
      }
      setTimeout(() => setTaxonomySeedMessage(null), 6000)
    } finally {
      setLoadingTaxonomySeed(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">NIST AI RMF Taxonomy</h1>
        <p className="text-base text-muted-foreground">
          Outcome-based trustworthiness properties for self-assessment, not a compliance audit.
        </p>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Trustworthiness Taxonomy
          </CardTitle>
          <CardDescription>
            Load the 150 core properties aligned to the NIST AI RMF lifecycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading framework list…
            </div>
          ) : (
            <>
              <Button
                onClick={() => {
                  if (!hasTaxonomy) {
                    handleLoadTrustworthinessTaxonomy(taxonomySeedReplaceConfirm)
                  }
                }}
                variant={hasTaxonomy ? 'outline' : 'default'}
                size="sm"
                disabled={loadingTaxonomySeed || (hasTaxonomy && !taxonomySeedReplaceConfirm)}
              >
                {taxonomyButtonContent}
              </Button>
              {taxonomySeedReplaceConfirm && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleLoadTrustworthinessTaxonomy(true)}
                  disabled={loadingTaxonomySeed}
                >
                  Replace existing
                </Button>
              )}
              {taxonomySeedMessage && (
                <p className="text-xs text-muted-foreground">{taxonomySeedMessage}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {taxonomyFramework && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Start taxonomy assessment
            </CardTitle>
            <CardDescription>
              Capture maturity across stages and characteristics using the entry table.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to={`/taxonomy-assessment/${taxonomyFramework.id}`}>
              <Button size="sm">Open Taxonomy Assessment</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
