/**
 * The home stereo playback engine: built-in generative tracks, local files, and
 * internet-radio streams — all through one <audio> element routed into the
 * media bus. Desktop radio uses a pinned app-controlled playback URL; browser
 * builds use the validated HTTPS URL directly. Positional ("room") vs personal
 * listening is handled by a PannerNode whose position the world updates.
 */
import { audio as audioManager } from '../audio/AudioManager'
import { validateStreamUrl } from './safeUrl'
import type { LocalTrack } from './localFiles'
import { setMusicPlayerState } from '../audio/proceduralMusic/engineHandle'
import type { MusicMood } from '../audio/proceduralMusic/moods'

export type SourceKind = 'builtin' | 'local' | 'radio'

export interface PlaylistItem {
  id: string
  kind: SourceKind
  title: string
  /** for radio */
  url?: string
  /** for local */
  track?: LocalTrack
  /** for builtin generative */
  mood?: MusicMood
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error' | 'live'

interface Listener {
  (): void
}

export const BUILTIN_ITEMS: PlaylistItem[] = [
  { id: 'builtin-dawn', kind: 'builtin', title: 'Sanctuary — Dawn', mood: 'dawn' },
  { id: 'builtin-day', kind: 'builtin', title: 'Sanctuary — Day', mood: 'day' },
  { id: 'builtin-rain', kind: 'builtin', title: 'Sanctuary — Rain', mood: 'rain' },
  { id: 'builtin-night', kind: 'builtin', title: 'Sanctuary — Night', mood: 'night' },
]

export class MediaPlayer {
  private el: HTMLAudioElement | null = null
  private srcNode: MediaElementAudioSourceNode | null = null
  private panner: PannerNode | null = null
  private mediaGain: GainNode | null = null
  private speakerMode: 'room' | 'personal' = 'room'
  private roomPosition: [number, number, number] = [0, 0, 0]

  playlist: PlaylistItem[] = [...BUILTIN_ITEMS]
  index = 0
  status: PlayerStatus = 'idle'
  errorMessage = ''
  shuffle = false
  repeat: 'off' | 'one' | 'all' = 'all'
  currentTime = 0
  duration = 0
  /** builtin generative is playing (no <audio> element) */
  private builtinActive = false
  private selectionGeneration = 0

  private listeners = new Set<Listener>()

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private emit(): void {
    for (const fn of this.listeners) fn()
  }

  private ensureGraph(): boolean {
    const ctx = audioManager.ctx
    const mediaBus = audioManager.bus('media')
    if (!ctx || !mediaBus) return false
    if (!this.el) {
      this.el = new Audio()
      this.el.crossOrigin = 'anonymous'
      this.el.preload = 'auto'
      this.el.addEventListener('playing', () =>
        this.set('status', this.isLive() ? 'live' : 'playing'),
      )
      this.el.addEventListener('pause', () => {
        if (this.status !== 'error') this.set('status', 'paused')
      })
      this.el.addEventListener('waiting', () => this.set('status', 'loading'))
      this.el.addEventListener('ended', () => this.next())
      this.el.addEventListener('timeupdate', () => {
        this.currentTime = this.el!.currentTime
        this.duration = isFinite(this.el!.duration) ? this.el!.duration : 0
        this.emit()
      })
      this.el.addEventListener('error', () => this.onError())
      try {
        this.srcNode = ctx.createMediaElementSource(this.el)
        this.panner = ctx.createPanner()
        this.panner.panningModel = 'HRTF'
        this.panner.distanceModel = 'inverse'
        this.panner.refDistance = 2
        this.panner.maxDistance = 24
        this.panner.rolloffFactor = 1
        this.mediaGain = ctx.createGain()
        this.srcNode.connect(this.panner)
        this.panner.connect(this.mediaGain)
        this.mediaGain.connect(mediaBus)
        this.applySpatialState()
      } catch {
        // some browsers block MediaElementSource for cross-origin; play raw
        this.srcNode = null
      }
    }
    return true
  }

  private set<K extends keyof MediaPlayer>(key: K, val: MediaPlayer[K]): void {
    ;(this as MediaPlayer)[key] = val
    this.emit()
  }

  private isLive(): boolean {
    return this.playlist[this.index]?.kind === 'radio'
  }

  private onError(): void {
    const item = this.playlist[this.index]
    this.errorMessage =
      item?.kind === 'radio'
        ? 'This station wouldn’t play — it may block browser playback or be offline. The rest of the sanctuary is unaffected.'
        : 'That track couldn’t be played in this browser.'
    this.set('status', 'error')
  }

  // --- transport -----------------------------------------------------------

  async playIndex(i: number): Promise<void> {
    if (i < 0 || i >= this.playlist.length) return
    const generation = ++this.selectionGeneration
    this.index = i
    const item = this.playlist[i]
    this.errorMessage = ''

    // built-in generative: hand off to the procedural engine, no <audio>
    if (item.kind === 'builtin') {
      this.stopElement()
      this.builtinActive = true
      if (item.mood) setMusicPlayerState(item.mood, true)
      this.set('status', 'playing')
      return
    }

    this.stopElement()
    this.builtinActive = false
    setMusicPlayerState(null, false)
    if (!this.ensureGraph() || !this.el) {
      this.errorMessage = 'Audio is unavailable in this browser.'
      this.set('status', 'error')
      return
    }
    this.set('status', 'loading')

    let src = ''
    if (item.kind === 'radio') {
      const check = validateStreamUrl(item.url ?? '')
      if (!check.ok) {
        this.errorMessage = check.reason ?? 'Invalid stream URL.'
        this.set('status', 'error')
        return
      }
      if (window.desktopApp) {
        const playbackUrl = await window.desktopApp.authorizeRemoteMediaUrl(check.url!)
        if (!this.isCurrentSelection(generation, item.id)) return
        if (!playbackUrl) {
          this.failSelection(
            generation,
            item.id,
            'This station address was refused by the desktop network policy.',
          )
          return
        }
        src = playbackUrl
      } else {
        src = check.url!
      }
    } else if (item.kind === 'local' && item.track) {
      try {
        src = await item.track.getUrl()
      } catch {
        this.failSelection(generation, item.id, 'That file could not be opened.')
        return
      }
    }

    if (!this.isCurrentSelection(generation, item.id)) return
    this.el.src = src
    try {
      await this.el.play()
    } catch {
      // often an autoplay rejection; the UI will show a Play affordance
      if (this.isCurrentSelection(generation, item.id)) this.set('status', 'paused')
    }
  }

  private isCurrentSelection(generation: number, itemId: string): boolean {
    return generation === this.selectionGeneration && this.playlist[this.index]?.id === itemId
  }

  private failSelection(generation: number, itemId: string, message: string): void {
    if (!this.isCurrentSelection(generation, itemId)) return
    this.errorMessage = message
    this.set('status', 'error')
  }

  play(): void {
    if (this.builtinActive) {
      const mood = this.playlist[this.index]?.mood
      if (mood) setMusicPlayerState(mood, true)
      this.set('status', 'playing')
      return
    }
    if (this.el && this.el.src) void this.el.play().catch(() => this.set('status', 'paused'))
    else void this.playIndex(this.index)
  }

  pause(): void {
    if (this.builtinActive) {
      setMusicPlayerState(this.playlist[this.index]?.mood ?? null, false)
      this.set('status', 'paused')
      return
    }
    this.el?.pause()
  }

  toggle(): void {
    if (this.status === 'playing' || this.status === 'live') this.pause()
    else this.play()
  }

  next(): void {
    if (this.repeat === 'one') {
      void this.playIndex(this.index)
      return
    }
    let n: number
    if (this.shuffle && this.playlist.length > 1) {
      do {
        n = Math.floor(Math.random() * this.playlist.length)
      } while (n === this.index)
    } else {
      n = this.index + 1
      if (n >= this.playlist.length) {
        if (this.repeat === 'off') {
          this.set('status', 'paused')
          return
        }
        n = 0
      }
    }
    void this.playIndex(n)
  }

  prev(): void {
    if (this.el && this.currentTime > 3 && !this.isLive()) {
      this.el.currentTime = 0
      return
    }
    const n = this.index - 1 < 0 ? this.playlist.length - 1 : this.index - 1
    void this.playIndex(n)
  }

  seek(t: number): void {
    if (this.el && !this.isLive() && isFinite(this.duration) && this.duration > 0) {
      this.el.currentTime = t
    }
  }

  // --- playlist mutation ---------------------------------------------------

  addLocalTracks(tracks: LocalTrack[]): void {
    const items: PlaylistItem[] = tracks.map((t) => ({
      id: t.id,
      kind: 'local',
      title: t.name,
      track: t,
    }))
    const ids = new Set(items.map((item) => item.id))
    this.setPlaylist([...this.playlist.filter((item) => !ids.has(item.id)), ...items])
  }

  addRadio(name: string, url: string): void {
    this.playlist = [...this.playlist, { id: `radio-${url}`, kind: 'radio', title: name, url }]
    this.emit()
  }

  setPlaylist(items: PlaylistItem[]): void {
    const current = this.playlist[this.index]
    const nextIndex = current ? items.findIndex((item) => item.id === current.id) : -1
    const nextCurrent = nextIndex >= 0 ? items[nextIndex] : undefined
    const preservesCurrentSource = Boolean(
      current && nextCurrent && (current.kind !== 'local' || current.track === nextCurrent.track),
    )
    if (!preservesCurrentSource) {
      this.selectionGeneration++
      this.stopElement()
      this.builtinActive = false
      setMusicPlayerState(null, false)
      this.status = 'idle'
      this.errorMessage = ''
      this.currentTime = 0
      this.duration = 0
    }
    const retainedTracks = new Set(items.flatMap((item) => (item.track ? [item.track] : [])))
    for (const item of this.playlist) {
      if (item.track && !retainedTracks.has(item.track)) item.track.revoke()
    }
    this.playlist = items
    this.index = preservesCurrentSource ? nextIndex : 0
    this.emit()
  }

  toggleShuffle(): void {
    this.set('shuffle', !this.shuffle)
  }
  cycleRepeat(): void {
    this.set('repeat', this.repeat === 'off' ? 'all' : this.repeat === 'all' ? 'one' : 'off')
  }

  // --- spatialization ------------------------------------------------------

  /** 'room' anchors sound at the stereo; 'personal' follows the player. */
  setSpeakerMode(mode: 'room' | 'personal'): void {
    this.speakerMode = mode
    this.applySpatialState()
  }

  /** World updates the stereo speaker location (room mode). */
  setRoomPosition(x: number, y: number, z: number): void {
    this.roomPosition = [x, y, z]
    this.applySpatialState()
  }

  private applySpatialState(): void {
    if (!this.panner) return
    this.panner.rolloffFactor = this.speakerMode === 'room' ? 1 : 0
    this.panner.positionX.value = this.roomPosition[0]
    this.panner.positionY.value = this.roomPosition[1]
    this.panner.positionZ.value = this.roomPosition[2]
  }

  private stopElement(): void {
    if (this.el) {
      this.el.pause()
      this.el.removeAttribute('src')
      this.el.load()
    }
  }

  dispose(): void {
    this.selectionGeneration++
    this.stopElement()
    const tracks = new Set(this.playlist.flatMap((item) => (item.track ? [item.track] : [])))
    for (const track of tracks) track.revoke()
    this.srcNode?.disconnect()
    this.panner?.disconnect()
    this.mediaGain?.disconnect()
    this.srcNode = null
    this.panner = null
    this.mediaGain = null
    this.el = null
    this.listeners.clear()
  }
}

export const mediaPlayer = new MediaPlayer()
