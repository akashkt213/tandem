import { GUEST_COOKIE, hashGuestId, parseGuestId } from './guest'
import { verifyAccessToken } from './jwt'
import { ACCESS_COOKIE } from './session'

/**
 * Who is making a request, from their cookies. Used by both the HTTP API and
 * the collab server, so they always agree on who someone is.
 */
export type Identity = {
  /** users.id when logged in (valid access token), otherwise null. */
  userId: string | null
  /** SHA-256 of the guest_id cookie. Logged-in users have one too. */
  guestHash: string | null
}

/**
 * An expired or forged access token counts as logged out. Clients refresh
 * the session before calls where it matters (see ensureFreshSession in the
 * web app), so a logged-in user isn't mistaken for a guest.
 */
export function identityFromCookies(cookies: Record<string, unknown>): Identity {
  const accessToken = cookies[ACCESS_COOKIE]
  const guestId = parseGuestId(cookies[GUEST_COOKIE])
  return {
    userId: typeof accessToken === 'string' ? (verifyAccessToken(accessToken)?.userId ?? null) : null,
    guestHash: guestId ? hashGuestId(guestId) : null,
  }
}
