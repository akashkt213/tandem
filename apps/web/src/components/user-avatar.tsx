import { Avatar, AvatarFallback } from '@/components/ui/avatar'

/** "Swift Otter" → "SO", "ana" → "A". */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0]![0], words.at(-1)![0]] : [words[0]?.[0]]
  return letters.join('').toUpperCase() || '?'
}

type UserAvatarProps = {
  name: string
  color: string
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

/** shadcn Avatar showing the user's initials on their cursor colour. */
export function UserAvatar({ name, color, size = 'default', className }: UserAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback
        className="font-medium text-white"
        style={{ backgroundColor: color }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
