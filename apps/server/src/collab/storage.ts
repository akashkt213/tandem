import * as Y from 'yjs'
import { pool } from '../db'
import type { CollabContext } from './access'

// Persists Yjs documents in documents.ydoc_state.
//
// The column holds the whole document as one Yjs update
// (Y.encodeStateAsUpdate). Loading applies it to a fresh Y.Doc; saving
// overwrites it. Yjs merges deterministically, so this round-trips exactly,
// including the edit history it needs to merge with clients that were offline.
//
// The row itself is created earlier, in onAuthenticate (see resolveAccess).

/** Fills `document` with its saved state, if anything has been saved yet. */
export async function loadDocument(documentName: string, document: Y.Doc): Promise<void> {
  const { rows } = await pool.query<{ ydoc_state: Buffer | null }>(
    `select ydoc_state from documents where id = $1`,
    [documentName],
  )
  // null: the row exists but nothing has been saved yet (opened, never edited).
  const state = rows[0]?.ydoc_state
  if (state) Y.applyUpdate(document, state)
}

/**
 * Writes the document's current state. Hocuspocus calls this debounced after
 * edits (see `debounce` / `maxDebounce` in ./index.ts) and when the last
 * person leaves.
 *
 * `lastEditor` is whoever made the latest change; a guest is stored as null.
 */
export async function storeDocument(
  documentName: string,
  document: Y.Doc,
  lastEditor: CollabContext | undefined,
): Promise<void> {
  const state = Buffer.from(Y.encodeStateAsUpdate(document))
  const result = await pool.query(
    `update documents
     set ydoc_state = $2, updated_at = now(), last_edited_by = $3
     where id = $1`,
    [documentName, state, lastEditor?.userId ?? null],
  )
  if (result.rowCount === 0) {
    // The row is created when the first connection is accepted. Saying so
    // loudly is better than silently dropping edits.
    console.error(`onStoreDocument: no documents row for "${documentName}"; changes not saved`)
  }
}
