import { useState } from 'react'
import { useIdentity } from '@/collab/identity'
import { NameDialog } from '@/components/name-dialog'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'

/** Header button showing who you are; opens the dialog to change name and colour. */
export function IdentityButton() {
  const identity = useIdentity()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 px-1.5"
        onClick={() => setOpen(true)}
        aria-label={`You appear as ${identity.name}. Change name`}
        title="Change name and colour"
      >
        <UserAvatar name={identity.name} color={identity.color} size="sm" />
        <span className="hidden max-w-32 truncate sm:inline">{identity.name}</span>
      </Button>
      <NameDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
