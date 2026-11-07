import { ArrowLeftIcon } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export default function DocPage() {
  // The route is /doc/:id, so id is always present when this page renders.
  const { id } = useParams<{ id: string }>()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 md:px-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/">
            <ArrowLeftIcon data-icon="inline-start" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Untitled document</h1>
        <Badge variant="outline" className="font-mono">
          {id}
        </Badge>
      </div>

      <Separator />

      {/* The Lexical editor goes here (Stage 3). */}
      <div className="grid min-h-[60vh] place-items-center rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground">
        Editor coming soon
      </div>
    </div>
  )
}
