# PLAN — Collaborative Rich-Text Editor (Phase 1)

Status: **Stage 1 (plan only)**. Nothing scaffolded yet. Repo was empty on inspection.
Environment checked: Node 22.19.0, pnpm 12.16.1, Windows 11.

All APIs below were verified against the **published package sources/typings**
(`npm pack`, Nov 7 2026), not memory. Source-level citations are given where they matter.

---

## 1. Monorepo layout

```
/
├─ pnpm-workspace.yaml        # apps/*, packages/*
├─ package.json               # root scripts: dev, build, test:e2e, typecheck
├─ tsconfig.base.json
├─ PLAN.md / README.md
├─ apps/
│  ├─ web/                    # Vite + React + TS (from create-vite react-ts template)
│  │  ├─ src/
│  │  │  ├─ main.tsx, App.tsx          # tiny path router: /doc/:id
│  │  │  ├─ editor/Editor.tsx          # LexicalComposer + plugins
│  │  │  ├─ editor/Toolbar.tsx
│  │  │  ├─ editor/theme.ts
│  │  │  ├─ collab/providerFactory.ts  # HocuspocusProvider → Lexical Provider adapter
│  │  │  ├─ collab/PresenceList.tsx
│  │  │  └─ user/identity.ts           # name + color in localStorage
│  │  └─ e2e/collab.spec.ts            # Playwright (Stage 5)
│  └─ server/                 # Hocuspocus, in-memory only
│     └─ src/index.ts
└─ packages/
   └─ shared/                 # shared types + constants (WS URL/port, user/awareness types,
                              #  editor node list used by both web and server bootstrap)
```

`pnpm dev` at the root → `pnpm -r --parallel dev` (server via `tsx watch`, web via `vite`).
Playwright config lives in `apps/web` and uses `webServer` to start both processes.

## 2. Chosen versions (npm `latest` as of 2026‑11‑07)

| Package | Version | Notes |
|---|---|---|
| `lexical`, `@lexical/react`, `@lexical/yjs`, `@lexical/rich-text`, `@lexical/list`, `@lexical/link`, `@lexical/utils`, `@lexical/selection` | **0.53.0** (pin exact, all identical) | Mixing @lexical versions breaks things; nightlies exist for 0.53.1, ignore. |
| `yjs` | **13.6.33** | 14.0.0 is still prerelease. Hocuspocus 4.8 peers `yjs ^13.6.8`, so **stay on 13**. |
| `y-protocols` | 1.0.7 | Peer dep of Hocuspocus. |
| `@hocuspocus/server`, `@hocuspocus/provider` | **4.8.0** | Server requires Node ≥ 22 (✔ 22.19). |
| `react`, `react-dom` | 19.3.1 | |
| `vite` | 8.3.6 | Rolldown-based. |
| `@vitejs/plugin-react` | 6.2.1 | |
| `typescript` | ~7.0.2 | Native (Go) compiler. Same pin as the official `create-vite` react-ts template. |
| `tsx` | 4.23.x | Runs the server in dev. |
| `@playwright/test` | 1.65.0 | |
| `tailwindcss`, `@tailwindcss/vite` | **4.3.3** (pinned) | 4.3.4/4.3.5 are under a week old and fail pnpm 12's release-age check. Don't bypass it with `minimumReleaseAgeExclude`; bump once they age. |
| shadcn/ui (CLI `shadcn@4.23.0`) | style `radix-nova`, base color `neutral`, Geist font | Components live in `apps/web/src/components/ui` (not shadcn's monorepo mode). `cn` comes from the official `cn` package (shadcn-ui/cn), not clsx + tailwind-merge. tsconfig uses `paths` without `baseUrl`, because TS 7 removed `baseUrl` (shadcn docs still show it). |
| `react-router` | **7.18.5** (pinned) | Declarative mode (`BrowserRouter` / `Routes`). v8.5.1 is `latest` but needs Node ≥ 22.22 (this machine has 22.19). Upgrade together with Node. |

## 3. How CollaborationPlugin connects to Hocuspocus

### What Lexical 0.53 expects (from `LexicalCollaborationPlugin.tsx`)

```ts
type ProviderFactory = (id: string, yjsDocMap: Map<string, Doc>) => Provider;
```

- The plugin calls `providerFactory(id, yjsDocMap)` once per `(id, factory, docMap)` and then
  reads `yjsDocMap.get(id)`. **The factory has to create the `Y.Doc` and put it in the map.**
- It listens to `provider.on('sync', (isSynced: boolean) => …)` for bootstrapping, and
  `provider.on('status', ({status}) => …)` for the connected state.
- It calls `provider.connect()` on mount and `provider.disconnect()` on unmount. It never calls `destroy()`.
- It must be inside `<LexicalCollaboration>` (new wrapper component; the docs example uses it).
- `initialConfig.editorState` must be `null`. Yjs owns the state.

### What HocuspocusProvider 4.8 does (from `HocuspocusProvider.ts`)

- It emits **`synced` with `{ state }`**. It never emits `sync`. **Lexical's sync handler would
  never fire.** The event names don't match.
- `connect()` and `disconnect()` only work when the provider owns its socket (`url` passed, no
  shared `websocketProvider`). Otherwise they log a deprecation warning and do nothing.
- `awareness` is typed `Awareness | null`, which doesn't match Lexical's `ProviderAwareness`.
  At runtime it's a normal y-protocols `Awareness`.
- `emit` is `protected`, so I can't re-emit from outside.

### Adapter (sketch, built in Stage 4)

```ts
// collab/providerFactory.ts
export function createProviderFactory(onCreated?: (p: HocuspocusProvider) => void) {
  return (id: string, yjsDocMap: Map<string, Y.Doc>): Provider => {
    const doc = new Y.Doc();
    yjsDocMap.set(id, doc);                    // Lexical reads the doc from this map

    const provider = new HocuspocusProvider({
      url: WS_URL,                             // provider owns its socket → connect/disconnect work
      name: id,                                // Hocuspocus document name = URL :id
      document: doc,
      autoConnect: false,                      // Lexical calls connect() itself
    });

    // Bridge: Hocuspocus 'synced' {state} → Lexical 'sync' (boolean).
    // Small subclass (or wrapper) whose on/off('sync', cb) map to 'synced'.
    ...
    onCreated?.(provider);                     // so the page can destroy() it on unmount
    return provider as unknown as Provider;    // awareness type mismatch only
  };
}
```

I'll do the bridge as a small `class LexicalHocuspocusProvider extends HocuspocusProvider`.
It overrides `on`/`off` and translates `'sync'` into a `'synced'` listener that unwraps
`{state}`. A subclass keeps the `Provider` identity Lexical holds, and doesn't need the
protected `emit`. The factory is created once at module level so its identity stays stable.

**Presence list:** `CollaborationPlugin` already writes `{ name, color, focusing, anchorPos, … }`
into awareness (`initLocalState`). `PresenceList` reads `provider.awareness.getStates()` and
subscribes to `'change'`. It doesn't need its own awareness fields.

**Remote cursors:** built in, using `username` / `cursorColor` props.
A `cursorsContainerRef` points at a `position: relative` wrapper around the editor, so cursors
scroll with the content.

**Switching docs:** set `key={docId}` on the component that owns `LexicalComposer`, as the docs
recommend. The page component calls `provider.destroy()` on unmount (see pitfall 4).

## 4. Bootstrapping (needs your decision before Stage 4)

`shouldBootstrap` seeds an empty paragraph when the doc is empty after sync. The plugin's JSDoc
and the Lexical docs both warn about it. If two clients see the empty doc at the same time,
**both insert a paragraph**. The docs call client bootstrap "dev-testing only" and recommend
seeding on the server.

**Proposal:** set `shouldBootstrap={false}` on clients and seed on the server.
1. Hocuspocus `onLoadDocument`: if the doc's `root` XmlText is empty, build the seed with the
   docs' `withHeadlessCollaborationEditor` pattern (`@lexical/headless` + `createBinding` +
   `syncLexicalUpdateToYjs`, appending one paragraph).
2. Apply it with `Y.applyUpdate(document, Y.encodeStateAsUpdate(seedDoc))`.
3. This puts `lexical` and `@lexical/headless` on the server. The node list (Heading, Quote,
   List, ListItem, Link) moves to `packages/shared`, so client and server register the same nodes.

The alternative is client `shouldBootstrap={true}`. It's simpler but has a known race, which the
two-client Playwright test could hit.

## 5. Known pitfalls

1. **Event name mismatch.** Hocuspocus emits `synced` and Lexical listens for `sync` (see §3).
   Without the bridge, bootstrap never runs.
2. **Yjs 13 vs 14.** The Lexical docs now point new Yjs 14 projects to a separate binding
   (`@lexical/y` / `YCollabExtension`). Hocuspocus 4.8 is Yjs 13 only. **We use `@lexical/yjs`
   with Yjs 13, as you specified.** A document can't move between the two bindings without a
   migration. That matters before Phase 2 persistence.
3. **Duplicate Yjs instances** ("Yjs was already imported" warning) break `instanceof` checks.
   Keep a single `yjs` version in the workspace (root `pnpm.overrides`) and set
   `resolve.dedupe: ['yjs', 'lexical', 'y-protocols']` in Vite.
4. **Provider leak.** Lexical only calls `disconnect()`, never `destroy()`. We destroy the
   provider (and the doc) ourselves when the doc page unmounts.
5. **Double connect.** `autoConnect` defaults to `true` and Lexical also calls `connect()`. The
   websocket's `connect()` returns early when already connected, but `autoConnect: false` is
   cleaner.
6. **StrictMode** mounts twice. The plugin is written to be idempotent, but the factory must be
   stable and must not have side effects beyond creating the doc and provider.
7. **No `HistoryPlugin`.** Undo/redo has to go through the Yjs UndoManager, which the plugin
   wires up itself. Adding `HistoryPlugin` conflicts with it.
8. **Same nodes everywhere.** Every client (and the headless server seeder) must register
   identical node classes. Custom node properties must be set in the constructor; optional class
   fields don't sync.
9. **In-memory server.** Hocuspocus unloads a document once the last client disconnects, and the
   content is lost. Within Phase 1 constraints I'll keep a `Map<docName, Uint8Array>` snapshot
   (`onStoreDocument` → save, `onLoadDocument` → apply). Data survives client churn but not a
   server restart. Say if you'd rather have pure no-retention.
10. **Hocuspocus v4 server API.** `new Server({ port, … })` then `await server.listen()`
    (now built on `crossws`). The v2 `Server.configure(...)` examples online are outdated.
11. **TS 7.** It's the native compiler with no JS API. Tools that use the TS API in-process won't
    work. The template uses oxlint, so this isn't a problem for us.
12. **Playwright timing.** Wait for sync before asserting, e.g. a `data-synced` attribute that
    flips on `synced`. Use `expect.poll` / `toHaveText` rather than fixed sleeps. Use a unique doc
    id per test so runs don't interfere.

## 6. Stages

1. ✅ Plan (this file)
2. ✅ Root workspace scaffold, `pnpm dev`, README. No Turborepo: `shared` is consumed as
   source and there's nothing to cache yet; revisit when CI time matters in Phase 2.
   `apps/web` and `apps/server` are left empty for you to scaffold.
3. Lexical rich text + toolbar (headings, B/I/U, lists, links), no collab
4. Collab: provider adapter, `/doc/:id`, cursors, presence, name prompt
5. Playwright: two-context sync + late-joiner
