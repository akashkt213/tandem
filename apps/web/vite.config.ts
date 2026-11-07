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
  },
})
