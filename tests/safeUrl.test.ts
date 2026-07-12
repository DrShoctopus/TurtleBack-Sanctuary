import { describe, it, expect } from 'vitest'
import { validateStreamUrl, looksLikeAudioStream } from '@/game/media/safeUrl'

describe('validateStreamUrl', () => {
  it('accepts a well-formed https URL', () => {
    const r = validateStreamUrl('https://stream.example.com/live.mp3')
    expect(r.ok).toBe(true)
    expect(r.url).toBe('https://stream.example.com/live.mp3')
  })
  it('rejects http (insecure)', () => {
    const r = validateStreamUrl('http://stream.example.com/live.mp3')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/https/i)
  })
  it('rejects non-http protocols', () => {
    expect(validateStreamUrl('ftp://example.com/a.mp3').ok).toBe(false)
    expect(validateStreamUrl('file:///etc/passwd').ok).toBe(false)
    expect(validateStreamUrl('javascript:alert(1)').ok).toBe(false)
    expect(validateStreamUrl('data:audio/mp3;base64,AAAA').ok).toBe(false)
  })
  it('rejects malformed URLs', () => {
    expect(validateStreamUrl('not a url').ok).toBe(false)
    expect(validateStreamUrl('').ok).toBe(false)
    expect(validateStreamUrl('   ').ok).toBe(false)
  })
  it('rejects localhost and loopback', () => {
    expect(validateStreamUrl('https://localhost/stream').ok).toBe(false)
    expect(validateStreamUrl('https://127.0.0.1/stream').ok).toBe(false)
    expect(validateStreamUrl('https://box.local/stream').ok).toBe(false)
  })
  it('rejects embedded credentials', () => {
    expect(validateStreamUrl('https://user:pass@example.com/stream').ok).toBe(false)
  })
  it('trims whitespace', () => {
    expect(validateStreamUrl('  https://a.example.com/s.mp3  ').ok).toBe(true)
  })
})

describe('looksLikeAudioStream', () => {
  it('recognizes common audio extensions', () => {
    expect(looksLikeAudioStream('https://a.com/x.mp3')).toBe(true)
    expect(looksLikeAudioStream('https://a.com/x.aac?t=1')).toBe(true)
    expect(looksLikeAudioStream('https://a.com/x.ogg')).toBe(true)
  })
  it('recognizes stream-like paths', () => {
    expect(looksLikeAudioStream('https://a.com/radio/stream')).toBe(true)
    expect(looksLikeAudioStream('https://a.com/listen;')).toBe(true)
  })
  it('is unsure about plain hosts', () => {
    expect(looksLikeAudioStream('https://a.com/page.html')).toBe(false)
  })
})
