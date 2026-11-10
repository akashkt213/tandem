import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import type { FieldErrors } from '@/lib/api-client'

type UseZodFormOptions = {
  /** Called whenever a field changes, e.g. to clear a stale server error. */
  onChange?: () => void
}

/**
 * Form state validated with a Zod schema.
 *
 * - On submit, the values are checked first. If anything is invalid, the
 *   errors are shown and `onValid` is NOT called, so no request is sent.
 * - After the first submit attempt, each change re-validates, so an error
 *   disappears as soon as the user fixes it (but nothing turns red while
 *   they're still typing for the first time).
 * - `onValid` receives the schema's parsed output (e.g. trimmed, lowercased email).
 */
export function useZodForm<Values extends Record<string, string>, Output>(
  schema: z.ZodType<Output, Values>,
  initialValues: Values,
  { onChange }: UseZodFormOptions = {},
) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const validate = (next: Values): { data: Output } | { errors: FieldErrors } => {
    const result = schema.safeParse(next)
    if (result.success) return { data: result.data }
    return { errors: z.flattenError(result.error).fieldErrors as FieldErrors }
  }

  const setValue = (field: keyof Values, value: string) => {
    const next = { ...values, [field]: value }
    setValues(next)
    if (submitAttempted) {
      const result = validate(next)
      setErrors('errors' in result ? result.errors : {})
    }
    onChange?.()
  }

  const handleSubmit = (onValid: (data: Output) => void) => (event: FormEvent) => {
    event.preventDefault()
    setSubmitAttempted(true)
    const result = validate(values)
    if ('errors' in result) {
      setErrors(result.errors)
      return // invalid: stop here, nothing is sent
    }
    setErrors({})
    onValid(result.data)
  }

  return {
    values,
    setValue,
    /** First message per field, e.g. errors.email. */
    errors: Object.fromEntries(
      Object.entries(errors).map(([field, messages]) => [field, messages?.[0]]),
    ) as Partial<Record<keyof Values, string>>,
    hasErrors: Object.keys(errors).length > 0,
    handleSubmit,
  }
}
