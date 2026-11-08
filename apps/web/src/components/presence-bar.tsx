import { useIdentity } from '@/collab/identity'
import {
  useCollabProvider,
  useConnectedUsers,
  useConnectionStatus,
  type ConnectionStatus,
} from '@/collab/presence'
import { UserAvatar } from '@/components/user-avatar'
import { AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const MAX_AVATARS = 4

const STATUS: Record<ConnectionStatus, { label: string; dot: string }> = {
  connected: { label: 'Connected', dot: 'bg-emerald-500' },
  connecting: { label: 'Connecting…', dot: 'bg-amber-500 animate-pulse' },
  disconnected: { label: 'Offline', dot: 'bg-muted-foreground' },
}

/** Connection status plus the people currently in this document. */
export function PresenceBar() {
  const identity = useIdentity()
  const provider = useCollabProvider()
  const status = useConnectionStatus(provider)
  const users = useConnectedUsers(provider, identity.id)

  const shown = users.slice(0, MAX_AVATARS)
  const hidden = users.slice(MAX_AVATARS)
  const { label, dot } = STATUS[status]

  return (
    <div className="flex items-center gap-3">
      <Badge variant="outline" className="gap-1.5 text-muted-foreground" aria-live="polite">
        <span className={cn('size-1.5 rounded-full', dot)} aria-hidden />
        {label}
      </Badge>

      {users.length > 0 && (
        <AvatarGroup role="group" aria-label={`${users.length} ${users.length === 1 ? 'person' : 'people'} here`}>
          {shown.map((user) => (
            <Tooltip key={user.key}>
              <TooltipTrigger asChild>
                {/* A focusable wrapper so keyboard users can read the tooltip too. */}
                <span tabIndex={0} className="flex rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <UserAvatar
                    name={user.name}
                    color={user.color}
                    className="ring-2 ring-background"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {user.name}
                {user.isSelf && ' (you)'}
                {!user.isSelf && user.focusing && ' · editing'}
              </TooltipContent>
            </Tooltip>
          ))}
          {hidden.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AvatarGroupCount tabIndex={0} className="text-xs">+{hidden.length}</AvatarGroupCount>
              </TooltipTrigger>
              <TooltipContent>{hidden.map((user) => user.name).join(', ')}</TooltipContent>
            </Tooltip>
          )}
        </AvatarGroup>
      )}
    </div>
  )
}
