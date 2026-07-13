import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { resolveRendererFile } from '@/desktop/main/security/rendererProtocol'
import {
  RemoteRequestPolicy,
  isBlockedLocalHostname,
  isTrustedEmbedUrl,
  validateExternalUrl,
} from '@/desktop/main/security/urlPolicy'

describe('desktop renderer protocol', () => {
  const root = resolve('/tmp/turtleback-renderer')

  it('maps the application root and bundled assets inside the renderer directory', () => {
    expect(resolveRendererFile('app://turtleback/', root)).toBe(resolve(root, 'index.html'))
    expect(resolveRendererFile('app://turtleback/assets/game.js', root)).toBe(
      resolve(root, 'assets/game.js'),
    )
  })

  it('rejects other origins, malformed escapes, and traversal', () => {
    expect(resolveRendererFile('app://someone-else/index.html', root)).toBeNull()
    expect(resolveRendererFile('https://turtleback/index.html', root)).toBeNull()
    expect(resolveRendererFile('app://turtleback/%E0%A4%A', root)).toBeNull()
    expect(resolveRendererFile('app://turtleback/../../secret.txt', root)).toBeNull()
    expect(resolveRendererFile('app://turtleback/%2e%2e/%2e%2e/secret.txt', root)).toBeNull()
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
    ]) {
      expect(isBlockedLocalHostname(hostname), hostname).toBe(true)
    }
    expect(isBlockedLocalHostname('radio.example.com')).toBe(false)
  })

  it('only opens explicitly approved external hosts over credential-free HTTPS', () => {
    expect(validateExternalUrl('https://github.com/example/project')?.hostname).toBe('github.com')
    expect(validateExternalUrl('https://youtu.be/abcdefghijk')?.hostname).toBe('youtu.be')
    expect(validateExternalUrl('http://github.com/example/project')).toBeNull()
    expect(validateExternalUrl('https://user:pass@github.com/example/project')).toBeNull()
    expect(validateExternalUrl('https://example.com/')).toBeNull()
  })

  it('allows only trusted embed families before explicit media authorization', () => {
    expect(isTrustedEmbedUrl('https://www.youtube-nocookie.com/embed/abcdefghijk')).toBe(true)
    expect(isTrustedEmbedUrl('https://youtube-nocookie.com.evil.example/embed/x')).toBe(false)

    const policy = new RemoteRequestPolicy()
    expect(policy.isAllowed('app://turtleback/index.html')).toBe(true)
    expect(policy.isAllowed('blob:app://turtleback/id')).toBe(true)
    expect(policy.isAllowed('https://www.youtube-nocookie.com/embed/abcdefghijk')).toBe(true)
    expect(policy.isAllowed('https://radio.example.com/live')).toBe(false)

    policy.authorize(new URL('https://radio.example.com/live'))
    expect(policy.isAllowed('https://radio.example.com/other')).toBe(true)
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
