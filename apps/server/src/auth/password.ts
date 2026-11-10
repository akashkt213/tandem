import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'

// bcryptjs is pure JavaScript (no native build) and writes the same $2b$ hashes
// as the native `bcrypt` package, so you can switch later without rehashing.
//
// Cost 12 = 2^12 rounds. Raise it as hardware gets faster; old hashes keep
// working because the cost is stored inside each hash.
const COST = 12

// Password length rules (including bcrypt's 72-byte limit) live with the
// signup schema in @collab/shared, so the web form enforces the same ones.

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
