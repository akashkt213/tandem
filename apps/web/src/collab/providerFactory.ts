import { COLLAB_URL } from '@collab/shared'
import { HocuspocusProvider } from '@hocuspocus/provider'
import type { Provider } from '@lexical/yjs'
import * as Y from 'yjs'

/**
 * HocuspocusProvider, adapted to the provider interface Lexical's
 * CollaborationPlugin expects.
 *
 * The one real mismatch (checked against the 4.8 / 0.53 sources):
 * - Lexical listens for `provider.on('sync', (isSynced: boolean) => …)`. It uses
 *   this to bootstrap an empty document once the initial sync is done.
 * - Hocuspocus never emits 'sync'. It emits 'synced' with `{ state: boolean }`.
 *
 * Without the translation below, Lexical never learns the document has loaded,
 * and `shouldBootstrap` never inserts the first paragraph. Hocuspocus's `emit`
 * is protected, so rather than re-emitting we translate the subscription:
 * on('sync', fn) becomes on('synced', ({ state }) => fn(state)).
 *
 * Everything else lines up: 'status' carries `{ status: 'connected' | … }` in both,
 * and `awareness` is a regular y-protocols Awareness.
 */
class LexicalHocuspocusProvider extends HocuspocusProvider {
  // Lexical callback → our wrapper, so off('sync', fn) can find what to remove.
  // (Initialized lazily: the base constructor calls this.on() before class
  // fields of a subclass are set up.)
  private syncListeners?: Map<Function, Function>

  override on(event: string, fn: Function): this {
    if (event === 'sync') {
      const wrapper = ({ state }: { state: boolean }) => fn(state)
      ;(this.syncListeners ??= new Map()).set(fn, wrapper)
      return super.on('synced', wrapper)
    }
    return super.on(event, fn)
  }

  override off(event: string, fn?: Function): this {
    if (event === 'sync') {
      if (fn) {
        const wrapper = this.syncListeners?.get(fn)
        this.syncListeners?.delete(fn)
        // No wrapper means fn was never registered: nothing to remove. Don't call
        // super.off('synced') without a function, which would remove *all*
        // 'synced' listeners, including Hocuspocus's own.
        return wrapper ? super.off('synced', wrapper) : this
      }
      for (const wrapper of this.syncListeners?.values() ?? []) super.off('synced', wrapper)
      this.syncListeners?.clear()
      return this
    }
    return super.off(event, fn)
  }
}

// The provider currently in use. Lexical calls disconnect() when an editor
// unmounts but never destroy(), which would leave the old provider's Y.Doc and
// awareness timer behind. We destroy the previous provider when the next one is
// created (i.e. when you open another document).
//
// Why not destroy it in a React effect cleanup? In StrictMode (dev), React runs
// cleanups and then re-runs effects on the same component. CollaborationPlugin
// deliberately does *not* call the factory again on that re-run, so it would keep
// using a provider we had just destroyed.
let currentProvider: HocuspocusProvider | null = null

/**
 * The providerFactory passed to <CollaborationPlugin>. Module-level, so its
 * identity is stable: the plugin replaces its provider whenever the factory
 * changes identity.
 *
 * Lexical calls this once per editor with the document id from the URL.
 */
export function createProvider(id: string, yjsDocMap: Map<string, Y.Doc>): Provider {
  currentProvider?.destroy()

  // Lexical reads the document from this map right after calling the factory,
  // so we must create it and put it there ourselves.
  const doc = new Y.Doc()
  yjsDocMap.set(id, doc)

  const config = {
    url: COLLAB_URL,
    name: id, // Hocuspocus document name = the :id in /doc/:id
    document: doc,
    // Don't connect on construction. CollaborationPlugin calls provider.connect()
    // itself *after* registering its 'sync' listener; connecting earlier could
    // let the initial sync finish before anyone is listening, and then a new
    // document would never get its first paragraph.
    //
    // `autoConnect` is a HocuspocusProviderWebsocket option and isn't in
    // HocuspocusProviderConfiguration's type, but in 4.8 the provider passes its
    // whole config to the socket it creates (setConfiguration →
    // new HocuspocusProviderWebsocket(configuration)), so it takes effect.
    // It's in a variable, not an object literal, so TypeScript's excess-property
    // check allows it. Re-check this when upgrading Hocuspocus.
    autoConnect: false,
  }
  // Passing `url` (not a shared websocketProvider) makes this provider own its
  // socket, which is required for connect()/disconnect() to do anything in v4.
  const provider = new LexicalHocuspocusProvider(config)
  currentProvider = provider

  // Only a type mismatch: Hocuspocus types `awareness` as `Awareness | null`
  // (null when awareness is disabled; we don't disable it) and uses generic
  // on/off signatures.
  return provider as unknown as Provider
}
