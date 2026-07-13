import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

const EXTERNAL_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'youtu.be', 'github.com'])
const EMBED_SUFFIXES = [
  'youtube-nocookie.com',
  'youtube.com',
  'ytimg.com',
  'googlevideo.com',
  'gstatic.com',
  'google.com',
]

function isPrivateIPv4(host: string): boolean {
  const parts = host.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  )
}

function isPrivateIPv6(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '')
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  )
}

export function isBlockedLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.lan') ||
    host.endsWith('.internal')
  ) {
    return true
  }
  return isPrivateIPv4(host) || isPrivateIPv6(host)
}

export async function validateRemoteMediaUrl(input: string): Promise<URL | null> {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || isBlockedLocalHostname(url.hostname)) {
    return null
  }
  try {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true })
    if (addresses.length === 0) return null
    if (addresses.some((entry) => isBlockedLocalHostname(entry.address))) return null
  } catch {
    return null
  }
  return url
}

export function validateExternalUrl(input: string): URL | null {
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return EXTERNAL_HOSTS.has(url.hostname.toLowerCase()) ? url : null
  } catch {
    return null
  }
}

export function isTrustedEmbedUrl(input: string): boolean {
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    return EMBED_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
  } catch {
    return false
  }
}

export class RemoteRequestPolicy {
  private readonly authorizedMediaOrigins = new Set<string>()

  authorize(url: URL): void {
    this.authorizedMediaOrigins.add(url.origin)
  }

  isAllowed(input: string, developmentOrigin?: string): boolean {
    try {
      const url = new URL(input)
      if (url.protocol === 'app:' || url.protocol === 'turtleback-media:' || url.protocol === 'devtools:') {
        return true
      }
      if (developmentOrigin && url.origin === developmentOrigin) return true
      if (isTrustedEmbedUrl(input)) return true
      return this.authorizedMediaOrigins.has(url.origin)
    } catch {
      return false
    }
  }
}

