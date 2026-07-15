import { randomUUID } from 'node:crypto'
import { request as requestHttps } from 'node:https'
import type { LookupFunction } from 'node:net'
import { Readable } from 'node:stream'
import { validateRemoteMediaUrl, type ResolvedRemoteMediaUrl } from './urlPolicy'

const AUTHORIZATION_TTL_MS = 60 * 60 * 1000
const MAX_AUTHORIZATIONS = 64
const MAX_REDIRECTS = 5
const CONNECT_TIMEOUT_MS = 15_000

interface AuthorizedRemoteMedia {
  readonly sourceUrl: string
  readonly expiresAt: number
}

/**
 * Streams explicitly authorized radio URLs through a pinned main-process
 * connection. Every request and redirect is resolved again, checked against
 * local/private ranges, and connected to one of those exact resolved addresses.
 */
export class RemoteMediaLibrary {
  private readonly authorizations = new Map<string, AuthorizedRemoteMedia>()

  async authorize(input: string): Promise<string | null> {
    const resolved = await validateRemoteMediaUrl(input)
    if (!resolved) return null
    this.prune()
    while (this.authorizations.size >= MAX_AUTHORIZATIONS) {
      const oldest = this.authorizations.keys().next().value as string | undefined
      if (!oldest) break
      this.authorizations.delete(oldest)
    }
    const token = randomUUID()
    this.authorizations.set(token, {
      sourceUrl: resolved.url.toString(),
      expiresAt: Date.now() + AUTHORIZATION_TTL_MS,
    })
    return `turtleback-media://remote/${token}`
  }

  async handleProtocol(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const token = url.hostname === 'remote' ? url.pathname.slice(1) : ''
    const authorization = this.authorizations.get(token)
    if (!authorization || authorization.expiresAt <= Date.now()) {
      if (token) this.authorizations.delete(token)
      return new Response('Not found', { status: 404 })
    }
    return this.openPinned(authorization.sourceUrl, request, 0)
  }

  private prune(): void {
    const now = Date.now()
    for (const [token, authorization] of this.authorizations) {
      if (authorization.expiresAt <= now) this.authorizations.delete(token)
    }
  }

  private async openPinned(
    input: string,
    rendererRequest: Request,
    redirectCount: number,
  ): Promise<Response> {
    if (redirectCount > MAX_REDIRECTS) return new Response('Too many redirects', { status: 508 })
    const resolved = await validateRemoteMediaUrl(input)
    if (!resolved) return new Response('Remote address refused', { status: 403 })

    return new Promise<Response>((resolve) => {
      const address = preferredAddress(resolved)
      const lookup: LookupFunction = (_hostname, options, callback) => {
        if (options.all) callback(null, [address])
        else callback(null, address.address, address.family)
      }
      const headers: Record<string, string> = {
        Accept: rendererRequest.headers.get('accept') ?? 'audio/*,*/*;q=0.8',
        'User-Agent': 'Turtleback-Sanctuary/1',
      }
      const range = rendererRequest.headers.get('range')
      if (range) headers.Range = range

      const remoteRequest = requestHttps(
        resolved.url,
        {
          method: 'GET',
          headers,
          lookup,
          signal: rendererRequest.signal,
        },
        (remoteResponse) => {
          const status = remoteResponse.statusCode ?? 502
          const location = remoteResponse.headers.location
          if (status >= 300 && status < 400 && location) {
            remoteResponse.resume()
            let redirected: URL
            try {
              redirected = new URL(location, resolved.url)
            } catch {
              resolve(new Response('Invalid redirect', { status: 502 }))
              return
            }
            void this.openPinned(redirected.toString(), rendererRequest, redirectCount + 1).then(
              resolve,
            )
            return
          }
          if (status !== 200 && status !== 206) {
            remoteResponse.resume()
            resolve(new Response('Remote stream failed', { status: 502 }))
            return
          }

          const responseHeaders = new Headers({
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'private, no-store',
          })
          for (const name of [
            'accept-ranges',
            'content-length',
            'content-range',
            'content-type',
            'icy-br',
            'icy-description',
            'icy-genre',
            'icy-metaint',
            'icy-name',
          ]) {
            const value = remoteResponse.headers[name]
            if (Array.isArray(value)) {
              for (const entry of value) responseHeaders.append(name, entry)
            } else if (value !== undefined) {
              responseHeaders.set(name, value)
            }
          }
          const body = Readable.toWeb(remoteResponse) as ReadableStream<Uint8Array>
          resolve(new Response(body, { status, headers: responseHeaders }))
        },
      )
      remoteRequest.setTimeout(CONNECT_TIMEOUT_MS, () => {
        remoteRequest.destroy(new Error('Remote media connection timed out'))
      })
      remoteRequest.on('error', () =>
        resolve(new Response('Remote stream unavailable', { status: 502 })),
      )
      remoteRequest.end()
    })
  }
}

function preferredAddress(resolved: ResolvedRemoteMediaUrl): {
  readonly address: string
  readonly family: 4 | 6
} {
  return resolved.addresses.find((entry) => entry.family === 4) ?? resolved.addresses[0]
}
