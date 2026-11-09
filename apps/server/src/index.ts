// First import: loads .env and validates it, exiting with a clear message if
// anything is missing, before any other module reads configuration.
import './env'

import { createServer } from 'node:http'
import { API_HOST, API_PORT } from '@collab/shared'
import { createApp } from './app'
import { startCollabServer } from './collab'

// Two servers in one process for now: the HTTP API (auth, document list) and
// Hocuspocus (real-time editing over WebSocket). They can share one port later.
const api = createServer(createApp())

api.once('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${API_PORT} is already in use. Is another copy of the server running?`)
  } else {
    console.error('Failed to start the API server:', error)
  }
  process.exit(1)
})

// Loopback only, like the collab server. In development the browser reaches it
// through Vite's /api proxy.
api.listen(API_PORT, API_HOST, () => {
  console.log(`API listening on http://${API_HOST}:${API_PORT}`)
})

await startCollabServer()
