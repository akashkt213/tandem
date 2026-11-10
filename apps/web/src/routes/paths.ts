// Every URL in the app, in one place. Link to pages with these instead of
// writing strings, so renaming a route is a one-line change.

export const paths = {
  home: '/',
  login: '/login',
  signup: '/signup',
  /** Route pattern for <Route path>. */
  docPattern: '/doc/:id',
  doc: (id: string) => `/doc/${encodeURIComponent(id)}`,
} as const

/** Query parameter holding where to go after logging in, e.g. /login?next=/doc/abc */
export const NEXT_PARAM = 'next'

/**
 * The page to return to after login. Only same-site paths are allowed, so a
 * crafted link like /login?next=https://evil.example can't send the user to
 * another site (an open redirect).
 */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return paths.home
  }
  // Don't bounce back to the login or signup page itself.
  if (next.startsWith(paths.login) || next.startsWith(paths.signup)) return paths.home
  return next
}

/** e.g. withNext('/login', '/doc/abc') → '/login?next=%2Fdoc%2Fabc' */
export function withNext(path: string, next: string | null): string {
  if (!next || next === paths.home) return path
  return `${path}?${new URLSearchParams({ [NEXT_PARAM]: next })}`
}
