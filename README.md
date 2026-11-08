# Collaborative Rich-Text Editor

A Google Docs-style collaborative editor built with Lexical, Yjs and Hocuspocus.
See [PLAN.md](PLAN.md) for the architecture, chosen versions and known pitfalls.

## Layout

| Path | What it is |
|---|---|
| `apps/web` | Vite + React + TypeScript frontend (Lexical editor) |
| `apps/server` | Hocuspocus WebSocket server (Node + TypeScript, in-memory only) |
| `packages/shared` | Shared types and constants (`@collab/shared`) |

This is a plain pnpm workspace with no Turborepo. `packages/shared` is consumed as
TypeScript source, so it has no build step.

## Requirements

- Node.js **22.12+** (Hocuspocus 4 requires Node 22; Vite 8 requires 22.12+)
- pnpm **12** (`corepack enable` picks up the version in `package.json`)

## Run

```sh
pnpm install
pnpm dev
```

`pnpm dev` runs the `dev` script of every workspace package in parallel. To be picked
up, `apps/web` and `apps/server` each need a `dev` script in their own `package.json`,
for example:

- `apps/web`: `"dev": "vite"`
- `apps/server`: `"dev": "tsx watch src/index.ts"`

To run a single app:

```sh
pnpm --filter web dev
pnpm --filter server dev
```

(`--filter` matches the `name` field in each app's `package.json`.)

## Other scripts

| Command | What it does |
|---|---|
| `pnpm build` | Runs `build` in every package that has one |
| `pnpm typecheck` | Runs `typecheck` in every package that has one |
| `pnpm test:e2e` | Runs the Playwright end-to-end tests (see below) |

## End-to-end tests

The tests in `apps/web/e2e/` open the same document in several browser
contexts, which act as separate users, and check what each one sees. They cover
syncing in both directions, formatting, a late joiner, undo, the name dialog,
the presence list, live renames and people leaving.

First time only, download the browser Playwright tests with:

```sh
pnpm --filter web exec playwright install chromium
```

Then, from the repo root:

```sh
pnpm test:e2e                                  # all tests
pnpm --filter web exec playwright test --ui    # interactive runner
```

You don't need `pnpm dev` running: Playwright starts the collaboration server
and Vite itself. If they're already running, it reuses them, except in CI.
On Windows the tests also run in the installed Microsoft Edge. One bug, a
user staying in the list for 30 s after closing their tab, only reproduced
there.

## UI components (shadcn/ui)

The web app uses Tailwind CSS v4 and shadcn/ui (Radix, neutral theme, Geist font).
Components are copied into `apps/web/src/components/ui`. To add one, run this from
`apps/web`:

```sh
pnpm dlx shadcn@4.23.0 add dialog
```

## Using the shared package

Add it as a dependency of an app:

```jsonc
// apps/web/package.json or apps/server/package.json
"dependencies": {
  "@collab/shared": "workspace:*"
}
```

Then import it with `import { … } from "@collab/shared"`.
