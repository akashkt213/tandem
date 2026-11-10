import type { PublicUser } from '@collab/shared'
import { Loader2Icon, LogOutIcon } from 'lucide-react'
import { useState } from 'react'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { useLogout } from '@/hooks/use-auth'

/** Header button for a signed-in user: shows who you are and lets you log out. */
export function UserMenu({ user }: { user: PublicUser }) {
  const [open, setOpen] = useState(false)
  const logout = useLogout()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-1.5" aria-label={`Account: ${user.fullName}`}>
          <UserAvatar name={user.fullName} color={user.color} size="sm" />
          <span className="hidden max-w-32 truncate sm:inline">{user.fullName}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="flex items-center gap-3 p-3">
          <UserAvatar name={user.fullName} color={user.color} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Separator />
        <div className="p-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSettled: () => setOpen(false) })}
          >
            {logout.isPending ? (
              <Loader2Icon className="animate-spin" data-icon="inline-start" />
            ) : (
              <LogOutIcon data-icon="inline-start" />
            )}
            Log out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
