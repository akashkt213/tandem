import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'

// bcryptjs is pure JavaScript (no native build) and writes the same $2b$ hashes
// as the native `bcrypt` package, so you can switch later without rehashing.
//
// Cost 12 = 2^12 rounds. Raise it as hardware gets faster; old hashes keep
// working because the cost is stored inside each hash.
const COST = 12

// bcrypt silently ignores everything after the first 72 bytes, so
// "<72 bytes>A" and "<72 bytes>B" would be the same password. Signup
// validation must reject longer passwords (bytes, not characters: emoji and
// non-Latin letters take 2–4 bytes each).
export const MAX_PASSWORD_BYTES = 72
export const MIN_PASSWORD_LENGTH = 8

export function passwordByteLength(password: string): number {
  return Buffer.byteLength(password, 'utf8')
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST)
}

// Compared against when the email doesn't exist (or the account has no
// password), so "unknown email" takes as long as "wrong password" and response
// times don't reveal which emails are registered. Created once, in the background.
const dummyHash = bcrypt.hash(randomUUID(), COST)

/**
 * True if `password` matches `hash`. Pass `null` when there's no such user;
 * it still spends the same time and returns false.
 */
export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (hash === null) {
    await bcrypt.compare(password, await dummyHash)
    return false
  }
  return bcrypt.compare(password, hash)
}
