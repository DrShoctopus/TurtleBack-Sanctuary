import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/gameStore'
import { useMedia } from '../../state/mediaStore'
import { closeOverlay } from '../UIRoot'
import { useMenuNav } from '../menus/useMenuNav'
import { buildEmbedUrl, parseStartSeconds, parseVideoId, thumbnailUrl } from '../../media/youtube'
import { audio } from '../../audio/AudioManager'
import { useSettings } from '../../state/settingsStore'

/**
 * The living-room television. Pointer lock is already released by the time this
 * mounts. The video plays in the official YouTube (nocookie) IFrame embed —
 * we never scrape or restream. Recent IDs are stored locally only.
 *
 * Design note: rather than track an iframe onto the swaying 3D TV mesh, the TV
 * presents as a clean full-panel "TV interface" (an HTML overlay), which is the
 * flow the brief describes and avoids cross-origin texture hacks entirely.
 */
export function TvOverlay() {
  const ref = useRef<HTMLDivElement>(null)
  const recent = useMedia((s) => s.recentVideos)
  const addVideo = useMedia((s) => s.addVideo)
  const [input, setInput] = useState('')
  const [current, setCurrent] = useState<{ id: string; start: number } | null>(null)
  const [error, setError] = useState('')
  const notify = useGame((s) => s.notify)

  useMenuNav(ref, { onBack: () => closeOverlay(), autoFocus: false })

  const load = useCallback(
    (raw: string) => {
      const id = parseVideoId(raw)
      if (!id) {
        setError(
          'That doesn’t look like a YouTube link or video ID. Try a normal watch, youtu.be, or Shorts URL.',
        )
        return
      }
      setError('')
      const start = parseStartSeconds(raw)
      setCurrent({ id, start })
      // title is unknown without the Data API; store the ID with a friendly stub
      addVideo(id, raw.includes('http') ? `Video ${id}` : id)
    },
    [addVideo],
  )

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) load(input.trim())
  }

  return (
    <div className="layer top">
      <div
        ref={ref}
        className="menu-shell tv-shell"
        role="dialog"
        aria-modal="true"
        aria-label="Television"
      >
        <div className="menu-head">
          <h2>Television</h2>
          <div className="spacer" />
          <button
            className="btn small ghost"
            data-nav
            aria-label="Turn off and step back"
            onClick={() => closeOverlay()}
          >
            ✕
          </button>
        </div>
        <div className="menu-body tv-body">
          <div className="tv-screen">
            {current ? (
              <TvFrame
                id={current.id}
                start={current.start}
                onError={() =>
                  setError('This video can’t be embedded — the uploader disabled it. Try another.')
                }
              />
            ) : (
              <div className="tv-sleep">
                <div className="tv-sleep-glow" />
                <p>Paste a YouTube link or video ID to begin.</p>
                <p className="tv-sleep-sub">
                  Videos play through YouTube’s own player. Nothing is recorded.
                </p>
              </div>
            )}
          </div>

          <form className="tv-input-row" onSubmit={onSubmit}>
            <input
              type="text"
              inputMode="url"
              placeholder="https://youtube.com/watch?v=…  or  video ID"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="YouTube URL or video ID"
              data-nav
            />
            <button type="submit" className="btn primary" data-nav disabled={!input.trim()}>
              Play
            </button>
            {current && (
              <button
                type="button"
                className="btn"
                data-nav
                onClick={() => {
                  setCurrent(null)
                  setInput('')
                  notify('Television off')
                }}
              >
                Stop
              </button>
            )}
          </form>
          {error && <p className="tv-error">{error}</p>}

          {recent.length > 0 && (
            <div className="tv-recent">
              <h3>Recently watched</h3>
              <div className="tv-recent-grid">
                {recent.map((v) => (
                  <button
                    key={v.id}
                    className="tv-recent-item"
                    data-nav
                    onClick={() => {
                      setInput(v.id)
                      load(v.id)
                    }}
                    title={v.title}
                  >
                    <img
                      src={thumbnailUrl(v.id)}
                      alt=""
                      loading="lazy"
                      onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.15')}
                    />
                    <span>{v.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="menu-foot">
          <span>Videos are embedded from YouTube. Ads and controls are YouTube’s own.</span>
          <div className="spacer" />
          <span>Esc / Ⓑ — step back</span>
        </div>
      </div>
    </div>
  )
}

function TvFrame({ id, start, onError }: { id: string; start: number; onError: () => void }) {
  const [failed, setFailed] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const master = useSettings((s) => s.audio.master)
  const tv = useSettings((s) => s.audio.tv)
  const muted = useSettings((s) => s.audio.muteAll)
  const url = buildEmbedUrl(id, { start, origin: window.location.origin })
  // If the embed never signals ready, we can't distinguish "blocked" reliably
  // without the JS API handshake; a timeout offers a graceful hint.
  useEffect(() => {
    setFailed(false)
    const t = window.setTimeout(() => {
      // don't force an error state — just allow the hint if the iframe is blank.
    }, 4000)
    return () => window.clearTimeout(t)
  }, [id])

  const syncVolume = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'setVolume', args: [audio.tvVolume()] }),
      'https://www.youtube-nocookie.com',
    )
  }, [])

  useEffect(() => {
    syncVolume()
  }, [master, tv, muted, syncVolume])

  if (failed) {
    onError()
    return null
  }

  return (
    <iframe
      ref={iframeRef}
      key={id}
      className="tv-iframe"
      src={url}
      title="YouTube video player"
      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
      onError={() => setFailed(true)}
      onLoad={syncVolume}
    />
  )
}
