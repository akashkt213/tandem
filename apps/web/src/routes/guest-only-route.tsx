import { Navigate, Outlet, useSearchParams } from 'react-router'
import { useCurrentUser } from '@/hooks/use-auth'
import { NEXT_PARAM, safeNextPath } from '@/routes/paths'

/**
 * Wraps pages only logged-out visitors should see (login, signup). A signed-in
 * user is sent on to where they were going, or home.
 */
export function GuestOnlyRoute() {
  const { user, isLoading } = useCurrentUser()
  const [searchParams] = useSearchParams()

  // Render nothing for the brief moment we're checking, instead of flashing
  // the form at someone who is already logged in.
  if (isLoading) return null
  if (user) return <Navigate to={safeNextPath(searchParams.get(NEXT_PARAM))} replace />
  return <Outlet />
}
