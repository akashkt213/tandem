import { CircleAlertIcon } from 'lucide-react'

/** A form-level error (wrong password, server down), announced to screen readers. */
export function FormError({ message }: { message: string | undefined }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
