import type { DocumentInfo, LinkAccess } from '@collab/shared'
import { CheckIcon, GlobeIcon, LinkIcon, Loader2Icon, LockIcon, Share2Icon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { FormError } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUpdateDocument } from '@/hooks/use-document'
import { getErrorMessage } from '@/lib/api-client'
import { paths } from '@/routes/paths'

const OPTIONS: Record<LinkAccess, { label: string; description: string }> = {
  editor: {
    label: 'Anyone with the link can edit',
    description: 'Anyone who has the link can open and edit this document.',
  },
  viewer: {
    label: 'Anyone with the link can view',
    description: 'Anyone who has the link can read it, but only you can edit.',
  },
  none: {
    label: 'Restricted',
    description: 'Only you can open this document. Others with the link see “no access”.',
  },
}

/** Owner-only: choose who can open the link, and copy it. */
export function ShareDialog({ document }: { document: DocumentInfo }) {
  const [open, setOpen] = useState(false)
  const update = useUpdateDocument(document.id)
  const selectId = useId()
  const restricted = document.linkAccess === 'none'

  const onChange = (value: string) => {
    if (value === document.linkAccess) return
    update.mutate({ linkAccess: value as LinkAccess })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) update.reset() // don't show an old error next time
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Share2Icon data-icon="inline-start" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share “{document.title}”</DialogTitle>
          <DialogDescription>
            Choose what people who have the link can do. You can always edit.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <FormError message={update.error ? getErrorMessage(update.error) : undefined} />

          <label htmlFor={selectId} className="text-sm font-medium">
            General access
          </label>
          <div className="flex items-start gap-3">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              aria-hidden
            >
              {restricted ? <LockIcon className="size-4" /> : <GlobeIcon className="size-4" />}
            </div>
            <div className="grid min-w-0 flex-1 gap-1">
              <Select
                value={document.linkAccess}
                onValueChange={onChange}
                disabled={update.isPending}
              >
                <SelectTrigger id={selectId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {(Object.keys(OPTIONS) as LinkAccess[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {OPTIONS[value].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                {update.isPending ? (
                  <>
                    <Loader2Icon className="size-3 animate-spin" />
                    Saving…
                  </>
                ) : (
                  OPTIONS[document.linkAccess].description
                )}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <CopyLinkButton documentId={document.id} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CopyLinkButton({ documentId }: { documentId: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    const url = new URL(paths.doc(documentId), window.location.origin).toString()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Clipboard blocked (permissions, insecure context): let them copy it by hand.
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <Button variant="outline" onClick={copy}>
      {copied ? <CheckIcon data-icon="inline-start" /> : <LinkIcon data-icon="inline-start" />}
      {copied ? 'Link copied' : 'Copy link'}
    </Button>
  )
}
