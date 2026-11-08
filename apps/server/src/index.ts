import { Server } from '@hocuspocus/server'
import { COLLAB_HOST, COLLAB_PORT } from '@collab/shared'

// Phase 1: in-memory only. Hocuspocus keeps each document in memory while at
// least one client is connected and unloads it when the last one leaves, so
// content is lost once everyone disconnects. Persistence comes in Phase 2.
const server = new Server({
  name: 'collab-dev', // label for this instance in logs
  port: COLLAB_PORT,
  // Loopback only: there's no auth yet, so don't accept connections from the network.
  address: COLLAB_HOST,

  // Close a connection if no message (including pings) arrives for this long.
  timeout: 60_000,

  // How often onStoreDocument fires after edits. Nothing is stored yet, so these
  // do nothing in Phase 1; they're kept for the database in Phase 2.
  debounce: 5_000,
  maxDebounce: 30_000,

  // Log connects, document loads and disconnects. Set true to silence.
  quiet: false,

  // Options for the underlying WebSocket server. These apply before
  // authentication, so they cap what one connection can make the server buffer.
  // A single message over 1 MB (e.g. an enormous paste) closes that connection.
  websocketOptions: { maxPayload: 1024 * 1024 },
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
