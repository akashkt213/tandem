import jwt from 'jsonwebtoken'
import { env } from '../env'

// Short-lived: a stolen token is only useful until it expires. Longer sessions
// will come from refresh tokens (stored in the database, so they can be revoked).
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60

export type AccessTokenClaims = {
  /** The user's id (users.id). */
  userId: string
}

/**
 * The payload is only base64-encoded, not encrypted: anyone holding the token
 * can read it. So it carries the user id and nothing else (no email, no name).
 */
export function signAccessToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  })
}

/** The claims if the token is valid and unexpired, otherwise null. */
export function verifyAccessToken(token: string): AccessTokenClaims | null {
  try {
    // Pin the algorithm. Never let the token's own header choose it.
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] })
    if (typeof payload === 'string' || typeof payload.sub !== 'string') return null
    return { userId: payload.sub }
  } catch {
    // Expired, tampered with, or not a JWT at all.
    return null
  }
}

export const ACCESS_TOKEN_MAX_AGE_MS = ACCESS_TOKEN_TTL_SECONDS * 1000
