import { lookup } from 'node:dns/promises'

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
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
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
  const mapped = ipv4MappedAddress(normalized)
  if (mapped) return isPrivateIPv4(mapped)
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('ff') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('fec') ||
    normalized.startsWith('fed') ||
    normalized.startsWith('fee') ||
    normalized.startsWith('fef')
  )
}

function ipv4MappedAddress(host: string): string | null {
  if (!host.startsWith('::ffff:')) return null
  const suffix = host.slice('::ffff:'.length)
  if (suffix.includes('.')) return suffix
  const words = suffix.split(':')
  if (words.length !== 2) return null
  const high = Number.parseInt(words[0], 16)
  const low = Number.parseInt(words[1], 16)
  if (![high, low].every((word) => Number.isInteger(word) && word >= 0 && word <= 0xffff)) {
    return null
  }
  return `${high >>> 8}.${high & 0xff}.${low >>> 8}.${low & 0xff}`
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

export interface ResolvedRemoteMediaUrl {
  readonly url: URL
  readonly addresses: readonly { readonly address: string; readonly family: 4 | 6 }[]
}

type RemoteAddressResolver = (
  hostname: string,
) => Promise<readonly { readonly address: string; readonly family: number }[]>

export async function validateRemoteMediaUrl(
  input: string,
  resolveAddresses: RemoteAddressResolver = (hostname) =>
    lookup(hostname, { all: true, verbatim: true }),
): Promise<ResolvedRemoteMediaUrl | null> {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    isBlockedLocalHostname(url.hostname)
  ) {
    return null
  }
  try {
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    const addresses = await resolveAddresses(hostname)
    if (addresses.length === 0) return null
    if (addresses.some((entry) => isBlockedLocalHostname(entry.address))) return null
    const safeAddresses = addresses.filter(
      (entry): entry is { address: string; family: 4 | 6 } =>
        entry.family === 4 || entry.family === 6,
    )
    if (safeAddresses.length === 0) return null
    return { url, addresses: safeAddresses }
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
  isAllowed(input: string, developmentOrigin?: string): boolean {
    try {
      const url = new URL(input)
      if (
        url.protocol === 'app:' ||
        url.protocol === 'turtleback-media:' ||
        url.protocol === 'devtools:' ||
        url.protocol === 'data:' ||
        url.protocol === 'blob:'
      ) {
        return true
      }
      if (developmentOrigin) {
        const development = new URL(developmentOrigin)
        const sameEndpoint = url.hostname === development.hostname && url.port === development.port
        if (sameEndpoint && (url.protocol === 'http:' || url.protocol === 'ws:')) return true
      }
      if (isTrustedEmbedUrl(input)) return true
      return false
    } catch {
      return false
    }
  }
}
