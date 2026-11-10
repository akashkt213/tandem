import { useId, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FormFieldProps = ComponentProps<typeof Input> & {
  label: string
  /** Validation message; marks the input invalid and is read out by screen readers. */
  error?: string
  /** Help text shown under the input when there's no error. */
  hint?: string
}

/** Label + input + error/hint, wired together for accessibility. */
export function FormField({ label, error, hint, id, ...inputProps }: FormFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const messageId = `${inputId}-message`
  const message = error ?? hint

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        {...inputProps}
      />
      {message && (
        <p
          id={messageId}
          className={error ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'}
        >
          {message}
        </p>
      )}
    </div>
  )
}
