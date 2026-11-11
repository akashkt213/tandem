import { authKeys, fetchCurrentUser } from '@/api/auth'
import { queryClient } from '@/lib/query-client'

/**
 * Makes sure the access token cookie is valid before a request where who you
 * are changes the answer, but that guests may also make (so the server can't
 * just reply 401): opening the editor's WebSocket, or asking whether you own
 * a document.
 *
 * The access token lives 15 minutes. If it has expired, the server treats the
 * request as a guest's. Fetching /api/auth/me first refreshes the session when
 * needed (apiRequest retries it via /auth/refresh). Skipped when /me was
 * fetched in the last few seconds.
 */
export async function ensureFreshSession(): Promise<void> {
  try {
    await queryClient.fetchQuery({
      queryKey: authKeys.me,
      queryFn: ({ signal }) => fetchCurrentUser(signal),
      staleTime: 10_000,
    })
  } catch {
    // Offline or server down: carry on; the request itself will report it.
  }
}
