const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i
const WINDOWS_DRIVE = /^[a-z]:[\\/]/i
const SUPPORTED_BASE_PROTOCOLS = new Set(['http:', 'https:', 'app:'])

function invalidStaticAssetPath(path: string): Error {
  return new Error(`Invalid static asset path: ${JSON.stringify(path)}`)
}

/** Validate a path before URL normalization can hide traversal or injection. */
export function assertStaticAssetPath(path: string): string {
  if (path.length === 0 || path.trim() !== path) throw invalidStaticAssetPath(path)

  if (
    path.startsWith('/') ||
    path.startsWith('\\') ||
    URL_SCHEME.test(path) ||
    WINDOWS_DRIVE.test(path) ||
    path.includes('\\') ||
    path.includes('?') ||
    path.includes('#') ||
    path.includes('%') ||
    CONTROL_CHARACTER.test(path)
  ) {
    throw invalidStaticAssetPath(path)
  }

  const segments = path.split('/')
  if (
    segments.some(
      (segment, index) =>
        segment === '.' || segment === '..' || (segment === '' && index !== segments.length - 1),
    )
  ) {
    throw invalidStaticAssetPath(path)
  }

  return path
}

export function resolveStaticAssetUrl(baseUrl: string, path: string): string {
  const safePath = assertStaticAssetPath(path)
  let base: URL
  try {
    base = new URL(baseUrl)
  } catch {
    throw new Error(`Invalid static asset base URL: ${JSON.stringify(baseUrl)}`)
  }
  if (!SUPPORTED_BASE_PROTOCOLS.has(base.protocol)) {
    throw new Error(`Unsupported static asset base protocol: ${base.protocol}`)
  }
  return new URL(safePath, base).toString()
}
