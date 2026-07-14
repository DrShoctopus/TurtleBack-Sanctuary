/** Lightweight pub/sub for subtitle-worthy audio cues (rain, chimes, etc.). */
type CueFn = (text: string) => void

const listeners = new Set<CueFn>()

export function publishAudioCue(text: string): void {
  for (const fn of listeners) fn(text)
}

export function subscribeAudioCues(fn: CueFn): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
