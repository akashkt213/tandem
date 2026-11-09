import pg from 'pg'
import { env } from './env'

// One pool for the whole process. pg opens connections lazily (up to 10 by
// default) and reuses them. Always use parameterised queries ($1, $2, …),
// never string concatenation, so user input can't inject SQL.
export const pool = new pg.Pool({ connectionString: env.DATABASE_URL })

// An idle client lost its connection (e.g. Postgres restarted). Without a
// listener this 'error' event would crash the process; the pool replaces the
// client on the next query instead.
pool.on('error', (error) => {
  console.error('Unexpected error on an idle Postgres client:', error)
})

/**
 * Runs `fn` inside a transaction on one connection: commits if it returns,
 * rolls back if it throws. Use the `client` it's given, not `pool`, for every
 * query that should be part of the transaction.
 */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback').catch(() => {}) // keep the original error
    throw error
  } finally {
    client.release()
  }
}

/** True if `error` is Postgres rejecting a duplicate value (unique_violation). */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const e = error as { code?: unknown; constraint?: unknown } | null
  return e?.code === '23505' && (constraint === undefined || e.constraint === constraint)
}
