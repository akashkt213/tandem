import { loginSchema } from '@collab/shared'
import { Loader2Icon } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AuthCard } from '@/components/auth/auth-card'
import { FormError } from '@/components/auth/form-error'
import { FormField } from '@/components/auth/form-field'
import { Button } from '@/components/ui/button'
import { useLogin } from '@/hooks/use-auth'
import { useZodForm } from '@/hooks/use-zod-form'
import { getErrorMessage, getFieldError } from '@/lib/api-client'
import { NEXT_PARAM, paths, safeNextPath, withNext } from '@/routes/paths'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get(NEXT_PARAM)
  const login = useLogin()

  const form = useZodForm(
    loginSchema,
    { email: '', password: '' },
    // Editing after a failed attempt hides the old server message.
    { onChange: () => login.error && login.reset() },
  )

  const onSubmit = form.handleSubmit((data) => {
    login.mutate(data, { onSuccess: () => navigate(safeNextPath(next), { replace: true }) })
  })

  // Client-side errors first; the server's per-field errors as a fallback.
  const emailError = form.errors.email ?? getFieldError(login.error, 'email')
  const passwordError = form.errors.password ?? getFieldError(login.error, 'password')
  // Anything not tied to a field (wrong password, too many attempts, server
  // down) goes in the banner.
  const formError =
    login.error && !emailError && !passwordError ? getErrorMessage(login.error) : undefined

  return (
    <AuthCard
      title="Log in"
      description="Welcome back. Log in to keep your documents."
      footer={
        <>
          Don't have an account?{' '}
          <Link to={withNext(paths.signup, next)} className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      {/* noValidate: show the schema's messages instead of the browser's bubbles. */}
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormError message={formError} />

        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          value={form.values.email}
          onChange={(event) => form.setValue('email', event.target.value)}
          error={emailError}
        />

        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={form.values.password}
          onChange={(event) => form.setValue('password', event.target.value)}
          error={passwordError}
        />

        <Button type="submit" size="lg" className="mt-2" disabled={login.isPending}>
          {login.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthCard>
  )
}
