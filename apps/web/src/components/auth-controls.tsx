import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { MAX_NAME_LENGTH, getIdentity, updateIdentity } from '@/collab/identity'
import { IdentityButton } from '@/components/identity-button'
import { UserMenu } from '@/components/user-menu'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-auth'
import { paths, withNext } from '@/routes/paths'

/**
 * Right side of the header. Signed in: the account menu. Guest: the
 * name/colour button (what others see on your cursor) plus log in / sign up.
 */
export function AuthControls() {
  const { user, isLoading } = useCurrentUser()
  const location = useLocation()

  // While signed in, collaborators see your account name and colour on your
  // cursor and in the presence list, not the random guest name.
  useEffect(() => {
    if (!user) return
    const name = user.fullName.slice(0, MAX_NAME_LENGTH)
    const current = getIdentity()
    if (current.name !== name || current.color !== user.color || !current.confirmed) {
      updateIdentity({ name, color: user.color, confirmed: true })
    }
  }, [user])

  // Nothing until we know, so the header doesn't flash "Log in" for a
  // signed-in user on every page load.
  if (isLoading) return null

  if (user) return <UserMenu user={user} />

  // Come back to this page after logging in (e.g. the document you were on).
  const here = location.pathname + location.search
  return (
    <>
      <IdentityButton />
      <Button asChild variant="ghost" size="sm">
        <Link to={withNext(paths.login, here)}>Log in</Link>
      </Button>
      <Button asChild size="sm">
        <Link to={withNext(paths.signup, here)}>Sign up</Link>
      </Button>
    </>
  )
}
