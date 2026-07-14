import { relative, resolve, sep } from 'node:path'

/** Resolve an app-protocol URL without permitting traversal outside the renderer bundle. */
export function resolveRendererFile(input: string, rendererDirectory: string): string | null {
  try {
    const decodedInput = decodeURIComponent(input)
    if (/(?:^|\/)\.\.(?:\/|$)/.test(decodedInput)) return null
    const url = new URL(input)
    if (url.protocol !== 'app:' || url.hostname !== 'turtleback') return null
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const root = resolve(rendererDirectory)
    const candidate = resolve(root, `.${pathname}`)
    const rel = relative(root, candidate)
    if (rel === '..' || rel.startsWith(`..${sep}`) || rel === '') return null
    return candidate
  } catch {
    return null
  }
}
