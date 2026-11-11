import { updateDocumentSchema, type DocumentInfo } from '@collab/shared'
import express, { type Request } from 'express'
import { z } from 'zod'
import { pool } from '../db'
import { identityFromCookies, type Identity } from '../auth/identity'
import { disconnectNonOwners } from '../collab'
import {
  accessFor,
  findDocument,
  isOwner,
  isValidDocumentId,
  type DocumentRow,
} from './permissions'

// /api/documents: information about a document and its sharing settings.
// Who you are comes from the same cookies the editor's WebSocket sends
// (session or guest), and the rules are the same ones the collab server uses.

export const documentsRouter = express.Router()

function identity(req: Request): Identity {
  return identityFromCookies(req.cookies ?? {})
}

function toDocumentInfo(doc: DocumentRow, who: Identity): DocumentInfo {
  return {
    id: doc.id,
    title: doc.title,
    linkAccess: doc.link_access,
    isOwner: isOwner(doc, who),
    createdAt: doc.created_at.toISOString(),
    updatedAt: doc.updated_at.toISOString(),
  }
}

/**
 * Loads the document named in the URL, or sends 404 and returns null.
 * Deleted documents and malformed ids are "not found" too.
 */
async function loadFromParams(req: Request<{ id: string }>, res: express.Response) {
  const doc = isValidDocumentId(req.params.id) ? await findDocument(req.params.id) : undefined
  if (!doc || doc.deleted_at) {
    res.status(404).json({ error: 'Document not found' })
    return null
  }
  return doc
}

// Anyone who may open the document (owner, or anyone with the link unless
// sharing is off) can read its info.
documentsRouter.get('/:id', async (req, res) => {
  const doc = await loadFromParams(req, res)
  if (!doc) return
  const who = identity(req)
  if (!accessFor(doc, who)) {
    res.status(403).json({ error: "You don't have access to this document" })
    return
  }
  res.json({ document: toDocumentInfo(doc, who) })
})

// Only the owner can change sharing.
documentsRouter.patch('/:id', async (req, res) => {
  const doc = await loadFromParams(req, res)
  if (!doc) return
  const who = identity(req)
  if (!isOwner(doc, who)) {
    res.status(403).json({ error: 'Only the owner can change sharing' })
    return
  }

  const parsed = updateDocumentSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', fields: z.flattenError(parsed.error).fieldErrors })
    return
  }

  const { rows } = await pool.query<DocumentRow>(
    `update documents set link_access = $2, updated_at = now()
     where id = $1
     returning id, title, owner_id, guest_owner_id, link_access, deleted_at, created_at, updated_at`,
    [doc.id, parsed.data.linkAccess],
  )
  const updated = rows[0]!

  // Apply the change to people who have the document open right now, not
  // just to the next person who opens it.
  if (updated.link_access !== doc.link_access) disconnectNonOwners(updated.id, updated)

  res.json({ document: toDocumentInfo(updated, who) })
})
