import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/..." → src/... (must match "paths" in tsconfig.json and tsconfig.app.json;
    // shadcn components import from "@/lib/utils" and "@/components/ui/*").
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
    // Always bundle one copy of these. Two copies of yjs or lexical break
    // instanceof checks in the collab binding (PLAN.md, pitfall 3).
    dedupe: ['yjs', 'y-protocols', 'lexical'],
  },
  server: {
    port: 5173,
    strictPort: true, // Playwright (Stage 5) expects this exact port
    // Forward the backend through Vite, so the browser only ever talks to
    // localhost:5173 and sends the auth cookies with every request.
    // Targets must match API_HOST/API_PORT and COLLAB_HOST/COLLAB_PORT in
    // packages/shared/src/index.ts.
    proxy: {
      // Express: auth and other HTTP endpoints.
      '/api': 'http://127.0.0.1:3000',
      // Hocuspocus: the editor's WebSocket (COLLAB_PATH). `ws: true` proxies
      // the WebSocket upgrade. The path is forwarded as-is; Hocuspocus accepts
      // connections on any path. The Origin header is left untouched, so the
      // collab server can check where the connection came from.
      '/collab': {
        target: 'http://127.0.0.1:1234',
        ws: true,
      },
    },
  },
})
