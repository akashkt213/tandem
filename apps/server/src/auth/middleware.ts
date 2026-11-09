import type { RequestHandler } from 'express'
import { verifyAccessToken } from './jwt'
import { ACCESS_COOKIE } from './session'

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth: the signed-in user's id. */
      userId?: string
    }
  }
}

/**
 * Rejects the request with 401 unless it carries a valid access token cookie.
 * On 401 the client should call POST /api/auth/refresh once and retry; if that
 * also fails, the user has to log in again.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  const token: unknown = req.cookies?.[ACCESS_COOKIE]
  const claims = typeof token === 'string' ? verifyAccessToken(token) : null
  if (!claims) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  req.userId = claims.userId
  next()
}
