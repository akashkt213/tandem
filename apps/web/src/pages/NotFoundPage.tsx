import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-2 px-4 py-20 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">This page doesn't exist.</p>
      <Button asChild size="sm" variant="outline" className="mt-2">
        <Link to="/">Go home</Link>
      </Button>
    </section>
  )
}
