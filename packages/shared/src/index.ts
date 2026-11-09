// Shared types and constants for apps/web and apps/server.
// Consumed as TypeScript source (see "exports" in package.json), so there is
// no build step: Vite and tsx compile it directly.

// --- Collaboration server ---------------------------------------------------

// 127.0.0.1 rather than "localhost": the server binds to IPv4 loopback only, and
// on Windows "localhost" can resolve to the IPv6 address ::1, which wouldn't connect.
export const COLLAB_HOST = '127.0.0.1'
export const COLLAB_PORT = 1234
export const COLLAB_URL = `ws://${COLLAB_HOST}:${COLLAB_PORT}`

// --- HTTP API (auth, document list) -----------------------------------------

// The browser never calls this port directly: Vite proxies /api to it (see
// apps/web/vite.config.ts), so auth cookies stay same-origin with the web app.
export const API_HOST = '127.0.0.1'
export const API_PORT = 3000
export const API_PREFIX = '/api'

// --- Users -------------------------------------------------------------------

// Cursor / avatar colours. The server picks one for new accounts; the web app
// uses them for guests and in the name dialog.
// Darker shades (Tailwind 600–700): Lexical draws cursor labels as white text on
// this colour, so lighter shades would be hard to read.
export const USER_COLORS = [
  '#dc2626', // red
  '#c2410c', // orange
  '#b45309', // amber
  '#15803d', // green
  '#0f766e', // teal
  '#0369a1', // sky
  '#2563eb', // blue
  '#7c3aed', // violet
  '#c026d3', // fuchsia
  '#db2777', // pink
] as const

/** A signed-in user, as the API returns it. */
export type PublicUser = {
  id: string
  email: string
  fullName: string
  color: string
  createdAt: string // ISO 8601
}
