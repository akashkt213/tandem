import { Server } from '@hocuspocus/server'
import { COLLAB_ACCESS_CHANGED, COLLAB_HOST, COLLAB_PORT } from '@collab/shared'
import { isOwner } from '../documents/permissions'
import { assertAllowedOrigin, identify, resolveAccess, type CollabContext } from './access'
import { loadDocument, storeDocument } from './storage'

// The running server, so the HTTP API can act on live connections (e.g.
// after sharing changes). Null until startCollabServer() runs.
let collabServer: Server<CollabContext> | null = null

/**
 * Detaches everyone in a document except its owner, so a sharing change
 * applies to people who already have it open: someone downgraded to viewer
 * becomes read-only, someone no longer allowed sees "no access".
 *
 * This only detaches the document, not the WebSocket (one socket can carry
 * several documents), so the client doesn't reconnect by itself. It reacts to
 * the COLLAB_ACCESS_CHANGED reason by authenticating again, which runs
 * onAuthenticate with the new rules (see providerFactory.ts in the web app).
 */
export function disconnectNonOwners(
  documentName: string,
  owner: { owner_id: string | null; guest_owner_id: string | null },
): number {
  const document = collabServer?.hocuspocus.documents.get(documentName)
  if (!document) return 0 // nobody has it open

  let closed = 0
  for (const connection of document.getConnections()) {
    if (isOwner(owner, connection.context as CollabContext)) continue
    // 4205 is Hocuspocus's own "reset connection" code; the reason is what
    // the client looks for.
    connection.close({ code: 4205, reason: COLLAB_ACCESS_CHANGED })
    closed++
  }
  return closed
}

export async function startCollabServer() {
  const server = new Server<CollabContext>({
    name: 'collab-dev', // label for this instance in logs
    port: COLLAB_PORT,
    // Loopback only. Browsers reach it through the web app's /collab proxy
    // (apps/web/vite.config.ts), which is what lets them send auth cookies.
    address: COLLAB_HOST,

    // Close a connection if no message (including pings) arrives for this long.
    timeout: 60_000,

    // Save 5 s after the last edit, and at least every 30 s while edits keep
    // coming. Also saved when the last person leaves.
    debounce: 5_000,
    maxDebounce: 30_000,

    // Log connects, document loads and disconnects. Set true to silence.
    quiet: false,

    // Options for the underlying WebSocket server. These apply before
    // authentication, so they cap what one connection can make the server buffer.
    // A single message over 1 MB (e.g. an enormous paste) closes that connection.
    websocketOptions: { maxPayload: 1024 * 1024 },

    /**
     * Runs once per connection, before any document data is exchanged. The
     * provider always sends an auth message (an empty token when none is
     * configured), so this runs for every client.
     *
     * Identity comes from the cookies on the WebSocket handshake, not from
     * `token`: the access token is an httpOnly cookie the page can't read.
     * Throwing rejects the connection; the client gets the error's `reason`.
     */
    async onAuthenticate({ requestHeaders, documentName, connectionConfig }) {
      assertAllowedOrigin(requestHeaders)
      const who = identify(requestHeaders)
      const access = await resolveAccess(documentName, who)

      // Hocuspocus drops document updates from read-only connections, so
      // viewers can't edit even with a modified client. The client is told
      // too (scope "readonly") and disables the editor.
      if (access === 'view') connectionConfig.readOnly = true

      // Becomes `context` (and `lastContext` in onStoreDocument).
      return who
    },

    /**
     * Runs when a document isn't in memory yet (its first connection since the
     * server started or since everyone left). The row already exists:
     * onAuthenticate created it for a new document.
     */
    async onLoadDocument({ documentName, document }) {
      await loadDocument(documentName, document)
      return document
    },

    async onStoreDocument({ documentName, document, lastContext }) {
      await storeDocument(documentName, document, lastContext)
    },
  })

  // Startup errors (e.g. port in use) are emitted as an 'error' event on the
  // underlying http.Server. Hocuspocus 4.8's listen() doesn't forward that event
  // to its promise: the promise never settles and Node crashes with an unhandled
  // 'error' event. So handle it here instead of with try/catch around listen().
  server.httpServer.once('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${COLLAB_PORT} is already in use. Is another copy of the server running?`,
      )
    } else {
      console.error('Failed to start the collaboration server:', error)
    }
    process.exit(1)
  })

  await server.listen()
  collabServer = server
}
