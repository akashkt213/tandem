import type { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider'
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { Identity } from './identity'
import { getCurrentProvider, subscribeToProvider } from './providerFactory'

/*
 * Presence is built on Yjs *awareness*: a small, non-persisted state object
 * per connected client, broadcast to everyone in the same document.
 * Lexical's CollaborationPlugin keeps ours as:
 *   { name, color, focusing, anchorPos, focusPos, awarenessData }
 * and draws remote cursors from everyone else's. We read the same states to
 * list who's here, and write `name`/`color` into ours when you rename yourself.
 */

/** The provider of the document that's open, or null before the editor creates one. */
export function useCollabProvider(): HocuspocusProvider | null {
  return useSyncExternalStore(subscribeToProvider, getCurrentProvider)
}

export type ConnectionStatus = `${WebSocketStatus}` // 'connecting' | 'connected' | 'disconnected'

export function useConnectionStatus(provider: HocuspocusProvider | null): ConnectionStatus {
  const subscribe = useCallback(
    (onChange: () => void) => {
      // The status lives on the socket; the provider forwards its 'status' events.
      provider?.on('status', onChange)
      return () => {
        provider?.off('status', onChange)
      }
    },
    [provider],
  )
  return useSyncExternalStore(
    subscribe,
    () => provider?.configuration.websocketProvider.status ?? 'connecting',
  )
}

export type PresenceUser = {
  /** Identity id when known (merges one person's tabs), else the Yjs client id. */
  key: string
  name: string
  color: string
  isSelf: boolean
  /** Whether any of this person's tabs has the editor focused. */
  focusing: boolean
}

type LexicalAwarenessState = {
  name?: unknown
  color?: unknown
  focusing?: unknown
  awarenessData?: { userId?: unknown }
}

function readUsers(provider: HocuspocusProvider, selfId: string): PresenceUser[] {
  const awareness = provider.awareness
  if (!awareness) return []

  const byKey = new Map<string, PresenceUser>()
  for (const [clientId, raw] of awareness.getStates()) {
    const state = raw as LexicalAwarenessState
    // A client's state is {} until Lexical initialises it; skip those.
    if (typeof state.name !== 'string' || typeof state.color !== 'string') continue

    const userId = typeof state.awarenessData?.userId === 'string' ? state.awarenessData.userId : null
    const key = userId ?? `client-${clientId}`
    const isSelf = clientId === awareness.clientID || userId === selfId
    const existing = byKey.get(key)

    // Same person in several tabs: one entry, preferring this tab's own state.
    if (!existing || clientId === awareness.clientID) {
      byKey.set(key, {
        key,
        name: state.name,
        color: state.color,
        isSelf,
        focusing: state.focusing === true || (existing?.focusing ?? false),
      })
    } else if (state.focusing === true) {
      existing.focusing = true
    }
  }

  // You first, then everyone else by name.
  return [...byKey.values()].sort(
    (a, b) => Number(b.isSelf) - Number(a.isSelf) || a.name.localeCompare(b.name),
  )
}

/**
 * Everyone connected to the document, including you. When the connection drops,
 * Hocuspocus clears the other clients' states, so offline this lists only you.
 */
export function useConnectedUsers(provider: HocuspocusProvider | null, selfId: string): PresenceUser[] {
  const store = useMemo(() => createUsersStore(provider, selfId), [provider, selfId])
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

/** A tiny external store over the awareness states, for useSyncExternalStore. */
function createUsersStore(provider: HocuspocusProvider | null, selfId: string) {
  let users = provider ? readUsers(provider, selfId) : []
  let lastKey = JSON.stringify(users)

  return {
    getSnapshot: () => users,
    subscribe(onChange: () => void) {
      const awareness = provider?.awareness
      if (!provider || !awareness) return () => {}

      // 'change' fires whenever any state changes, including every cursor move.
      // Only hand React a new array when the list itself is different.
      const update = () => {
        const next = readUsers(provider, selfId)
        const key = JSON.stringify(next)
        if (key !== lastKey) {
          lastKey = key
          users = next
          onChange()
        }
      }
      awareness.on('change', update)
      update() // catch anything that changed before we subscribed
      return () => awareness.off('change', update)
    },
  }
}

/**
 * Keeps our awareness state's name/color/userId equal to the identity, so a
 * rename shows up on other people's screens straight away.
 *
 * Why not just pass the new name to <CollaborationPlugin username>? In Lexical
 * 0.53, a changed username re-runs the plugin's provider effect: it disconnects
 * and reconnects, and the disconnect is queued behind a promise, so it can land
 * *after* the reconnect and leave the editor offline. Instead the plugin gets the
 * name once at mount, and later changes are written to awareness here. Lexical
 * reads name/color back from the awareness state when it updates your cursor
 * (and redraws remote cursor labels when theirs change), so this is enough.
 */
export function useSyncIdentityToAwareness(provider: HocuspocusProvider | null, identity: Identity) {
  useEffect(() => {
    const awareness = provider?.awareness
    if (!awareness) return

    const apply = () => {
      const state = awareness.getLocalState() as LexicalAwarenessState | null
      // null = we've left (tab closing / provider destroyed); don't resurrect it.
      if (state === null) return
      if (state.name !== identity.name) awareness.setLocalStateField('name', identity.name)
      if (state.color !== identity.color) awareness.setLocalStateField('color', identity.color)
      if (state.awarenessData?.userId !== identity.id) {
        awareness.setLocalStateField('awarenessData', { ...state.awarenessData, userId: identity.id })
      }
    }

    apply()
    // Re-apply if Lexical resets our state (it does on (re)connect, with the
    // name it was given at mount). Each fix is a no-op the second time round.
    awareness.on('change', apply)
    return () => awareness.off('change', apply)
  }, [provider, identity])
}
