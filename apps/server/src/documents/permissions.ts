import type { LinkAccess } from '@collab/shared'
import { pool } from '../db'
import type { Identity } from '../auth/identity'

// Who may do what with a document. The single source of these rules: the
// collab server (opening the editor) and the HTTP API (reading info, changing
// sharing) both use them.

export type DocumentAccess = 'edit' | 'view'

export type DocumentRow = {
  id: string
  title: string
  owner_id: string | null
  guest_owner_id: string | null
  link_access: LinkAccess
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
}

const DOCUMENT_COLUMNS =
  'id, title, owner_id, guest_owner_id, link_access, deleted_at, created_at, updated_at'

// Document ids come from the URL (/doc/:id). The app makes 8-character ids;
// allow a bit more, but nothing that could fill the table with junk names.
const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export function isValidDocumentId(id: string): boolean {
  return DOCUMENT_ID_PATTERN.test(id)
}

export async function findDocument(id: string): Promise<DocumentRow | undefined> {
  const { rows } = await pool.query<DocumentRow>(
    `select ${DOCUMENT_COLUMNS} from documents where id = $1`,
    [id],
  )
  return rows[0]
}

/**
 * Creates the document with `creator` as owner if it doesn't exist yet, and
 * returns the row either way. Exactly one owner column is set (the
 * documents_one_owner constraint): the user, or else the guest.
 *
 * `on conflict do nothing`: if two people open a brand-new link at the same
 * moment, the first insert wins and the second just reads that row.
 */
export async function findOrCreateDocument(id: string, creator: Identity): Promise<DocumentRow> {
  await pool.query(
    `insert into documents (id, owner_id, guest_owner_id)
     values ($1, $2, $3)
     on conflict (id) do nothing`,
    [id, creator.userId, creator.userId ? null : creator.guestHash],
  )
  return (await findDocument(id))!
}

export function isOwner(doc: Pick<DocumentRow, 'owner_id' | 'guest_owner_id'>, who: Identity): boolean {
  return (
    (who.userId !== null && doc.owner_id === who.userId) ||
    (who.guestHash !== null && doc.guest_owner_id === who.guestHash)
  )
}

/**
 * What `who` may do with an existing document, or null for nothing.
 *
 *   deleted                → nothing
 *   owner (user or guest)  → edit
 *   link_access = editor   → edit
 *   link_access = viewer   → view
 *   link_access = none     → nothing
 */
export function accessFor(doc: DocumentRow, who: Identity): DocumentAccess | null {
  if (doc.deleted_at) return null
  if (isOwner(doc, who)) return 'edit'
  switch (doc.link_access) {
    case 'editor':
      return 'edit'
    case 'viewer':
      return 'view'
    case 'none':
      return null
  }
}
