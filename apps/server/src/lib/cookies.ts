/**
 * Parses a Cookie request header ("a=1; b=2") into an object.
 *
 * Express routes get this from cookie-parser, but the collab server reads the
 * raw WebSocket handshake headers, so it needs its own. Malformed pairs are
 * skipped; the first occurrence of a name wins (like browsers and cookie-parser).
 */
export function parseCookies(header: string | null | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!header) return cookies

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=')
    if (separator === -1) continue
    const name = pair.slice(0, separator).trim()
    if (!name || name in cookies) continue
    let value = pair.slice(separator + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    try {
      cookies[name] = decodeURIComponent(value)
    } catch {
      cookies[name] = value // not percent-encoded; use as-is
    }
  }
  return cookies
}
