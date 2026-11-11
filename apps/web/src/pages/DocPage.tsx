import { ArrowLeftIcon, EyeIcon, LockIcon } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router'
import { useCollabAccess, type CollabAccess } from '@/collab/access'
import { useIdentity } from '@/collab/identity'
import { useCollabProvider } from '@/collab/presence'
import { NameDialog } from '@/components/name-dialog'
import { PresenceBar } from '@/components/presence-bar'
import { ShareDialog } from '@/components/share-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Editor } from '@/Editor'
import { useCurrentUser } from '@/hooks/use-auth'
import { useDocument } from '@/hooks/use-document'
import { paths, withNext } from '@/routes/paths'

export default function DocPage() {
  // The route is /doc/:id, so id is always present when this page renders.
  const { id } = useParams<{ id: string }>()
  const docId = id!
  const identity = useIdentity()
  const { user, isLoading: authLoading } = useCurrentUser()
  const access = useCollabAccess(useCollabProvider(), docId)
  // Only once the editor's connection is accepted: a new document's row is
  // created at that moment, so asking earlier would 404.
  const canOpen = access.state === 'edit' || access.state === 'view'
  const { data: document } = useDocument(docId, { enabled: canOpen })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 md:px-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to={paths.home}>
            <ArrowLeftIcon data-icon="inline-start" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {document?.title ?? 'Untitled document'}
        </h1>
        <Badge variant="outline" className="font-mono">
          {docId}
        </Badge>
        {access.state === 'view' && (
          <Badge variant="secondary" className="gap-1">
            <EyeIcon />
            View only
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-3">
          <PresenceBar />
          {/* Only the owner can change who has access. */}
          {document?.isOwner && <ShareDialog document={document} />}
        </div>
      </div>

      {/* First visit: ask for a name. Closing or saving sets `confirmed`, which
          closes it for good (later changes go through the header button). */}
      <NameDialog open={!identity.confirmed} onOpenChange={() => {}} />

      <Separator />

      {access.state === 'denied' && <AccessDenied access={access} loggedIn={user != null} />}

      {/* Wait until /api/auth/me has answered before connecting: that response
          sets the guest_id cookie on a first visit, and the WebSocket handshake
          has to carry it (and the session cookie) for the server to know who
          you are.

          key: remount (and so reconnect) when the document changes, since
          Lexical can't repoint a mounted editor at another doc, and when you
          log in or out, since the server only checks who you are when a
          connection opens.

          Kept mounted but hidden when access is denied: unmounting would leave
          the denied answer in place with no editor left to reconnect. */}
      {authLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div hidden={access.state === 'denied'}>
          <Editor
            key={`${docId}:${user?.id ?? 'guest'}`}
            docId={docId}
            editable={access.state === 'edit'}
          />
        </div>
      )}
    </div>
  )
}

// Reasons come from CollabAccessError on the server (apps/server/src/collab/access.ts).
const DENIED_MESSAGES: Record<string, { title: string; body: string }> = {
  forbidden: {
    title: "You don't have access to this document",
    body: 'The owner has turned off link sharing. Ask them to share it with you.',
  },
  'not-found': {
    title: 'This document was deleted',
    body: 'It no longer exists, or the owner moved it to the trash.',
  },
  'invalid-document': {
    title: 'This link isn’t valid',
    body: 'Check the address and try again.',
  },
  'no-identity': {
    title: 'We couldn’t identify your browser',
    body: 'Creating a document needs cookies. Allow cookies for this site, or log in.',
  },
}

function AccessDenied({
  access,
  loggedIn,
}: {
  access: Extract<CollabAccess, { state: 'denied' }>
  loggedIn: boolean
}) {
  const location = useLocation()
  const message = DENIED_MESSAGES[access.reason] ?? {
    title: 'This document couldn’t be opened',
    body: 'Try again later.',
  }
  // Logging in might grant access (e.g. you own the document), so offer it,
  // coming back here afterwards.
  const offerLogin = !loggedIn && (access.reason === 'forbidden' || access.reason === 'no-identity')

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-xl border px-6 py-16 text-center"
    >
      <LockIcon className="size-6 text-muted-foreground" aria-hidden />
      <h2 className="text-lg font-semibold">{message.title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{message.body}</p>
      <div className="mt-2 flex gap-2">
        {offerLogin && (
          <Button asChild size="sm">
            <Link to={withNext(paths.login, location.pathname)}>Log in</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to={paths.home}>Go home</Link>
        </Button>
      </div>
    </div>
  )
}
