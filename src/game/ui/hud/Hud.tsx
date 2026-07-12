import { useEffect, useState } from 'react'
import { useGame } from '../../state/gameStore'
import { useSettings } from '../../state/settingsStore'
import { runtime } from '../../core/runtime'
import { formatClock } from '../../time/timeMath'
import { actionGlyph } from '../glyphs'
import { subscribeAudioCues } from '../../audio/cues'

export function Hud() {
  const prompt = useGame((s) => s.prompt)
  const device = useGame((s) => s.device)
  const toasts = useGame((s) => s.toasts)
  const pointerLocked = useGame((s) => s.pointerLocked)
  const overlay = useGame((s) => s.overlay)
  const sitting = useGame((s) => s.sitting)
  const centerDot = useSettings((s) => s.comfort.centerDot)
  const highContrast = useSettings((s) => s.comfort.highContrastPrompts)
  const showClock = useSettings((s) => s.comfort.showClock)
  const quiet = useSettings((s) => s.quietMode)

  return (
    <div className="hud" aria-hidden={overlay !== null}>
      <div className={`reticle${!centerDot || overlay !== null || sitting ? ' hidden' : ''}`} />
      {prompt && overlay === null && (
        <div className={`prompt${highContrast ? ' high-contrast' : ''}`}>
          <span className="key">{actionGlyph(prompt.action, device)}</span>
          <span>{prompt.label}</span>
        </div>
      )}
      {!quiet && <ToastRack toasts={toasts} />}
      {!quiet && <LocationTitle />}
      {showClock && !quiet && overlay === null && <ClockChip />}
      {!quiet && !pointerLocked && device === 'kb' && overlay === null && !sitting && (
        <div className="hint-chip">Click to look around</div>
      )}
      {!quiet && <SubtitleStrip />}
    </div>
  )
}

function ToastRack({ toasts }: { toasts: { id: number; text: string }[] }) {
  const expire = useGame((s) => s.expireToasts)
  useEffect(() => {
    const id = window.setInterval(expire, 800)
    return () => window.clearInterval(id)
  }, [expire])
  return (
    <div className="toasts" role="status">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  )
}

function LocationTitle() {
  const name = useGame((s) => s.locationName)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!name) return
    setVisible(true)
    const id = window.setTimeout(() => setVisible(false), 3400)
    return () => window.clearTimeout(id)
  }, [name])
  if (!name) return null
  return <div className={`location-title${visible ? ' show' : ''}`}>{name}</div>
}

function ClockChip() {
  const [label, setLabel] = useState('')
  useEffect(() => {
    const tick = () => {
      const rain = runtime.weather.rain
      const icon =
        rain > 0.45 ? '🌧' : rain > 0.08 ? '🌦' : runtime.time.celest.nightFactor > 0.6 ? '☾' : '☀'
      setLabel(`${icon}  ${formatClock(runtime.time.t)}`)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])
  return <div className="clock-chip">{label}</div>
}

/** Text labels for meaningful audio cues (subtitles setting). */
function SubtitleStrip() {
  const subtitles = useSettings((s) => s.comfort.subtitles)
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    if (!subtitles) return
    let timeout = 0
    const show = (t: string) => {
      setText(t)
      window.clearTimeout(timeout)
      timeout = window.setTimeout(() => setText(null), 2600)
    }
    const unsub = subscribeAudioCues(show)
    return () => {
      unsub()
      window.clearTimeout(timeout)
    }
  }, [subtitles])
  if (!text) return null
  return <div className="subtitle-strip">{text}</div>
}
