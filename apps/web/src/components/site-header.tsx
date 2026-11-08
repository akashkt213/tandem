import { FileTextIcon } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import { IdentityButton } from '@/components/identity-button'
import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 md:px-6">
        <Button asChild variant="ghost" size="sm" className="gap-2 px-2">
          <Link to="/">
            <FileTextIcon />
            <span className="font-semibold">Collab Editor</span>
          </Link>
        </Button>

        <nav className="hidden items-center gap-0.5 sm:flex">
          <Button asChild variant="ghost" size="sm">
            <NavLink
              to="/"
              end
              className="text-muted-foreground aria-[current=page]:text-foreground"
            >
              Home
            </NavLink>
          </Button>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <IdentityButton />
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
