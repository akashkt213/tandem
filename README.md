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
| `pnpm test:e2e` | Runs the `test:e2e` script in the package named `web` (Playwright, Stage 5) |

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
