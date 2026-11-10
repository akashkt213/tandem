import { API_PREFIX } from '@collab/shared'

/**
 * Where API requests go. In development this is the relative path "/api",
 * which Vite proxies to the Express server (see vite.config.ts), so the
 * browser sees a single origin and auth cookies just work. Set VITE_API_URL to
 * point somewhere else (e.g. a deployed API).
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? API_PREFIX

/** Per-field validation messages, e.g. { email: ['Enter a valid email'] }. */
export type FieldErrors = Partial<Record<string, string[]>>

/**
 * Every failed API call throws this, so callers handle one error shape:
 * an HTTP status, a message that's safe to show, and optional field errors.
 * status 0 means the request never got a response (offline, server down).
 */
export class ApiError extends Error {
  readonly status: number
  readonly fields: FieldErrors

  constructor(status: number, message: string, fields: FieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** A message to show the user for any thrown value. */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) return error.message
  return 'Something went wrong. Please try again.'
}

/** The first validation message for one form field, if the server sent one. */
export function getFieldError(error: unknown, field: string): string | undefined {
  return isApiError(error) ? error.fields[field]?.[0] : undefined
}

// --- Session refresh ---------------------------------------------------------

// Several requests can hit 401 at the same moment when the access token
// expires. They all wait for one refresh instead of each starting their own
// (which the server would see as the same refresh token being reused).
let refreshInFlight: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

// A 401 from these means "wrong password" or "no session", not "access token
// expired", so refreshing and retrying would be pointless (or loop forever).
// /auth/me is deliberately not here: after the 15-minute access token expires,
// it's the call that has to refresh to find out you're still logged in.
const NO_REFRESH_PATHS = new Set(['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout'])

function canRetryAfterRefresh(path: string): boolean {
  return !NO_REFRESH_PATHS.has(path)
}

// --- Requests ----------------------------------------------------------------

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Sent as JSON. */
  body?: unknown
  signal?: AbortSignal
}

async function send(path: string, { method = 'GET', body, signal }: RequestOptions) {
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal,
      // Send and accept the httpOnly session cookies.
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    // Let React Query see cancellations as cancellations.
    if (signal?.aborted) throw error
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.")
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  // The server sends { error: string, fields?: {...} }. Anything else (an HTML
  // error page from a proxy, an empty body) falls back to a generic message.
  const data = (await response.json().catch(() => null)) as {
    error?: unknown
    fields?: unknown
  } | null
  const message =
    typeof data?.error === 'string'
      ? data.error
      : response.status >= 500
        ? 'The server had a problem. Please try again.'
        : `Request failed (${response.status})`
  const fields = data?.fields && typeof data.fields === 'object' ? (data.fields as FieldErrors) : {}
  return new ApiError(response.status, message, fields)
}

/**
 * Calls the API and returns the parsed JSON body (undefined for 204 No
 * Content). Throws ApiError for any non-2xx response or network failure.
 *
 * On 401 it refreshes the session once and retries, so an expired access
 * token is invisible to callers. If the refresh also fails, the 401 is thrown
 * and the user has to log in again.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options)

  if (response.status === 401 && canRetryAfterRefresh(path) && (await refreshSession())) {
    response = await send(path, options)
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
