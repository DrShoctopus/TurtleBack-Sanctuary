/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, normalizePath } from 'vite'
import { viteStaticCopy, type ViteStaticCopyOptions } from 'vite-plugin-static-copy'

const basisTranscoderDirectory = fileURLToPath(
  new URL('./node_modules/three/examples/jsm/libs/basis/', import.meta.url),
)

/**
 * KTX2Loader fetches these decoder files at runtime, so they must remain at a
 * stable relative URL in both Vite's development server and production output.
 */
export const BASIS_TRANSCODER_COPY_TARGETS = [
  {
    src: normalizePath(resolve(basisTranscoderDirectory, 'basis_transcoder.js')),
    dest: 'assets/decoders/basis',
  },
  {
    src: normalizePath(resolve(basisTranscoderDirectory, 'basis_transcoder.wasm')),
    dest: 'assets/decoders/basis',
  },
] as const satisfies ViteStaticCopyOptions['targets']

// base: './' keeps the production bundle relocatable so it can be dropped onto
// any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages subpaths).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    viteStaticCopy({
      targets: BASIS_TRANSCODER_COPY_TARGETS.map((target) => ({ ...target })),
    }),
  ],
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
