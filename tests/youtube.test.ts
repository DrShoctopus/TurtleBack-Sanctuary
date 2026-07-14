import { describe, it, expect } from 'vitest'
import {
  isValidVideoId,
  parseVideoId,
  parseStartSeconds,
  buildEmbedUrl,
} from '@/game/media/youtube'

describe('isValidVideoId', () => {
  it('accepts exactly 11 valid chars', () => {
    expect(isValidVideoId('dQw4w9WgXcQ')).toBe(true)
    expect(isValidVideoId('_-aA09zZ123')).toBe(true)
  })
  it('rejects wrong length or bad chars', () => {
    expect(isValidVideoId('short')).toBe(false)
    expect(isValidVideoId('twelvechars1')).toBe(false)
    expect(isValidVideoId('bad!chars!!!')).toBe(false)
    expect(isValidVideoId('')).toBe(false)
  })
})

describe('parseVideoId', () => {
  const id = 'dQw4w9WgXcQ'
  it('parses a standard watch URL', () => {
    expect(parseVideoId(`https://www.youtube.com/watch?v=${id}`)).toBe(id)
  })
  it('parses watch URL with extra params in any order', () => {
    expect(parseVideoId(`https://youtube.com/watch?list=PL123&v=${id}&t=30s`)).toBe(id)
  })
  it('parses youtu.be short links', () => {
    expect(parseVideoId(`https://youtu.be/${id}`)).toBe(id)
    expect(parseVideoId(`https://youtu.be/${id}?t=42`)).toBe(id)
  })
  it('parses embed URLs', () => {
    expect(parseVideoId(`https://www.youtube.com/embed/${id}`)).toBe(id)
    expect(parseVideoId(`https://www.youtube-nocookie.com/embed/${id}?rel=0`)).toBe(id)
  })
  it('parses shorts URLs', () => {
    expect(parseVideoId(`https://www.youtube.com/shorts/${id}`)).toBe(id)
  })
  it('parses live and /v/ URLs', () => {
    expect(parseVideoId(`https://www.youtube.com/live/${id}`)).toBe(id)
    expect(parseVideoId(`https://www.youtube.com/v/${id}`)).toBe(id)
  })
  it('parses m.youtube and music.youtube', () => {
    expect(parseVideoId(`https://m.youtube.com/watch?v=${id}`)).toBe(id)
    expect(parseVideoId(`https://music.youtube.com/watch?v=${id}`)).toBe(id)
  })
  it('accepts a bare 11-char ID', () => {
    expect(parseVideoId(id)).toBe(id)
  })
  it('tolerates missing scheme and www', () => {
    expect(parseVideoId(`youtube.com/watch?v=${id}`)).toBe(id)
    expect(parseVideoId(`www.youtu.be/${id}`)).toBe(id)
  })
  it('rejects non-YouTube hosts', () => {
    expect(parseVideoId(`https://vimeo.com/watch?v=${id}`)).toBeNull()
    expect(parseVideoId(`https://evil.com/embed/${id}`)).toBeNull()
  })
  it('rejects malformed input', () => {
    expect(parseVideoId('')).toBeNull()
    expect(parseVideoId('not a url')).toBeNull()
    expect(parseVideoId('https://youtube.com/watch?v=tooShort')).toBeNull()
    expect(parseVideoId('javascript:alert(1)')).toBeNull()
  })
})

describe('parseStartSeconds', () => {
  it('reads numeric t param', () => {
    expect(parseStartSeconds('https://youtu.be/dQw4w9WgXcQ?t=90')).toBe(90)
  })
  it('reads 1h2m3s form', () => {
    expect(parseStartSeconds('https://youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s')).toBe(3723)
  })
  it('reads start param', () => {
    expect(parseStartSeconds('https://youtube.com/embed/dQw4w9WgXcQ?start=10')).toBe(10)
  })
  it('returns 0 when absent', () => {
    expect(parseStartSeconds('https://youtu.be/dQw4w9WgXcQ')).toBe(0)
  })
})

describe('buildEmbedUrl', () => {
  it('uses the nocookie host and disables autoplay', () => {
    const url = buildEmbedUrl('dQw4w9WgXcQ')
    expect(url).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(url).toContain('autoplay=0')
    expect(url).toContain('enablejsapi=1')
  })
  it('includes start time when given', () => {
    expect(buildEmbedUrl('dQw4w9WgXcQ', { start: 42 })).toContain('start=42')
  })
})
