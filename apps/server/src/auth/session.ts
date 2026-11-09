import { createHash, randomBytes } from 'node:crypto'
import { API_PREFIX } from '@collab/shared'
import type { Response } from 'express'
import type pg from 'pg'
import { pool, withTransaction } from '../db'
import { isProduction } from '../env'
import { ACCESS_TOKEN_MAX_AGE_MS, signAccessToken } from './jwt'

// A session is two cookies:
// - access_token: a 15-minute JWT, sent with every request. Checked without a
//   database lookup, so it can't be revoked early; that's why it's short.
// - refresh_token: a random 30-day token, sent only to /api/auth/*. Stored
//   (hashed) in refresh_tokens, so logout really ends the session.

export const ACCESS_COOKIE = 'access_token'
export const REFRESH_COOKIE = 'refresh_token'

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

// Two tabs can refresh at the same moment with the same token. The second one
// arrives just after the first revoked it, which would otherwise look like a
// stolen token being replayed. Accept a revoked token for this long after it
// was rotated.
const REUSE_GRACE_MS = 10_000

export type SessionTokens = { accessToken: string; refreshToken: string }

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function insertRefreshToken(
  db: pg.Pool | pg.PoolClient,
  userId: string,
  userAgent: string | undefined,
): Promise<{ id: string; token: string }> {
  // 256 random bits. Not a JWT: it means nothing without the database row.
  const token = randomBytes(32).toString('base64url')
  const { rows } = await db.query<{ id: string }>(
    `insert into refresh_tokens (user_id, token_hash, expires_at, user_agent)
     values ($1, $2, $3, $4)
     returning id`,
    [userId, sha256(token), new Date(Date.now() + REFRESH_TOKEN_TTL_MS), userAgent ?? null],
  )
  return { id: rows[0]!.id, token }
}

/** Starts a new session for a user who just signed up or logged in. */
export async function createSession(userId: string, userAgent?: string): Promise<SessionTokens> {
  const { token } = await insertRefreshToken(pool, userId, userAgent)
  return { accessToken: signAccessToken(userId), refreshToken: token }
}

/**
 * Exchanges a refresh token for a new access token and a new refresh token.
 * Returns null if the token is unknown, expired or revoked.
 *
 * If a token that was rotated a while ago shows up again, someone kept a copy
 * of it (stolen cookie). We can't tell the thief from the real user, so every
 * session of that user is revoked and both have to log in again.
 */
export async function rotateSession(
  refreshToken: string,
  userAgent?: string,
): Promise<SessionTokens | null> {
  return withTransaction(async (client) => {
    // FOR UPDATE: concurrent refreshes of the same token wait for each other
    // instead of both rotating it.
    const { rows } = await client.query<{
      id: string
      user_id: string
      expires_at: Date
      revoked_at: Date | null
      successor_active: boolean
    }>(
      `select t.id, t.user_id, t.expires_at, t.revoked_at,
              (s.id is not null and s.revoked_at is null) as successor_active
       from refresh_tokens t
       left join refresh_tokens s on s.id = t.replaced_by
       where t.token_hash = $1
       for update of t`,
      [sha256(refreshToken)],
    )
    const row = rows[0]
    if (!row || row.expires_at.getTime() <= Date.now()) return null

    if (row.revoked_at !== null) {
      const withinGrace = Date.now() - row.revoked_at.getTime() <= REUSE_GRACE_MS
      if (!withinGrace) {
        // Rotated long ago and used again: treat as stolen.
        await client.query(
          `update refresh_tokens set revoked_at = now()
           where user_id = $1 and revoked_at is null`,
          [row.user_id],
        )
        return null
      }
      // Within the grace window, accept it only if it was rotated (not logged
      // out or revoked as stolen) and what replaced it is still valid.
      // Otherwise a session ended seconds ago could be brought back.
      if (!row.successor_active) return null
    }

    const next = await insertRefreshToken(client, row.user_id, userAgent)
    if (row.revoked_at === null) {
      await client.query(
        `update refresh_tokens set revoked_at = now(), replaced_by = $2 where id = $1`,
        [row.id, next.id],
      )
    }
    return { accessToken: signAccessToken(row.user_id), refreshToken: next.token }
  })
}

/** Ends one session (logout). Unknown or already-revoked tokens are ignored. */
export async function revokeSession(refreshToken: string): Promise<void> {
  await pool.query(
    `update refresh_tokens set revoked_at = now()
     where token_hash = $1 and revoked_at is null`,
    [sha256(refreshToken)],
  )
}

// --- Cookies -----------------------------------------------------------------

const baseCookie = {
  httpOnly: true, // JavaScript on the page can't read it, so XSS can't steal it
  secure: isProduction, // HTTPS only in production (dev runs on http://localhost)
} as const

const accessCookie = { ...baseCookie, sameSite: 'lax', path: '/' } as const

// Only sent to the auth routes, never to other API calls or page loads.
// `strict`: not even sent when following a link from another site.
const refreshCookie = { ...baseCookie, sameSite: 'strict', path: `${API_PREFIX}/auth` } as const

export function setSessionCookies(res: Response, tokens: SessionTokens): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...accessCookie, maxAge: ACCESS_TOKEN_MAX_AGE_MS })
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...refreshCookie, maxAge: REFRESH_TOKEN_TTL_MS })
}

export function clearSessionCookies(res: Response): void {
  // Same path/flags as when set, or the browser treats it as a different cookie.
  res.clearCookie(ACCESS_COOKIE, accessCookie)
  res.clearCookie(REFRESH_COOKIE, refreshCookie)
}
