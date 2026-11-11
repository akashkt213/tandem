import { env } from '../env'
import { identityFromCookies, type Identity } from '../auth/identity'
import { parseCookies } from '../lib/cookies'
import {
  accessFor,
  findDocument,
  findOrCreateDocument,
  isValidDocumentId,
  type DocumentAccess,
} from '../documents/permissions'

// Collab-server side of access control: identifying a WebSocket handshake and
// turning the shared rules (../documents/permissions.ts) into a decision.

/** Kept on every connection (Hocuspocus "context") and passed to later hooks. */
export type CollabContext = Identity

/**
 * Thrown from onAuthenticate to reject a connection. Hocuspocus sends
 * `reason` to the client, which receives it in the provider's
 * 'authenticationFailed' event and can show the right message.
 */
export class CollabAccessError extends Error {
  readonly reason: 'forbidden' | 'not-found' | 'invalid-document' | 'no-identity'

  constructor(reason: CollabAccessError['reason']) {
    super(reason)
    this.reason = reason
  }
}

/**
 * Rejects WebSocket connections opened by other websites.
 *
 * Browsers attach cookies to a WebSocket handshake no matter which site
 * opened it, so without this, any page you visit could open the editor's
 * socket with *your* session (cross-site WebSocket hijacking). Browsers
 * always send Origin on WebSockets; a missing one means a non-browser client,
 * which can't be carrying a victim's cookies.
 */
export function assertAllowedOrigin(headers: Headers): void {
  const origin = headers.get('origin')
  if (origin !== null && origin !== env.WEB_ORIGIN) throw new CollabAccessError('forbidden')
}

/** Reads the session and guest cookies from the WebSocket handshake. */
export function identify(headers: Headers): CollabContext {
  return identityFromCookies(parseCookies(headers.get('cookie')))
}

/**
 * Decides what `who` may do with a document, or throws CollabAccessError.
 *
 * Opening a document that doesn't exist yet creates it, with `who` as the
 * owner. That happens here, before the connection is accepted, so the row
 * already exists when the page asks the API about the document right after
 * connecting.
 *
 * Checked once, when the connection opens. Changing sharing reconnects the
 * people affected (see disconnectNonOwners), so they're checked again.
 */
export async function resolveAccess(documentName: string, who: CollabContext): Promise<DocumentAccess> {
  if (!isValidDocumentId(documentName)) throw new CollabAccessError('invalid-document')

  let doc = await findDocument(documentName)
  if (!doc) {
    // Whoever opens a new document becomes its owner, so we need to know who
    // they are. Only happens if cookies are blocked.
    if (!who.userId && !who.guestHash) throw new CollabAccessError('no-identity')
    doc = await findOrCreateDocument(documentName, who)
  }

  if (doc.deleted_at) throw new CollabAccessError('not-found')
  const access = accessFor(doc, who)
  if (!access) throw new CollabAccessError('forbidden')
  return access
}
