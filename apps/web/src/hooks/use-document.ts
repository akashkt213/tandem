import type { UpdateDocumentInput } from '@collab/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentKeys, fetchDocument, updateDocument } from '@/api/documents'

/**
 * A document's info and sharing settings, including whether you own it.
 *
 * Pass `enabled: false` until the editor's connection has been accepted: a
 * brand-new document's row is created when it is, so asking earlier would 404.
 */
export function useDocument(id: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: ({ signal }) => fetchDocument(id, signal),
    enabled,
  })
}

/** Changes sharing settings. Owner only; the server rejects anyone else. */
export function useUpdateDocument(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateDocumentInput) => updateDocument(id, input),
    onSuccess: (document) => {
      queryClient.setQueryData(documentKeys.detail(id), document)
    },
  })
}
