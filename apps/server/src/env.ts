import { z } from 'zod'

// Load apps/server/.env if it exists. Variables already set in the real
// environment win, so production can skip the file entirely.
// (Node's --env-file flag would crash when the file is missing.)
try {
  process.loadEnvFile(new URL('../.env', import.meta.url))
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Signs access tokens. Generate one with:
  //   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  // Where the web app runs. Requests that change state must come from here
  // (checked against the Origin header, a basic CSRF defence).
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
})

const parsed = schema.safeParse(process.env)

// Fail at startup, not on the first request that needs a missing value.
if (!parsed.success) {
  console.error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`)
  process.exit(1)
}

export const env = parsed.data
export const isProduction = env.NODE_ENV === 'production'
