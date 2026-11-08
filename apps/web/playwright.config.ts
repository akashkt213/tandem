import { COLLAB_PORT } from '@collab/shared'
import { defineConfig, devices } from '@playwright/test'

const WEB_URL = 'http://localhost:5173'
const isCI = !!process.env.CI

/**
 * End-to-end tests for real-time collaboration. Each test opens several
 * browser contexts (separate "users" with their own localStorage) on the same
 * document and checks what each one sees.
 *
 * Run from the repo root with `pnpm test:e2e`. Both servers are started for you;
 * if `pnpm dev` is already running, the tests reuse it (except in CI).
 */
export default defineConfig({
  testDir: './e2e',
  // Every test uses its own document id, so they can run in parallel safely.
  fullyParallel: true,
  // Each test drives two or three browsers against the Vite dev server, which
  // can be slow under parallel load; the defaults (30 s / 5 s) were tight.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The installed Microsoft Edge, on Windows (where it comes preinstalled).
    // Worth running separately: the "ghost user after closing a tab" bug
    // (PLAN.md pitfall 20) only reproduced in Edge, not in Chromium or Chrome.
    ...(process.platform === 'win32'
      ? [{ name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } }]
      : []),
  ],
  webServer: [
    {
      // The Hocuspocus server. `start` (not `dev`), so it isn't restarted by
      // file changes in the middle of a run.
      command: 'pnpm --filter server start',
      port: COLLAB_PORT,
      reuseExistingServer: !isCI,
      stdout: 'ignore',
    },
    {
      command: 'pnpm --filter web dev',
      url: WEB_URL,
      reuseExistingServer: !isCI,
    },
  ],
})
