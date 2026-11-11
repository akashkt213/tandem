import { USER_COLORS, loginSchema, signupSchema, type PublicUser } from '@collab/shared'
import express, { type Request, type RequestHandler, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { isUniqueViolation, pool } from '../db'
import { ensureGuestId } from './guest'
import { requireAuth } from './middleware'
import { hashPassword, verifyPassword } from './password'
import {
  REFRESH_COOKIE,
  clearSessionCookies,
  createSession,
  revokeSession,
  rotateSession,
  setSessionCookies,
} from './session'

// --- Validation --------------------------------------------------------------

// signupSchema and loginSchema come from @collab/shared: the web form checks
// the same rules before sending, and they're checked again here because a
// request doesn't have to come from our form.

/** The parsed body, or null after sending a 400 with per-field messages. */
function parseBody<T extends z.ZodType>(schema: T, req: Request, res: Response): z.infer<T> | null {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({
      error: 'Invalid input',
      fields: z.flattenError(result.error).fieldErrors, // e.g. { email: ['Enter a valid email'] }
    })
    return null
  }
  return result.data
}

// --- Users -------------------------------------------------------------------

type UserRow = {
  id: string
  email: string
  full_name: string
  color: string
  created_at: Date
}

const USER_COLUMNS = 'id, email, full_name, color, created_at'

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    color: row.color,
    createdAt: row.created_at.toISOString(),
  }
}

function randomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]!
}

// --- Routes ------------------------------------------------------------------

export const authRouter = express.Router()

// Slows down password guessing and mass signups: 20 attempts per 15 minutes
// per IP across signup and login. (Behind a reverse proxy in production, set
// app.set('trust proxy', …) so this sees the real client IP.)
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
})

authRouter.post('/signup', credentialsLimiter, async (req, res) => {
  const body = parseBody(signupSchema, req, res)
  if (!body) return

  const passwordHash = await hashPassword(body.password)

  let user: UserRow
  try {
    const { rows } = await pool.query<UserRow>(
      `insert into users (email, full_name, password_hash, color)
       values ($1, $2, $3, $4)
       returning ${USER_COLUMNS}`,
      [body.email, body.fullName, passwordHash, randomColor()],
    )
    user = rows[0]!
  } catch (error) {
    if (isUniqueViolation(error, 'users_email_lower_idx')) {
      res.status(409).json({
        error: 'An account with this email already exists',
        fields: { email: ['An account with this email already exists'] },
      })
      return
    }
    throw error
  }

  setSessionCookies(res, await createSession(user.id, req.get('user-agent')))
  res.status(201).json({ user: toPublicUser(user) })
})

authRouter.post('/login', credentialsLimiter, async (req, res) => {
  const body = parseBody(loginSchema, req, res)
  if (!body) return

  const { rows } = await pool.query<UserRow & { password_hash: string | null }>(
    `select ${USER_COLUMNS}, password_hash from users where lower(email) = lower($1)`,
    [body.email],
  )
  const user = rows[0]

  // Runs a bcrypt compare even when the user doesn't exist, and the error is
  // the same either way, so neither the message nor the timing reveals which
  // emails have accounts.
  const valid = await verifyPassword(body.password, user?.password_hash ?? null)
  if (!user || !valid) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  setSessionCookies(res, await createSession(user.id, req.get('user-agent')))
  res.json({ user: toPublicUser(user) })
})

authRouter.post('/refresh', async (req, res) => {
  const token: unknown = req.cookies?.[REFRESH_COOKIE]
  const tokens = typeof token === 'string' ? await rotateSession(token, req.get('user-agent')) : null
  if (!tokens) {
    clearSessionCookies(res)
    res.status(401).json({ error: 'Session expired. Log in again.' })
    return
  }
  setSessionCookies(res, tokens)
  res.status(204).end()
})

authRouter.post('/logout', async (req, res) => {
  const token: unknown = req.cookies?.[REFRESH_COOKIE]
  if (typeof token === 'string') await revokeSession(token)
  clearSessionCookies(res)
  res.status(204).end()
})

// Runs before requireAuth, so guests (who get a 401 from it) still receive
// their guest cookie. The web app calls /me on every page load.
const withGuestCookie: RequestHandler = (req, res, next) => {
  ensureGuestId(req, res)
  next()
}

authRouter.get('/me', withGuestCookie, requireAuth, async (req, res) => {
  const { rows } = await pool.query<UserRow>(`select ${USER_COLUMNS} from users where id = $1`, [
    req.userId,
  ])
  const user = rows[0]
  if (!user) {
    // Valid token, but the account was deleted since it was issued.
    clearSessionCookies(res)
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  res.json({ user: toPublicUser(user) })
})
