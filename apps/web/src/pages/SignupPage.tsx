import { MAX_FULL_NAME_LENGTH, MIN_PASSWORD_LENGTH, signupSchema } from '@collab/shared'
import { Loader2Icon } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AuthCard } from '@/components/auth/auth-card'
import { FormError } from '@/components/auth/form-error'
import { FormField } from '@/components/auth/form-field'
import { Button } from '@/components/ui/button'
import { useSignup } from '@/hooks/use-auth'
import { useZodForm } from '@/hooks/use-zod-form'
import { getErrorMessage, getFieldError } from '@/lib/api-client'
import { NEXT_PARAM, paths, safeNextPath, withNext } from '@/routes/paths'

export default function SignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get(NEXT_PARAM)
  const signup = useSignup()

  const form = useZodForm(
    signupSchema,
    { fullName: '', email: '', password: '' },
    // Editing after a failed attempt hides the old server message (e.g. the
    // "already exists" error once you change the email).
    { onChange: () => signup.error && signup.reset() },
  )

  const onSubmit = form.handleSubmit((data) => {
    signup.mutate(data, { onSuccess: () => navigate(safeNextPath(next), { replace: true }) })
  })

  // Client-side errors first; the server's per-field errors as a fallback.
  const fieldErrors = {
    fullName: form.errors.fullName ?? getFieldError(signup.error, 'fullName'),
    email: form.errors.email ?? getFieldError(signup.error, 'email'),
    password: form.errors.password ?? getFieldError(signup.error, 'password'),
  }
  const hasFieldError = Object.values(fieldErrors).some(Boolean)
  const formError = signup.error && !hasFieldError ? getErrorMessage(signup.error) : undefined

  return (
    <AuthCard
      title="Create an account"
      description="Save your documents and pick up where you left off on any device."
      footer={
        <>
          Already have an account?{' '}
          <Link to={withNext(paths.login, next)} className="font-medium text-foreground underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {/* noValidate: show the schema's messages instead of the browser's bubbles. */}
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormError message={formError} />

        <FormField
          label="Name"
          autoComplete="name"
          autoFocus
          required
          maxLength={MAX_FULL_NAME_LENGTH}
          value={form.values.fullName}
          onChange={(event) => form.setValue('fullName', event.target.value)}
          error={fieldErrors.fullName}
        />

        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.values.email}
          onChange={(event) => form.setValue('email', event.target.value)}
          error={fieldErrors.email}
        />

        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={form.values.password}
          onChange={(event) => form.setValue('password', event.target.value)}
          error={fieldErrors.password}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        />

        <Button type="submit" size="lg" className="mt-2" disabled={signup.isPending}>
          {signup.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {signup.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  )
}
