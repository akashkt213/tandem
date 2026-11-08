// Shared types and constants for apps/web and apps/server.
// Consumed as TypeScript source (see "exports" in package.json), so there is
// no build step: Vite and tsx compile it directly.

// --- Collaboration server ---------------------------------------------------

// 127.0.0.1 rather than "localhost": the server binds to IPv4 loopback only, and
// on Windows "localhost" can resolve to the IPv6 address ::1, which wouldn't connect.
export const COLLAB_HOST = '127.0.0.1'
export const COLLAB_PORT = 1234
export const COLLAB_URL = `ws://${COLLAB_HOST}:${COLLAB_PORT}`
