import type { ReactNode } from 'react'

type AuthCardProps = {
  title: string
  description: string
  children: ReactNode
  /** Shown under the card, e.g. "Don't have an account? Sign up". */
  footer: ReactNode
}

/** Centered card layout shared by the login and signup pages. */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <section className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
          <div className="mb-6 grid gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </section>
  )
}
