import { ArrowLeftIcon } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useIdentity } from '@/collab/identity'
import { NameDialog } from '@/components/name-dialog'
import { PresenceBar } from '@/components/presence-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Editor } from '@/Editor'

export default function DocPage() {
  // The route is /doc/:id, so id is always present when this page renders.
  const { id } = useParams<{ id: string }>()
  const identity = useIdentity()

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
        <div className="ml-auto">
          <PresenceBar />
        </div>
      </div>

      {/* First visit: ask for a name. Closing or saving sets `confirmed`, which
          closes it for good (later changes go through the header button). */}
      <NameDialog open={!identity.confirmed} onOpenChange={() => {}} />

      <Separator />

      {/* key: give each document a fresh editor. Lexical can't repoint a mounted
          editor at another doc, so navigating /doc/a → /doc/b must remount it. */}
      <Editor key={id} docId={id!} />
    </div>
  )
}
