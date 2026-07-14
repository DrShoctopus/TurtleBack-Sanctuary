/**
 * YouTube URL/ID parsing and validation. Pure — heavily unit-tested. We never
 * scrape, proxy, or restream; a parsed ID is only ever handed to the official
 * IFrame embed. Prefer youtube-nocookie.com for privacy.
 */

/** A valid YouTube video ID is exactly 11 chars of [A-Za-z0-9_-]. */
const ID_RE = /^[A-Za-z0-9_-]{11}$/

export function isValidVideoId(id: string): boolean {
  return ID_RE.test(id)
}

/**
 * Extract an 11-char video ID from any common YouTube URL form, or from a bare
 * ID. Returns null if nothing valid is found.
 *
 * Handled: watch?v=, youtu.be/, /embed/, /shorts/, /live/, /v/, with extra
 * query params, timestamps, playlists, and http/https/no-scheme/www variants.
 */
export function parseVideoId(input: string): string | null {
  if (!input) return null
  const raw = input.trim()

  // bare ID
  if (isValidVideoId(raw)) return raw

  let url: URL
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const ytHosts = ['youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'youtu.be', 'music.youtube.com']
  if (!ytHosts.includes(host)) return null

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const seg = url.pathname.split('/').filter(Boolean)[0]
    return seg && isValidVideoId(seg) ? seg : null
  }

  // watch?v=<id>
  const v = url.searchParams.get('v')
  if (v && isValidVideoId(v)) return v

  // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
  const parts = url.pathname.split('/').filter(Boolean)
  const marker = parts.findIndex((p) => ['embed', 'shorts', 'live', 'v'].includes(p))
  if (marker >= 0 && parts[marker + 1] && isValidVideoId(parts[marker + 1])) {
    return parts[marker + 1]
  }

  return null
}

/** Parse a start-time (seconds) from a URL's `t`/`start` param, if any. */
export function parseStartSeconds(input: string): number {
  try {
    const url = new URL(input.includes('://') ? input : `https://${input}`)
    const t = url.searchParams.get('t') ?? url.searchParams.get('start')
    if (!t) return 0
    if (/^\d+$/.test(t)) return parseInt(t, 10)
    // 1h2m3s form
    const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/)
    if (m) return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0))
  } catch {
    /* ignore */
  }
  return 0
}

/** Build a privacy-enhanced embed URL for the IFrame Player API. */
export function buildEmbedUrl(id: string, opts: { start?: number; origin?: string } = {}): string {
  const params = new URLSearchParams({
    enablejsapi: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    // do NOT autoplay — respect media policies; user presses play in-player
    autoplay: '0',
  })
  if (opts.start) params.set('start', String(opts.start))
  if (opts.origin) params.set('origin', opts.origin)
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`
}

export function thumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
}
