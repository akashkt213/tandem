import type { DocumentInfo, UpdateDocumentInput } from '@collab/shared'
import { apiRequest } from '@/lib/api-client'
import { ensureFreshSession } from '@/lib/session'

// Plain functions for /api/documents. Components use the hooks in
// '@/hooks/use-document', which add caching.

type DocumentResponse = { document: DocumentInfo }

/** React Query cache keys for documents. */
export const documentKeys = {
  all: ['documents'] as const,
  detail: (id: string) => ['documents', id] as const,
}

// Whether you're the owner depends on who you are, and guests may call these
// too (so an expired session isn't a 401, just "guest"). Refresh first.

export async function fetchDocument(id: string, signal?: AbortSignal): Promise<DocumentInfo> {
  await ensureFreshSession()
  const { document } = await apiRequest<DocumentResponse>(
    `/documents/${encodeURIComponent(id)}`,
    { signal },
  )
  return document
}

export async function updateDocument(id: string, input: UpdateDocumentInput): Promise<DocumentInfo> {
  await ensureFreshSession()
  const { document } = await apiRequest<DocumentResponse>(`/documents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
  })
  return document
}
