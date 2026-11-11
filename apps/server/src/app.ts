import { API_PREFIX } from '@collab/shared'
import cookieParser from 'cookie-parser'
import express, { type ErrorRequestHandler, type RequestHandler } from 'express'
import { authRouter } from './auth/routes'
import { documentsRouter } from './documents/routes'
import { pool } from './db'
import { env } from './env'

/**
 * Basic CSRF defence. Auth uses cookies, which the browser attaches to every
 * request to this site, including ones triggered by another website. Browsers
 * always send an Origin header on POST/PUT/PATCH/DELETE, so reject those that
 * come from somewhere other than our web app. Requests with no Origin header
 * (curl, server-to-server) can't carry a victim's cookies, so they're allowed.
 */
const requireSameOrigin: RequestHandler = (req, res, next) => {
  const safe = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS'
  const origin = req.get('origin')
  if (!safe && origin !== undefined && origin !== env.WEB_ORIGIN) {
    res.status(403).json({ error: 'Cross-origin request blocked' })
    return
  }
  next()
}

export function createApp() {
  const app = express()
  app.disable('x-powered-by') // don't advertise the framework

  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  app.use(requireSameOrigin)

  const api = express.Router()

  // Checks the API and the database are both up.
  api.get('/health', async (_req, res) => {
    await pool.query('select 1')
    res.json({ ok: true })
  })

  api.use('/auth', authRouter)
  api.use('/documents', documentsRouter)

  app.use(API_PREFIX, api)

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  // Express 5 forwards errors thrown in async handlers here automatically.
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    // Errors from express.json(): bad JSON or an oversized body.
    if (error?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON body' })
      return
    }
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request body too large' })
      return
    }
    // Anything else is a bug or an outage. Log the details, but don't send them
    // to the client (they can include SQL, stack traces, or connection strings).
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
  app.use(errorHandler)

  return app
}
