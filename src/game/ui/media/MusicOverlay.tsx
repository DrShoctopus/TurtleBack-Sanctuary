import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useGame } from '../../state/gameStore'
import { useMedia } from '../../state/mediaStore'
import { closeOverlay } from '../UIRoot'
import { useMenuNav } from '../menus/useMenuNav'
import { mediaPlayer, BUILTIN_ITEMS, type PlaylistItem } from '../../media/MediaPlayer'
import { loadDesktopAudioLibrary, pickLocalAudio } from '../../media/localFiles'
import { validateStreamUrl } from '../../media/safeUrl'

function usePlayer() {
  return useSyncExternalStore(
    (cb) => mediaPlayer.subscribe(cb),
    () =>
      mediaPlayer.status +
      '|' +
      mediaPlayer.index +
      '|' +
      mediaPlayer.playlist.length +
      '|' +
      mediaPlayer.shuffle +
      '|' +
      mediaPlayer.repeat +
      '|' +
      mediaPlayer.currentTime.toFixed(0),
  )
}

export function MusicOverlay() {
  const ref = useRef<HTMLDivElement>(null)
  usePlayer()
  const stations = useMedia((s) => s.stations)
  const addStation = useMedia((s) => s.addStation)
  const removeStation = useMedia((s) => s.removeStation)
  const notify = useGame((s) => s.notify)
  const [tab, setTab] = useState<'builtin' | 'local' | 'radio'>('builtin')
  const [stationName, setStationName] = useState('')
  const [stationUrl, setStationUrl] = useState('')
  const [radioError, setRadioError] = useState('')

  useMenuNav(ref, { onBack: () => closeOverlay(), autoFocus: false })

  // ensure saved stations appear in the playlist
  useEffect(() => {
    const items: PlaylistItem[] = [
      ...BUILTIN_ITEMS,
      ...mediaPlayer.playlist.filter((p) => p.kind === 'local'),
      ...stations.map((s) => ({
        id: `radio-${s.url}`,
        kind: 'radio' as const,
        title: s.name,
        url: s.url,
      })),
    ]
    mediaPlayer.setPlaylist(items)
  }, [stations])

  useEffect(() => {
    void loadDesktopAudioLibrary()
      .then((tracks) => {
        if (tracks.length) mediaPlayer.addLocalTracks(tracks)
      })
      .catch(() => notify('Some local audio folders are unavailable'))
  }, [notify])

  const item = mediaPlayer.playlist[mediaPlayer.index]
  const playing = mediaPlayer.status === 'playing' || mediaPlayer.status === 'live'

  const openFiles = useCallback(async () => {
    const tracks = await pickLocalAudio()
    if (tracks.length) {
      mediaPlayer.addLocalTracks(tracks)
      notify(`Added ${tracks.length} track${tracks.length > 1 ? 's' : ''}`)
    }
  }, [notify])

  const submitStation = (e: React.FormEvent) => {
    e.preventDefault()
    const check = validateStreamUrl(stationUrl)
    if (!check.ok) {
      setRadioError(check.reason ?? 'Invalid URL')
      return
    }
    setRadioError('')
    addStation({ name: stationName.trim() || check.url!, url: check.url! })
    setStationName('')
    setStationUrl('')
    notify('Station saved')
  }

  return (
    <div className="layer top">
      <div
        ref={ref}
        className="menu-shell"
        role="dialog"
        aria-modal="true"
        aria-label="Music player"
        style={{ width: 'min(720px, calc(100vw - 3rem))' }}
      >
        <div className="menu-head">
          <h2>Music</h2>
          <div className="spacer" />
          <button
            className="btn small ghost"
            data-nav
            aria-label="Close"
            onClick={() => closeOverlay()}
          >
            ✕
          </button>
        </div>

        {/* now playing + transport */}
        <div className="now-playing">
          <div className="np-info">
            <div className="np-title">{item?.title ?? 'Nothing playing'}</div>
            <div className="np-sub">
              {mediaPlayer.status === 'error' ? (
                <span className="np-error">{mediaPlayer.errorMessage}</span>
              ) : item?.kind === 'radio' ? (
                mediaPlayer.status === 'live' ? (
                  'Live radio'
                ) : mediaPlayer.status === 'loading' ? (
                  'Connecting…'
                ) : (
                  'Radio'
                )
              ) : item?.kind === 'builtin' ? (
                'Original generated soundtrack'
              ) : (
                'Local file'
              )}
            </div>
          </div>
          <div className="np-transport">
            <button
              className="btn small"
              data-nav
              aria-label="Previous"
              onClick={() => mediaPlayer.prev()}
            >
              ⏮
            </button>
            <button
              className="btn primary"
              data-nav
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() => mediaPlayer.toggle()}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <button
              className="btn small"
              data-nav
              aria-label="Next"
              onClick={() => mediaPlayer.next()}
            >
              ⏭
            </button>
            <button
              className={`btn small ${mediaPlayer.shuffle ? 'primary' : ''}`}
              data-nav
              aria-label="Shuffle"
              onClick={() => mediaPlayer.toggleShuffle()}
            >
              🔀
            </button>
            <button
              className="btn small"
              data-nav
              aria-label="Repeat"
              onClick={() => mediaPlayer.cycleRepeat()}
            >
              {mediaPlayer.repeat === 'one' ? '🔂' : '🔁'}
              {mediaPlayer.repeat === 'off' ? '·' : ''}
            </button>
          </div>
        </div>
        {item?.kind === 'local' && mediaPlayer.duration > 0 && (
          <div className="np-seek">
            <input
              type="range"
              min={0}
              max={mediaPlayer.duration}
              step={1}
              value={mediaPlayer.currentTime}
              aria-label="Seek"
              data-nav
              onChange={(e) => mediaPlayer.seek(Number(e.target.value))}
            />
            <span>
              {fmt(mediaPlayer.currentTime)} / {fmt(mediaPlayer.duration)}
            </span>
          </div>
        )}

        <div className="menu-tabs" role="tablist">
          {(['builtin', 'local', 'radio'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? 'active' : ''}
              data-nav
              onClick={() => setTab(t)}
            >
              {t === 'builtin' ? 'Sanctuary' : t === 'local' ? 'Your files' : 'Radio'}
            </button>
          ))}
        </div>

        <div className="menu-body">
          {tab === 'builtin' && <TrackList filter="builtin" />}
          {tab === 'local' && (
            <>
              <p className="muted">
                {window.desktopApp
                  ? 'Choose an audio folder from your device. It stays registered with this app and its files are never uploaded.'
                  : 'Choose audio files from your device. They play locally and are never uploaded. Browsers can’t keep files after you leave unless you re-grant access.'}
              </p>
              <button className="btn primary" data-nav onClick={openFiles}>
                Add audio files…
              </button>
              <TrackList filter="local" empty="No local files yet." />
            </>
          )}
          {tab === 'radio' && (
            <>
              <p className="muted">
                Add a station’s direct <b>https</b> stream URL. Some stations block browser playback
                or don’t expose titles — that’s a station limitation, not a bug. Desktop streams
                stay inside the app's pinned security relay; browser builds connect directly.
              </p>
              <form className="radio-form" onSubmit={submitStation}>
                <input
                  type="text"
                  placeholder="Station name (optional)"
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  aria-label="Station name"
                  data-nav
                />
                <input
                  type="url"
                  placeholder="https://…/stream.mp3"
                  value={stationUrl}
                  onChange={(e) => setStationUrl(e.target.value)}
                  aria-label="Stream URL"
                  data-nav
                />
                <button
                  type="submit"
                  className="btn primary"
                  data-nav
                  disabled={!stationUrl.trim()}
                >
                  Save station
                </button>
              </form>
              {radioError && <p className="tv-error">{radioError}</p>}
              <TrackList
                filter="radio"
                empty="No stations saved yet."
                onRemove={(url) => removeStation(url)}
              />
            </>
          )}
        </div>
        <div className="menu-foot">
          <span>Local files and stations stay on this device only.</span>
        </div>
      </div>
    </div>
  )
}

function TrackList({
  filter,
  empty,
  onRemove,
}: {
  filter: 'builtin' | 'local' | 'radio'
  empty?: string
  onRemove?: (url: string) => void
}) {
  usePlayer()
  const items = mediaPlayer.playlist
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.kind === filter)
  if (items.length === 0) return <p className="muted">{empty}</p>
  return (
    <ul className="track-list">
      {items.map(({ it, i }) => (
        <li key={it.id} className={i === mediaPlayer.index ? 'active' : ''}>
          <button
            className="track-play"
            data-nav
            aria-label={`Play ${it.title}`}
            onClick={() => mediaPlayer.playIndex(i)}
          >
            <span className="track-icon">
              {i === mediaPlayer.index &&
              (mediaPlayer.status === 'playing' || mediaPlayer.status === 'live')
                ? '♪'
                : '▶'}
            </span>
            <span className="track-name">{it.title}</span>
          </button>
          {onRemove && it.url && (
            <button
              className="btn small ghost"
              data-nav
              aria-label={`Remove ${it.title}`}
              onClick={() => onRemove(it.url!)}
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function fmt(s: number): string {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}
