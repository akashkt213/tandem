import { CheckIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { MAX_NAME_LENGTH, updateIdentity, useIdentity, USER_COLORS } from '@/collab/identity'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type NameDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Pick the name and colour others see on your cursor and in the presence list. */
export function NameDialog({ open, onOpenChange }: NameDialogProps) {
  const identity = useIdentity()

  const handleOpenChange = (next: boolean) => {
    // Closing the first-visit prompt without saving keeps the suggested name;
    // don't ask again. (You can still change it from the header.)
    if (!next && !identity.confirmed) updateIdentity({ confirmed: true })
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Rendered only while open, so the form starts from the saved identity each time. */}
        <NameForm onDone={() => handleOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function NameForm({ onDone }: { onDone: () => void }) {
  const identity = useIdentity()
  const [name, setName] = useState(identity.name)
  const [color, setColor] = useState(identity.color)
  const inputId = useId()
  const trimmed = name.trim()

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!trimmed) return
    updateIdentity({ name: trimmed, color, confirmed: true })
    onDone()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <DialogHeader>
        <DialogTitle>{identity.confirmed ? 'Edit your profile' : 'What should we call you?'}</DialogTitle>
        <DialogDescription>
          Shown on your cursor and in the list of people viewing a document. Saved in this
          browser only.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-3 rounded-lg border p-3">
        <UserAvatar name={trimmed || '?'} color={color} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{trimmed || 'Your name'}</p>
          <p className="text-xs text-muted-foreground">This is how others see you</p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={inputId}>Name</Label>
        <Input
          id={inputId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="nickname"
          autoFocus
          required
        />
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm leading-none font-medium">Colour</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cursor colour">
          {USER_COLORS.map((swatch) => {
            const selected = swatch === color
            return (
              <button
                key={swatch}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={swatch}
                onClick={() => setColor(swatch)}
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-white outline-none transition-shadow',
                  'focus-visible:ring-3 focus-visible:ring-ring/50',
                  selected && 'ring-2 ring-foreground ring-offset-2 ring-offset-background',
                )}
                style={{ backgroundColor: swatch }}
              >
                {selected && <CheckIcon className="size-4" />}
              </button>
            )
          })}
        </div>
      </fieldset>

      <DialogFooter>
        <Button type="submit" disabled={!trimmed}>
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}
