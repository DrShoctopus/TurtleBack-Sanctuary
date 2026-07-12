/**
 * Thin handle so gameplay code can nudge the music engine without importing
 * its internals (which are created lazily after the first user gesture).
 */
export type MusicMood = 'dawn' | 'day' | 'rain' | 'night'

type PreviewFn = (mood: MusicMood) => void
type PlayerFn = (mood: MusicMood | null, playing: boolean) => void

let previewFn: PreviewFn | null = null
let playerFn: PlayerFn | null = null

export function bindMusicPreview(fn: PreviewFn): void {
  previewFn = fn
}

export function bindMusicPlayer(fn: PlayerFn): void {
  playerFn = fn
}

/** Ask the engine to play a specific mood for a while (record-shop station). */
export function setMusicPreview(mood: MusicMood): void {
  previewFn?.(mood)
}

/** Give the home stereo persistent control of the generated soundtrack. */
export function setMusicPlayerState(mood: MusicMood | null, playing: boolean): void {
  playerFn?.(mood, playing)
}
