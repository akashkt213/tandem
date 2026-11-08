# How collaborative editing works: Lexical + Yjs + Hocuspocus

This explains how several people can type into the same document at the same time
in this project. It follows one keystroke from one browser to another. Versions match
[PLAN.md](PLAN.md): `yjs` 13.6, `@hocuspocus/server` / `@hocuspocus/provider` 4.8,
`@lexical/yjs` 0.53.

---

## 1. The three pieces and what each one does

| Piece | Where it runs | Job |
| --- | --- | --- |
| **Lexical** | Browser | The editor UI. Owns the `EditorState` that renders to the DOM. |
| **Yjs** (`yjs`, `@lexical/yjs`) | Browser **and** server | The shared data structure (a CRDT). Merges edits from everyone so that all copies end up identical. |
| **Hocuspocus** (`@hocuspocus/provider`, `@hocuspocus/server`) | Provider in browser, server in Node | The network. Moves Yjs updates between clients over a WebSocket, and keeps a copy of each document in memory. |

The key idea is that **Yjs does the merging, not the server.** Hocuspocus is mostly a
relay with a memory: it receives changes, applies them to its own copy, and forwards
them to everyone else. Conflict handling happens inside Yjs, the same way on every
machine.

```
 Browser A                              Node server                         Browser B
┌──────────────────┐                ┌──────────────────────┐            ┌──────────────────┐
│ Lexical editor   │                │  Hocuspocus Server   │            │ Lexical editor   │
│   ▲         │    │                │                      │            │   ▲         │    │
│   │ binding │    │                │  docs: Map<name,     │            │   │ binding │    │
│   │ (@lexical/yjs)                │        Y.Doc>        │            │   │         ▼    │
│   │         ▼    │   WebSocket    │                      │ WebSocket  │   │      Y.Doc   │
│      Y.Doc       │◄──────────────►│  "doc-123" → Y.Doc   │◄──────────►│                  │
│        ▲         │  binary Yjs    │                      │            │        ▲         │
│ HocuspocusProvider  updates +     │  hooks: onLoad,      │            │ HocuspocusProvider
│                  │  awareness     │  onStore, onAuth …   │            │                  │
└──────────────────┘                └──────────────────────┘            └──────────────────┘
```

---

## 2. Yjs: why concurrent edits don't conflict

### A `Y.Doc` is a CRDT

CRDT means *Conflict-free Replicated Data Type*. Every client has a full copy of the
document (a `Y.Doc`). Each copy can be edited locally with no locking and no waiting
for the server. When copies exchange their changes, they are **guaranteed to converge
to the same result**, whatever order the changes arrive in, and even if some arrive
twice.

### Every character has a unique ID

When you insert something, Yjs creates an *item* with an ID of
`(clientID, clock)`:

- `clientID` is a random number picked by each `Y.Doc` when it's created.
- `clock` is a counter that goes up by one for each item that client creates.

The item also remembers **what was immediately to its left and right when it was
inserted** (its *origins*). Positions are never stored as numbers like "index 5",
because index 5 means different things on different machines while edits are in
flight. "After item (A, 17)" means the same thing everywhere.

### Concurrent inserts at the same spot

Alice and Bob both have `Hello` and both type at the end at the same moment:

```
Alice:  Hello + "!"   → item (alice, 5), left origin = "o"
Bob:    Hello + "?"   → item (bob,   9), left origin = "o"
```

Both new items claim to sit right after `o`. Yjs's ordering algorithm (YATA) breaks
the tie deterministically, essentially by comparing client IDs. Every machine runs
the same rule, so everyone gets the same result, for example `Hello!?`. Nobody's
character is lost, and no server decision is needed.

### Deletes are tombstones

Deleting doesn't remove an item. It marks it deleted (a *tombstone*) and records it
in a compact *delete set*. That way, if Bob inserts after a character Alice just
deleted, his insert still has a valid anchor. Deleted content is garbage-collected
down to small markers, so it doesn't grow without limit.

### Updates and state vectors

- An **update** is a compact binary encoding of some items plus deletions. Applying
  the same update twice does nothing the second time, and updates can be applied in
  any order.
- A **state vector** is a summary of what a doc has seen: `{ clientID → highest
  clock }`. Two docs compare state vectors to work out exactly what the other one is
  missing. This is how a client that was offline catches up with only the missing
  edits, not the whole document.

---

## 3. The Lexical ↔ Yjs binding (`@lexical/yjs`)

Lexical has its own immutable `EditorState`. It doesn't know about Yjs. The binding
(set up by `CollaborationPlugin`) keeps the two in step, in both directions.

**How the tree is mapped:**

- The Lexical root maps to a `Y.XmlText` called `root` in the `Y.Doc`.
- Each **element node** (paragraph, heading, list, list item, link, quote) is a nested
  `Y.XmlText` embedded in its parent.
- Each **text node** is stored as a small `Y.Map` (its properties, such as format)
  followed by its characters inside the parent's `Y.XmlText`.

Because text lives in a Yjs text type, two people typing in the same paragraph merge
character by character, as in section 2.

**Local edit → Yjs:** when Lexical commits an update, the binding diffs the dirty
nodes and writes the changes into the `Y.Doc` inside a Yjs transaction tagged with
the binding as its *origin*.

**Remote edit → Lexical:** when the `Y.Doc` changes because of a remote update, the
binding reads the Yjs events and applies them with `editor.update(...)`, tagged
`collaboration`. Changes whose origin is the binding itself are skipped, so your own
edits don't echo back into the editor.

**This is why some rules in PLAN.md exist:**

- *Same node classes everywhere* (pitfall 8): the mapping is built from node types.
  A client that doesn't know `ListNode` can't rebuild a list from the Yjs tree.
- *No `HistoryExtension`* (pitfall 7): undo has to be **per user**. Lexical's history
  would undo whatever changed last, including other people's typing.
  `Y.UndoManager` only tracks transactions with *your* origin, so Ctrl+Z undoes your
  edits only.
- *`editorState` must be `null`*: the initial content comes from the `Y.Doc`, not
  from Lexical.

---

## 4. Hocuspocus: moving updates around

### The client side: `HocuspocusProvider`

The provider is given a `Y.Doc` and a document **name** (here, the `:id` from
`/doc/:id`). It:

1. Opens a WebSocket to the server (`WS_URL` from `@collab/shared`).
2. Runs the **sync handshake** for that document.
3. Listens for `update` events on the `Y.Doc` and sends each local change to the
   server.
4. Applies incoming updates to the `Y.Doc`. The Lexical binding then picks them up.
5. Sends and receives **awareness** (cursors, names, colours; see below).
6. Reconnects automatically with backoff if the socket drops, and re-syncs.

### The handshake (from `y-protocols/sync`)

```
Client                                         Server
  │  SyncStep1: "my state vector is SV_c"   ──►  │
  │                                              │ works out what the client lacks
  │  ◄── SyncStep2: "here are updates you lack"  │
  │  ◄── SyncStep1: "my state vector is SV_s"    │
  │ works out what the server lacks              │
  │  SyncStep2: "here are updates you lack" ──►  │
  │                                              │
  │  ═══ both sides now have the same doc ═══    │
  │                                              │
  │  Update ──►  (every later local edit)        │ ── forwards to all other clients
  │  ◄── Update  (every later remote edit)       │    on the same document name
```

After the handshake the provider emits `synced`. (Lexical listens for `sync`, which
is why PLAN.md §3 needs a small bridge class.)

### The server side: `@hocuspocus/server`

What [apps/server/src/index.ts](apps/server/src/index.ts) starts:

- A WebSocket server on `COLLAB_HOST:COLLAB_PORT`.
- A **map from document name to `Y.Doc`**. The first client to open `"doc-123"` makes
  the server create that doc and run `onLoadDocument`, which is where a database
  load would go. Later clients for the same name share the same server copy.
- For each incoming update, the server **applies it to its own `Y.Doc` and
  broadcasts it to every other connection on that document**. Because Yjs merges
  any order correctly, the server never has to reject or reorder edits.
- One WebSocket can carry several documents. Each message is prefixed with its
  document name.

**Hooks** are how you add behaviour. The ones that matter here:

| Hook | When | Use in this project |
| --- | --- | --- |
| `onAuthenticate` | Client connects with a token | None yet. That's why the server only listens on loopback. |
| `onLoadDocument` | First client opens a doc name | Phase 2: load from DB. PLAN.md §4: seed an empty paragraph on the server. |
| `onChange` | After each update | Rarely needed. |
| `onStoreDocument` | After edits, debounced (`debounce: 5_000`, `maxDebounce: 30_000`) | Phase 2: save `Y.encodeStateAsUpdate(doc)` to the DB. Waits for 5 s of quiet, but never more than 30 s while edits continue. |
| `onDisconnect` | A client leaves | Logging or cleanup. |

**Document lifecycle:** when the last client disconnects, Hocuspocus stores the doc
(if a store hook exists) and **unloads it from memory**. With the current Phase 1
config there is no store, so the content is gone at that point. That's the
"in-memory only" note in `index.ts` and pitfall 9.

### Other server settings in `index.ts`

- `timeout: 60_000`: closes a connection that sends nothing, not even a ping, for
  60 s. The provider pings regularly, so only dead connections hit this.
- `websocketOptions.maxPayload: 1 MB`: any single message larger than this closes
  the connection. A very large paste is the realistic way to hit it.

---

## 5. Awareness: cursors and "who's here"

Awareness (from `y-protocols/awareness`) is a **separate, temporary** channel next
to the document:

- Each client publishes a small JSON state, such as
  `{ name, color, anchorPos, focusPos }`.
- It is **not** part of the `Y.Doc`. It isn't merged, persisted or undoable.
- Each client re-sends its state regularly. If a client stops (tab closed, network
  lost), others drop it after about 30 s.
- `CollaborationPlugin` uses it to draw other people's cursors and selections.
  `PresenceList.tsx` (Stage 4) will list who's connected.

---

## 6. One keystroke, end to end

Alice types `x` in a paragraph Bob is also looking at:

1. **Lexical (Alice):** the keydown becomes an `editor.update` that inserts `x` in a
   TextNode. Alice sees it immediately. There's no waiting for the network.
2. **Binding (Alice):** the update listener writes the change into Alice's `Y.Doc`.
   Yjs creates item `(alice, n)` anchored after its left neighbour.
3. **Provider (Alice):** the `Y.Doc` `update` event fires with a few bytes. The
   provider sends them to the server.
4. **Server:** applies the update to its `Y.Doc` for that name and forwards the same
   bytes to Bob's connection.
5. **Provider (Bob):** applies the update to Bob's `Y.Doc`.
6. **Binding (Bob):** sees a remote change and runs `editor.update` (tag
   `collaboration`). Lexical re-renders the paragraph and `x` appears for Bob.

If Bob typed in the same spot at the same moment, steps 1–6 run in the opposite
direction at the same time. Each side merges the other's item with the YATA rule,
and both end with the same text.

**Offline or a dropped connection:** steps 1–2 keep working, and edits pile up in the
local `Y.Doc`. When the socket comes back, the handshake in §4 exchanges only what
each side is missing.

---

## 7. What this setup does *not* give you (yet)

- **Persistence.** The content disappears when the last person leaves or the server
  restarts (Phase 2).
- **Auth.** Anyone who can reach the port can open any document name. That's why it
  only binds to loopback.
- **Validation of content.** The server applies whatever Yjs updates clients send.
  A buggy or malicious client can write any valid Yjs data.
- **Intent-level conflict resolution.** Yjs guarantees everyone converges to the
  *same* document, not that it's the one people *meant*. If Alice turns a paragraph
  into a heading while Bob deletes it, Yjs produces a consistent result, but it may
  surprise one of them.

---

## 8. Quick reference

| You want to… | Look at |
| --- | --- |
| Change how text and nodes are stored in Yjs | `@lexical/yjs` binding (don't. Keep node classes identical everywhere instead) |
| Load or save documents | Hocuspocus `onLoadDocument` / `onStoreDocument` |
| Check who may open a doc | `onAuthenticate` on the server, `token` on the provider |
| Show cursors and names | Awareness via `CollaborationPlugin` (`username`, `cursorColor`) |
| Make undo per-user | Already handled by `Y.UndoManager` through `CollaborationPlugin`, once `HistoryExtension` is removed |
| Inspect a doc on the server | `Y.encodeStateAsUpdate(doc)` or `doc.getXmlText('root').toString()` in a hook |
