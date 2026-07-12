import { useCallback, useRef, useState } from 'react'
import { useGame } from '../../state/gameStore'
import { useSettings } from '../../state/settingsStore'
import { useMedia } from '../../state/mediaStore'
import { runtime } from '../../core/runtime'
import { events } from '../../core/events'
import { HOME_SPAWN, SAVE_KEYS } from '../../config/constants'
import { formatClock, TIME_PRESETS, type TimePreset } from '../../time/timeMath'
import { closeOverlay } from '../UIRoot'
import { useMenuNav } from './useMenuNav'
import { Row, Seg, Slider, Toggle } from './controls'
import { MapPanel } from './MapPanel'
import { safeStorage } from '../../core/save/storage'

const SANCTUARY_TABS = [
  { id: 'time', label: 'Time & Weather' },
  { id: 'audio', label: 'Audio' },
  { id: 'graphics', label: 'Graphics' },
  { id: 'comfort', label: 'Comfort' },
  { id: 'controls', label: 'Controls' },
  { id: 'home', label: 'Home' },
  { id: 'map', label: 'Map' },
  { id: 'data', label: 'Data' },
  { id: 'credits', label: 'Credits' },
]

export function MenuOverlay({ mode }: { mode: 'pause' | 'sanctuary' }) {
  const ref = useRef<HTMLDivElement>(null)
  const tab = useGame((s) => s.menuTab)
  const setTab = useGame((s) => s.setMenuTab)
  const setOverlay = useGame((s) => s.setOverlay)

  const onBack = useCallback(() => closeOverlay(), [])
  const onTab = useCallback(
    (dir: 1 | -1) => {
      if (mode !== 'sanctuary') return
      const idx = SANCTUARY_TABS.findIndex((t) => t.id === useGame.getState().menuTab)
      const next = SANCTUARY_TABS[(idx + dir + SANCTUARY_TABS.length) % SANCTUARY_TABS.length]
      setTab(next.id)
    },
    [mode, setTab],
  )
  useMenuNav(ref, { onBack, onTab })

  return (
    <div className="layer top">
      <div
        ref={ref}
        className="menu-shell"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'pause' ? 'Paused' : 'Sanctuary menu'}
        style={mode === 'pause' ? { width: 'min(420px, calc(100vw - 3rem))' } : undefined}
      >
        <div className="menu-head">
          <h2>{mode === 'pause' ? 'Paused' : 'Sanctuary'}</h2>
          <div className="spacer" />
          <button className="btn small ghost" data-nav aria-label="Close menu" onClick={onBack}>
            ✕
          </button>
        </div>
        {mode === 'sanctuary' && (
          <div className="menu-tabs" role="tablist">
            {SANCTUARY_TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'active' : ''}
                data-nav
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="menu-body">
          {mode === 'pause' ? (
            <PausePanel onSanctuary={() => setOverlay('sanctuary', 'time')} />
          ) : (
            <SanctuaryPanel tab={tab} />
          )}
        </div>
        <div className="menu-foot">
          <span>↑↓ navigate · ←→ adjust · Enter / Ⓐ select · Esc / Ⓑ close</span>
          <div className="spacer" />
          {mode === 'sanctuary' && <span>LB / RB · PgUp / PgDn — switch tabs</span>}
        </div>
      </div>
    </div>
  )
}

function PausePanel({ onSanctuary }: { onSanctuary: () => void }) {
  return (
    <div className="pause-list">
      <button className="btn primary" data-nav data-nav-default onClick={() => closeOverlay()}>
        Resume
      </button>
      <button className="btn" data-nav onClick={onSanctuary}>
        Sanctuary Settings
      </button>
      <button
        className="btn"
        data-nav
        onClick={() => useGame.getState().setOverlay('sanctuary', 'controls')}
      >
        Controls
      </button>
      <button
        className="btn"
        data-nav
        onClick={() => useGame.getState().setOverlay('sanctuary', 'credits')}
      >
        Credits & Licenses
      </button>
    </div>
  )
}

function SanctuaryPanel({ tab }: { tab: string }) {
  switch (tab) {
    case 'time':
      return <TimeWeatherTab />
    case 'audio':
      return <AudioTab />
    case 'graphics':
      return <GraphicsTab />
    case 'comfort':
      return <ComfortTab />
    case 'controls':
      return <ControlsTab />
    case 'home':
      return <HomeTab />
    case 'map':
      return <MapPanel />
    case 'data':
      return <DataTab />
    case 'credits':
      return <CreditsTab />
    default:
      return null
  }
}

function TimeWeatherTab() {
  const time = useSettings((s) => s.time)
  const weather = useSettings((s) => s.weather)
  const quiet = useSettings((s) => s.quietMode)
  const set = useSettings((s) => s.set)
  const setQuiet = useSettings.setState
  const [, force] = useState(0)

  const applyPreset = (p: TimePreset) => {
    set('time', { auto: false, manual: TIME_PRESETS[p] })
    force((n) => n + 1)
  }

  return (
    <>
      <h3>Time of day</h3>
      <Row label="Current time" hint="The village clock">
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--c-accent)' }}>
          {formatClock(time.auto ? runtime.time.t : time.manual)}
        </span>
      </Row>
      <Row label="Progress automatically">
        <Toggle
          label="Progress time automatically"
          value={time.auto}
          onChange={(v) => set('time', v ? { auto: true } : { auto: false, manual: runtime.time.t })}
        />
      </Row>
      <Row label="Presets">
        <span style={{ display: 'inline-flex', gap: 6 }}>
          {(Object.keys(TIME_PRESETS) as TimePreset[]).map((p) => (
            <button key={p} className="btn small" data-nav onClick={() => applyPreset(p)}>
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </span>
      </Row>
      <Row label="Set time" hint="Drag to scrub the sun and moon">
        <Slider
          label="Time of day"
          min={0}
          max={1}
          step={0.002}
          value={time.auto ? runtime.time.t : time.manual}
          format={formatClock}
          onChange={(v) => set('time', { auto: false, manual: v })}
        />
      </Row>
      <Row label="Cycle speed" hint="A full day lasts 24 minutes at 1×">
        <Seg
          label="Cycle speed"
          value={String(time.speed) as '0.5' | '1' | '2' | '5'}
          options={[
            { value: '0.5', label: '½×' },
            { value: '1', label: '1×' },
            { value: '2', label: '2×' },
            { value: '5', label: '5×' },
          ]}
          onChange={(v) => set('time', { speed: Number(v) })}
        />
      </Row>

      <h3>Weather</h3>
      <Row label="Sky">
        <Seg
          label="Weather mode"
          value={weather.mode}
          options={[
            { value: 'auto', label: 'Drifting' },
            { value: 'clear', label: 'Clear' },
            { value: 'rain', label: 'Gentle rain' },
          ]}
          onChange={(v) => set('weather', { mode: v })}
        />
      </Row>
      <Row label="Rain intensity">
        <Slider
          label="Rain intensity"
          value={weather.rainIntensity}
          onChange={(v) => set('weather', { rainIntensity: v })}
        />
      </Row>

      <h3>Sanctuary</h3>
      <Row label="Quiet mode" hint="Softens the interface and ambient activity">
        <Toggle label="Quiet mode" value={quiet} onChange={(v) => setQuiet({ quietMode: v })} />
      </Row>
      <Row label="Return home" hint="A gentle walk back to your porch">
        <button
          className="btn small"
          data-nav
          onClick={() => {
            closeOverlay()
            const g = useGame.getState()
            g.setFade(true)
            window.setTimeout(() => {
              events.emit('teleport', { ...HOME_SPAWN, reason: 'home' })
              window.setTimeout(() => g.setFade(false), 450)
            }, 550)
          }}
        >
          Take me home
        </button>
      </Row>
    </>
  )
}

function AudioTab() {
  const audio = useSettings((s) => s.audio)
  const subtitles = useSettings((s) => s.comfort.subtitles)
  const originalMusic = useSettings((s) => s.originalMusic)
  const set = useSettings((s) => s.set)
  const setState = useSettings.setState
  const vol = (key: keyof typeof audio, label: string, hint?: string) => (
    <Row key={key} label={label} hint={hint}>
      <Slider
        label={label}
        value={audio[key] as number}
        onChange={(v) => set('audio', { [key]: v })}
      />
    </Row>
  )
  return (
    <>
      <h3>Mixer</h3>
      <Row label="Mute everything">
        <Toggle label="Mute everything" value={audio.muteAll} onChange={(v) => set('audio', { muteAll: v })} />
      </Row>
      {vol('master', 'Master')}
      {vol('music', 'Sanctuary music', 'The original generative soundtrack')}
      {vol('ambient', 'Environment', 'Ocean, wind, rain, birds')}
      {vol('sfx', 'Footsteps & interactions')}
      {vol('tv', 'Television')}
      {vol('media', 'Music player & radio')}
      <h3>Sanctuary music</h3>
      <Row label="Original soundtrack" hint="Generative lo-fi that follows the time and weather">
        <Toggle label="Original soundtrack" value={originalMusic} onChange={(v) => setState({ originalMusic: v })} />
      </Row>
      <h3>Cues</h3>
      <Row label="Sound captions" hint="Show text for meaningful sounds">
        <Toggle label="Sound captions" value={subtitles} onChange={(v) => set('comfort', { subtitles: v })} />
      </Row>
    </>
  )
}

function GraphicsTab() {
  const g = useSettings((s) => s.graphics)
  const set = useSettings((s) => s.set)
  const autoLevel = useGame((s) => s.autoQuality)
  return (
    <>
      <h3>Quality</h3>
      <Row label="Preset" hint={g.quality === 'auto' ? `Auto is currently running “${autoLevel}”` : undefined}>
        <Seg
          label="Quality preset"
          value={g.quality}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
          onChange={(v) => set('graphics', { quality: v })}
        />
      </Row>
      <Row label="Field of view">
        <Slider
          label="Field of view"
          min={60}
          max={95}
          step={1}
          value={g.fov}
          format={(v) => `${v}°`}
          onChange={(v) => set('graphics', { fov: v })}
        />
      </Row>
      <Row label="Interface scale">
        <Slider
          label="Interface scale"
          min={0.8}
          max={1.4}
          step={0.05}
          value={g.uiScale}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => set('graphics', { uiScale: v })}
        />
      </Row>
      <Row label="Soft glow (bloom)" hint="Subtle light bloom on Medium and High quality">
        <Toggle label="Bloom" value={g.bloom} onChange={(v) => set('graphics', { bloom: v })} />
      </Row>
      <Row label="Weather particles">
        <Slider
          label="Weather particle density"
          min={0.2}
          max={1}
          step={0.1}
          value={g.particleDensity}
          onChange={(v) => set('graphics', { particleDensity: v })}
        />
      </Row>
    </>
  )
}

function ComfortTab() {
  const c = useSettings((s) => s.comfort)
  const set = useSettings((s) => s.set)
  const reduced = c.reducedMotion === null ? 'system' : c.reducedMotion ? 'on' : 'off'
  return (
    <>
      <h3>Motion</h3>
      <Row label="Reduced motion" hint="Disables head bob, sway and large screen motion">
        <Seg
          label="Reduced motion"
          value={reduced as 'system' | 'on' | 'off'}
          options={[
            { value: 'system', label: 'System' },
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
          onChange={(v) =>
            set('comfort', { reducedMotion: v === 'system' ? null : v === 'on' })
          }
        />
      </Row>
      <Row label="Head bob">
        <Toggle label="Head bob" value={c.headBob} onChange={(v) => set('comfort', { headBob: v })} />
      </Row>
      <Row label="Turtle sway" hint="The slow rock of the shell as she swims">
        <Toggle label="Turtle sway" value={c.turtleBob} onChange={(v) => set('comfort', { turtleBob: v })} />
      </Row>
      <Row label="Camera sway" hint="Subtle drift while standing still">
        <Toggle label="Camera sway" value={c.cameraSway} onChange={(v) => set('comfort', { cameraSway: v })} />
      </Row>
      <h3>Interface</h3>
      <Row label="Center dot">
        <Toggle label="Center dot" value={c.centerDot} onChange={(v) => set('comfort', { centerDot: v })} />
      </Row>
      <Row label="High-contrast prompts">
        <Toggle
          label="High-contrast prompts"
          value={c.highContrastPrompts}
          onChange={(v) => set('comfort', { highContrastPrompts: v })}
        />
      </Row>
      <Row label="Clock & weather chip">
        <Toggle label="Clock chip" value={c.showClock} onChange={(v) => set('comfort', { showClock: v })} />
      </Row>
      <Row label="Hold to interact" hint="Hold E instead of tapping">
        <Toggle
          label="Hold to interact"
          value={c.holdToInteract}
          onChange={(v) => set('comfort', { holdToInteract: v })}
        />
      </Row>
    </>
  )
}

function ControlsTab() {
  const i = useSettings((s) => s.input)
  const set = useSettings((s) => s.set)
  const padConnected = useGame((s) => s.padConnected)
  return (
    <>
      <h3>Mouse & keyboard</h3>
      <Row label="Mouse sensitivity">
        <Slider label="Mouse sensitivity" min={0.2} max={2.5} step={0.05} value={i.mouseSens} onChange={(v) => set('input', { mouseSens: v })} />
      </Row>
      <div style={{ color: 'var(--c-text-dim)', fontSize: '0.86em', lineHeight: 1.9 }}>
        <b>W A S D</b> walk · <b>Mouse</b> look · <b>Shift</b> jog · <b>Space</b> hop ·{' '}
        <b>E</b> interact · <b>M</b> sanctuary · <b>Tab</b> map · <b>H</b> return home ·{' '}
        <b>Esc</b> pause
      </div>
      <h3>Controller {padConnected ? '· connected' : '· press any button to connect'}</h3>
      <Row label="Look sensitivity">
        <Slider label="Controller look sensitivity" min={0.2} max={2.5} step={0.05} value={i.padSens} onChange={(v) => set('input', { padSens: v })} />
      </Row>
      <Row label="Stick deadzone">
        <Slider label="Stick deadzone" min={0.05} max={0.4} step={0.01} value={i.deadzone} onChange={(v) => set('input', { deadzone: v })} />
      </Row>
      <Row label="Invert look Y">
        <Toggle label="Invert look Y" value={i.invertY} onChange={(v) => set('input', { invertY: v })} />
      </Row>
      <Row label="Vibration" hint="Very subtle, on supported pads">
        <Toggle label="Vibration" value={i.vibration} onChange={(v) => set('input', { vibration: v })} />
      </Row>
      <div style={{ color: 'var(--c-text-dim)', fontSize: '0.86em', lineHeight: 1.9 }}>
        <b>Left stick</b> walk · <b>Right stick</b> look · <b>Ⓐ / Cross</b> interact ·{' '}
        <b>Ⓑ / Circle</b> back · <b>Ⓧ / Square</b> hop · <b>Ⓨ / Triangle</b> sanctuary ·{' '}
        <b>L3</b> jog · <b>Select</b> map · <b>Start</b> pause · <b>LB/RB</b> menu tabs
      </div>
    </>
  )
}

function HomeTab() {
  const h = useSettings((s) => s.home)
  const set = useSettings((s) => s.set)
  return (
    <>
      <h3>Your house</h3>
      <Row label="Light warmth">
        <Slider label="Light warmth" value={h.warmth} onChange={(v) => set('home', { warmth: v })} />
      </Row>
      <Row label="Window blinds">
        <Slider label="Window blinds" value={h.blinds} onChange={(v) => set('home', { blinds: v })} />
      </Row>
      <Row label="Artwork" hint="Generated in-house, one of a kind">
        <Seg
          label="Artwork"
          value={String(h.artwork) as '0' | '1' | '2' | '3'}
          options={[
            { value: '0', label: 'Tide' },
            { value: '1', label: 'Dunes' },
            { value: '2', label: 'Reef' },
            { value: '3', label: 'Sky' },
          ]}
          onChange={(v) => set('home', { artwork: Number(v) })}
        />
      </Row>
      <Row label="Accent theme">
        <Seg
          label="Accent theme"
          value={h.theme}
          options={[
            { value: 'driftwood', label: 'Driftwood' },
            { value: 'tidepool', label: 'Tidepool' },
            { value: 'dune', label: 'Dune' },
          ]}
          onChange={(v) => set('home', { theme: v })}
        />
      </Row>
      <Row label="Stereo mode" hint="Room speakers stay by the shelf; personal follows you">
        <Seg
          label="Stereo mode"
          value={h.speakerMode}
          options={[
            { value: 'room', label: 'Room' },
            { value: 'personal', label: 'Personal' },
          ]}
          onChange={(v) => set('home', { speakerMode: v })}
        />
      </Row>
    </>
  )
}

function DataTab() {
  const resetAll = useSettings((s) => s.resetAll)
  const clearVideos = useMedia((s) => s.clearVideos)
  const clearJournal = useMedia((s) => s.clearJournal)
  const notify = useGame((s) => s.notify)
  return (
    <>
      <h3>Stored on this device only</h3>
      <p style={{ color: 'var(--c-text-dim)', fontSize: '0.9em' }}>
        The sanctuary keeps everything local: settings, journal notes, radio stations and recent
        videos never leave your browser.
      </p>
      <Row label="Reset settings" hint="Graphics, audio, comfort and controls">
        <button className="btn small" data-nav onClick={() => { resetAll(); notify('Settings reset') }}>
          Reset
        </button>
      </Row>
      <Row label="Clear media history" hint="Recent YouTube videos">
        <button className="btn small" data-nav onClick={() => { clearVideos(); notify('Media history cleared') }}>
          Clear
        </button>
      </Row>
      <Row label="Clear journal">
        <button className="btn small" data-nav onClick={() => { clearJournal(); notify('Journal cleared') }}>
          Clear
        </button>
      </Row>
      <Row label="Erase all local data" hint="Everything above, plus stations and home decor. Reloads.">
        <button
          className="btn small danger"
          data-nav
          onClick={() => {
            for (const key of Object.values(SAVE_KEYS)) safeStorage.removeItem(key)
            window.location.reload()
          }}
        >
          Erase & reload
        </button>
      </Row>
    </>
  )
}

function CreditsTab() {
  return (
    <div style={{ lineHeight: 1.75, color: 'var(--c-text-dim)', fontSize: '0.92em' }}>
      <h3>Turtleback Sanctuary</h3>
      <p>
        A quiet place, built for slow evenings. Everything you see and hear — architecture,
        terrain, textures, and the generative lo-fi soundtrack — is created procedurally by the
        game at runtime. No third-party art, audio samples, or fonts are bundled.
      </p>
      <p>
        Built with React, three.js, react-three-fiber, drei, Rapier physics, and Zustand — thank
        you to those open-source communities. Video playback is provided by YouTube's official
        embedded player; internet radio plays only the stations you add.
      </p>
      <p>
        Full licensing notes live in <code>ASSET_LICENSES.md</code> in the project repository.
        Be kind to yourself. The turtle knows the way.
      </p>
    </div>
  )
}
