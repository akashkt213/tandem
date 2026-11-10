// Shared types and constants for apps/web and apps/server.
// Consumed as TypeScript source (see "exports" in package.json), so there is
// no build step: Vite and tsx compile it directly.

import { z } from 'zod'

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

// --- Auth validation ---------------------------------------------------------

// Validation rules for signup and login, used by both sides:
// - the web app checks the form before sending it (instant feedback, no request)
// - the server checks every request again (the browser can't be trusted)
// Keeping them in one place means the two can never disagree.

export const MIN_PASSWORD_LENGTH = 8

// bcrypt ignores everything after the first 72 bytes of a password, so longer
// ones are rejected rather than silently truncated. Bytes, not characters:
// emoji and non-Latin letters take 2–4 bytes each.
export const MAX_PASSWORD_BYTES = 72

export const MAX_FULL_NAME_LENGTH = 100

export function passwordByteLength(password: string): number {
  return new TextEncoder().encode(password).length
}

// Trimmed and lowercased before validating, so " Akash@Gmail.com " becomes
// "akash@gmail.com" (matching the server's lower(email) unique index).
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email')
  .pipe(z.email('Enter a valid email').max(254, 'Email is too long'))

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Enter your name')
    .max(MAX_FULL_NAME_LENGTH, `Use at most ${MAX_FULL_NAME_LENGTH} characters`),
  email: emailSchema,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
    .refine((p) => passwordByteLength(p) <= MAX_PASSWORD_BYTES, 'Password is too long'),
})

export const loginSchema = z.object({
  email: emailSchema,
  // No strength rules on login (accounts may predate a rule change): only
  // check it's present and not absurdly long.
  password: z.string().min(1, 'Enter your password').max(1024, 'Password is too long'),
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>

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
