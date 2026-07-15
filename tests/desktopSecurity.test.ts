import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { rendererCacheControl } from '@/desktop/main/security/rendererCacheControl'
import {
  BASIS_TRANSCODER_WORKER_CSP,
  contentSecurityPolicyForResponse,
  isBasisTranscoderWorkerUrl,
  rendererDocumentContentSecurityPolicy,
} from '@/desktop/main/security/contentSecurityPolicy'
import { rendererContentType } from '@/desktop/main/security/rendererContentType'
import { resolveRendererFile } from '@/desktop/main/security/rendererProtocol'
import { RemoteMediaLibrary } from '@/desktop/main/security/remoteMedia'
import {
  RemoteRequestPolicy,
  isBlockedLocalHostname,
  isTrustedEmbedUrl,
  validateRemoteMediaUrl,
} from '@/desktop/main/security/urlPolicy'

describe('desktop renderer protocol', () => {
  const root = resolve('/tmp/turtleback-renderer')

  it('maps the application root and bundled assets inside the renderer directory', () => {
    expect(resolveRendererFile('app://turtleback/', root)).toBe(resolve(root, 'index.html'))
    expect(resolveRendererFile('app://turtleback/assets/game.js', root)).toBe(
      resolve(root, 'assets/game.js'),
    )
    expect(resolveRendererFile('app://turtleback/assets/system/pipeline-smoke.glb', root)).toBe(
      resolve(root, 'assets/system/pipeline-smoke.glb'),
    )
    expect(
      resolveRendererFile('app://turtleback/assets/decoders/basis/basis_transcoder.wasm', root),
    ).toBe(resolve(root, 'assets/decoders/basis/basis_transcoder.wasm'))
  })

  it('rejects other origins, malformed escapes, and traversal', () => {
    expect(resolveRendererFile('app://someone-else/index.html', root)).toBeNull()
    expect(resolveRendererFile('https://turtleback/index.html', root)).toBeNull()
    expect(resolveRendererFile('app://turtleback/%E0%A4%A', root)).toBeNull()
    expect(resolveRendererFile('app://turtleback/assets/%ZZ/file.glb', root)).toBeNull()
    expect(resolveRendererFile('app://turtleback/../../secret.txt', root)).toBeNull()
    expect(resolveRendererFile('app://turtleback/%2e%2e/%2e%2e/secret.txt', root)).toBeNull()
    expect(
      resolveRendererFile('app://turtleback/assets%2f%2e%2e%2f%2e%2e%2fsecret.txt', root),
    ).toBeNull()
  })
})

describe('desktop renderer content types', () => {
  it.each([
    ['scene.glb', 'model/gltf-binary'],
    ['scene.gltf', 'model/gltf+json; charset=utf-8'],
    ['albedo.ktx2', 'image/ktx2'],
    ['sky.hdr', 'image/vnd.radiance'],
    ['sky.exr', 'image/x-exr'],
    ['scene.bin', 'application/octet-stream'],
    ['decoder.wasm', 'application/wasm'],
    ['INDEX.HTML', 'text/html; charset=utf-8'],
  ])('maps %s to %s', (file, contentType) => {
    expect(rendererContentType(file)).toBe(contentType)
  })
})

describe('desktop renderer cache policy', () => {
  it('revalidates stable runtime assets while retaining immutable content-hashed chunks', () => {
    expect(rendererCacheControl('/dist/index.html', true)).toBe('no-cache')
    expect(rendererCacheControl('/dist/assets/system/pipeline-smoke.glb', true)).toBe('no-cache')
    expect(rendererCacheControl('/dist/assets/decoders/basis/basis_transcoder.wasm', true)).toBe(
      'no-cache',
    )
    expect(rendererCacheControl('/dist/assets/index-D4m3pQ2x.js', true)).toBe(
      'public, max-age=31536000, immutable',
    )
    expect(rendererCacheControl('/dist/assets/index-D4m3pQ2x.js', false)).toBe('no-store')
  })
})

describe('desktop content security policy', () => {
  function directive(policy: string, name: string): readonly string[] {
    const value = policy.split('; ').find((candidate) => candidate.startsWith(`${name} `))
    return value?.split(' ').slice(1) ?? []
  }

  it('keeps JavaScript eval out of both production and development documents', () => {
    const production = rendererDocumentContentSecurityPolicy(false)
    const development = rendererDocumentContentSecurityPolicy(true)

    expect(directive(production, 'script-src')).toEqual(["'self'", "'wasm-unsafe-eval'"])
    expect(directive(development, 'script-src')).toEqual([
      "'self'",
      "'wasm-unsafe-eval'",
      "'unsafe-inline'",
    ])
    expect(directive(production, 'worker-src')).toEqual(["'self'"])
    expect(directive(production, 'media-src')).toEqual(["'self'", 'blob:', 'turtleback-media:'])
  })

  it('scopes the Basis generated-code allowance to the exact worker resource', () => {
    expect(directive(BASIS_TRANSCODER_WORKER_CSP, 'script-src')).toEqual([
      'blob:',
      "'unsafe-eval'",
      "'wasm-unsafe-eval'",
    ])
    expect(directive(BASIS_TRANSCODER_WORKER_CSP, 'worker-src')).toEqual(["'none'"])
    expect(
      isBasisTranscoderWorkerUrl(
        'app://turtleback/assets/decoders/basis/turtleback-basis-worker.js',
        'app://turtleback',
      ),
    ).toBe(true)
    expect(
      isBasisTranscoderWorkerUrl(
        'http://127.0.0.1:5173/assets/decoders/basis/turtleback-basis-worker.js',
        'http://127.0.0.1:5173',
      ),
    ).toBe(true)
    expect(
      isBasisTranscoderWorkerUrl(
        'app://turtleback/assets/decoders/basis/turtleback-basis-worker.js?override=1',
        'app://turtleback',
      ),
    ).toBe(false)
    expect(
      isBasisTranscoderWorkerUrl(
        'app://attacker/assets/decoders/basis/turtleback-basis-worker.js',
        'app://turtleback',
      ),
    ).toBe(false)
  })

  it('gives main-frame navigation document policy precedence over the worker URL', () => {
    const url = 'app://turtleback/assets/decoders/basis/turtleback-basis-worker.js'
    expect(
      contentSecurityPolicyForResponse({
        url,
        resourceType: 'mainFrame',
        appOrigin: 'app://turtleback',
      }),
    ).toBe(rendererDocumentContentSecurityPolicy(false))
    expect(
      contentSecurityPolicyForResponse({
        url,
        resourceType: 'other',
        appOrigin: 'app://turtleback',
      }),
    ).toBe(BASIS_TRANSCODER_WORKER_CSP)
    expect(
      contentSecurityPolicyForResponse({
        url: 'app://turtleback/assets/index-abc123.js',
        resourceType: 'script',
        appOrigin: 'app://turtleback',
      }),
    ).toBeNull()
  })
})

describe('desktop URL policy', () => {
  it('blocks local and private network names and addresses', () => {
    for (const hostname of [
      'localhost',
      'printer.local',
      'router.lan',
      'service.internal',
      '127.0.0.1',
      '10.0.0.5',
      '172.20.1.2',
      '192.168.1.2',
      '::1',
      'fd00::1',
      '::ffff:7f00:1',
      'ff02::1',
    ]) {
      expect(isBlockedLocalHostname(hostname), hostname).toBe(true)
    }
    expect(isBlockedLocalHostname('radio.example.com')).toBe(false)
  })

  it('rejects private DNS results including IPv4-mapped IPv6 addresses', async () => {
    const mapped = await validateRemoteMediaUrl('https://radio.example/live', async () => [
      { address: '::ffff:7f00:1', family: 6 },
    ])
    const mixed = await validateRemoteMediaUrl('https://radio.example/live', async () => [
      { address: '203.0.113.5', family: 4 },
      { address: '192.168.1.10', family: 4 },
    ])
    const publicOnly = await validateRemoteMediaUrl('https://radio.example/live', async () => [
      { address: '203.0.113.5', family: 4 },
    ])

    expect(mapped).toBeNull()
    expect(mixed).toBeNull()
    expect(publicOnly?.addresses).toEqual([{ address: '203.0.113.5', family: 4 }])
  })

  it('never issues desktop playback URLs for direct private-network destinations', async () => {
    const remoteMedia = new RemoteMediaLibrary()

    await expect(remoteMedia.authorize('https://127.0.0.1/live')).resolves.toBeNull()
    await expect(remoteMedia.authorize('https://[::ffff:127.0.0.1]/live')).resolves.toBeNull()
  })

  it('allows only trusted embed families before explicit media authorization', () => {
    expect(isTrustedEmbedUrl('https://www.youtube-nocookie.com/embed/abcdefghijk')).toBe(true)
    expect(isTrustedEmbedUrl('https://youtube-nocookie.com.evil.example/embed/x')).toBe(false)

    const policy = new RemoteRequestPolicy()
    expect(policy.isAllowed('app://turtleback/index.html')).toBe(true)
    expect(policy.isAllowed('blob:app://turtleback/id')).toBe(true)
    expect(policy.isAllowed('https://www.youtube-nocookie.com/embed/abcdefghijk')).toBe(true)
    expect(policy.isAllowed('https://radio.example.com/live')).toBe(false)

    expect(policy.isAllowed('https://radio.example.com/other')).toBe(false)
  })

  it('limits the development exception to the configured local endpoint', () => {
    const policy = new RemoteRequestPolicy()
    const origin = 'http://127.0.0.1:5173'
    expect(policy.isAllowed('http://127.0.0.1:5173/src/main.tsx', origin)).toBe(true)
    expect(policy.isAllowed('ws://127.0.0.1:5173/', origin)).toBe(true)
    expect(policy.isAllowed('http://127.0.0.1:6000/', origin)).toBe(false)
    expect(policy.isAllowed('http://localhost:5173/', origin)).toBe(false)
  })
})
