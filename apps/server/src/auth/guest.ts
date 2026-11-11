import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { isProduction } from '../env'

// A guest's private identity: a random secret in an httpOnly cookie.
//
// Guests already have an id in localStorage (identity.ts), but that one is
// shown to everyone in a document (presence), so anyone could copy it. This
// cookie is never readable by JavaScript and never sent to other users, so it
// can safely prove "I'm the guest who created this document".
//
// The database only ever stores its SHA-256 hash (documents.guest_owner_id),
// so a database leak doesn't let anyone act as the guest.

export const GUEST_COOKIE = 'guest_id'

const GUEST_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000

// 32 random bytes, base64url-encoded = 43 characters.
const GUEST_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/

/** The guest secret from a cookie value, or null if missing or malformed. */
export function parseGuestId(value: unknown): string | null {
  return typeof value === 'string' && GUEST_ID_PATTERN.test(value) ? value : null
}

/** What gets stored in documents.guest_owner_id. */
export function hashGuestId(guestId: string): string {
  return createHash('sha256').update(guestId).digest('hex')
}

/**
 * Makes sure the browser has a guest cookie, creating one if it's missing or
 * invalid. Returns the guest secret.
 *
 * Called from GET /api/auth/me, which the web app requests on every page load
 * before opening a document, so the cookie exists before the editor's
 * WebSocket connects. Logged-in users get one too: it stays put across login
 * and logout, so documents made as a guest can later be claimed by logging in.
 */
export function ensureGuestId(req: Request, res: Response): string {
  const existing = parseGuestId(req.cookies?.[GUEST_COOKIE])
  if (existing) return existing

  const guestId = randomBytes(32).toString('base64url')
  res.cookie(GUEST_COOKIE, guestId, {
    httpOnly: true, // JavaScript can't read it, so XSS can't steal it
    secure: isProduction,
    sameSite: 'lax',
    path: '/', // sent to /api and to the /collab WebSocket
    maxAge: GUEST_COOKIE_MAX_AGE_MS,
  })
  return guestId
}
