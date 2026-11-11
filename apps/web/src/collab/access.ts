import type { HocuspocusProvider } from '@hocuspocus/provider'
import { useSyncExternalStore } from 'react'

/**
 * What the collab server decided for this connection (onAuthenticate):
 * - connecting: no answer yet
 * - edit / view: allowed; `view` is a read-only connection
 * - denied: rejected; `reason` says why
 */
export type CollabAccess =
  | { state: 'connecting' }
  | { state: 'edit' }
  | { state: 'view' }
  | { state: 'denied'; reason: string }

const CONNECTING: CollabAccess = { state: 'connecting' }
const EDIT: CollabAccess = { state: 'edit' }
const VIEW: CollabAccess = { state: 'view' }

const accessByProvider = new WeakMap<HocuspocusProvider, CollabAccess>()
const listeners = new Set<() => void>()

function set(provider: HocuspocusProvider, access: CollabAccess) {
  accessByProvider.set(provider, access)
  for (const listener of listeners) listener()
}

/**
 * Records the server's answers for a provider. Call before it connects (the
 * provider factory does), so the first answer isn't missed.
 *
 * It re-authenticates on every reconnect, so the answer can change (e.g. the
 * owner switched the link to view-only). A disconnect doesn't reset it: you
 * can keep editing offline and changes sync when you're back.
 */
export function trackAccess(provider: HocuspocusProvider) {
  accessByProvider.set(provider, CONNECTING)
  provider.on('authenticated', ({ scope }: { scope: string }) => {
    set(provider, scope === 'readonly' ? VIEW : EDIT)
  })
  provider.on('authenticationFailed', ({ reason }: { reason: string }) => {
    set(provider, { state: 'denied', reason })
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Access for document `docId` over `provider`. Reports `connecting` while
 * the provider still belongs to a previous document, so a stale answer from
 * the last page never shows on this one.
 */
export function useCollabAccess(provider: HocuspocusProvider | null, docId: string): CollabAccess {
  return useSyncExternalStore(subscribe, () => {
    if (!provider || provider.configuration.name !== docId) return CONNECTING
    return accessByProvider.get(provider) ?? CONNECTING
  })
}
