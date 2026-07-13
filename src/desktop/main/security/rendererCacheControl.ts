import { basename, extname } from 'node:path'

const VITE_CONTENT_HASH = /-[A-Za-z0-9_-]{8,}\.[^.]+$/

/** Cache immutable Vite chunks, but revalidate stable public/runtime asset URLs across upgrades. */
export function rendererCacheControl(file: string, packaged: boolean): string {
  if (!packaged) return 'no-store'
  const extension = extname(file).toLowerCase()
  if (extension === '.html') return 'no-cache'
  return (extension === '.js' || extension === '.css') && VITE_CONTENT_HASH.test(basename(file))
    ? 'public, max-age=31536000, immutable'
    : 'no-cache'
}
