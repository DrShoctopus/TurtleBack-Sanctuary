/** URL-safety validation for user-supplied radio streams. Pure — unit tested. */

/**
 * Validate an internet-radio stream URL. We require HTTPS (mixed-content and
 * privacy), reject anything that isn't a well-formed http(s) URL, and refuse
 * obviously non-audio or local/loopback hosts. We never proxy the stream — it
 * plays directly through a native <audio> element.
 */
export interface UrlCheck {
  ok: boolean
  reason?: string
  url?: string
}

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

export function validateStreamUrl(input: string): UrlCheck {
  const raw = (input ?? '').trim()
  if (!raw) return { ok: false, reason: 'Please enter a stream URL.' }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'That doesn’t look like a valid URL.' }
  }

  if (url.protocol === 'http:') {
    return {
      ok: false,
      reason: 'Only secure https:// streams work in the browser. Try the station’s https URL.',
    }
  }
  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'Only https:// stream URLs are allowed.' }
  }
  if (BLOCKED_HOSTS.has(url.hostname) || url.hostname.endsWith('.local')) {
    return { ok: false, reason: 'Local addresses aren’t allowed.' }
  }
  // credentials in the URL are a red flag
  if (url.username || url.password) {
    return { ok: false, reason: 'Please use a URL without embedded credentials.' }
  }
  return { ok: true, url: url.toString() }
}

/** Best-effort guess of whether a URL points at a playable audio stream. */
export function looksLikeAudioStream(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    /\.(mp3|aac|m4a|ogg|opus|flac|wav)(\?|$)/.test(lower) ||
    /(stream|listen|;|\/;|radio|icecast|shoutcast|\.pls|\.m3u8?)/.test(lower)
  )
}
