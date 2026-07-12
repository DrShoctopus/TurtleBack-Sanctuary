/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// base: './' keeps the production bundle relocatable so it can be dropped onto
// any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages subpaths).
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@dimforge') || id.includes('@react-three/rapier')) return 'physics'
          return undefined
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    globals: false,
  },
})
