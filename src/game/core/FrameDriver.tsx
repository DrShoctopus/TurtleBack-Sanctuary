import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { WORLD } from '../config/constants'
import { advanceTime, computeCelestials } from '../time/timeMath'
import { WeatherSim } from '../weather/weatherMath'
import { updateWetness } from '../weather/wetMaterials'
import { input } from '../input/InputManager'
import { runtime } from './runtime'
import { QualityGovernor, QUALITY_PROFILES } from './quality'
import { useGame } from '../state/gameStore'
import { useSettings } from '../state/settingsStore'
import { lerp } from './mathUtils'
import { audio } from '../audio/AudioManager'

/**
 * Mounted first inside the Canvas: polls input, advances time/weather/travel,
 * and runs the auto-quality governor. Runs before the physics step each frame.
 */
export function FrameDriver() {
  const weatherSim = useMemo(() => new WeatherSim(useSettings.getState().worldSeed, 0), [])
  const governor = useMemo(() => new QualityGovernor('medium'), [])

  // hidden tab → treat like pause so the world doesn't lurch on return
  useEffect(() => {
    const onVis = () => {
      const g = useGame.getState()
      if (document.hidden && g.phase === 'playing' && g.overlay === null) {
        g.setOverlay('pause')
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.1, Math.max(0.0001, dtRaw))
    input.update(dt)

    // gamepad system buttons (menus open/close)
    const game = useGame.getState()
    if (game.phase === 'playing') {
      if (game.overlay === null) {
        if (input.padPressed('pause')) game.setOverlay('pause')
        else if (input.padPressed('menu')) game.setOverlay('sanctuary', 'time')
        else if (input.padPressed('map')) game.setOverlay('sanctuary', 'map')
      } else if (input.padPressed('pause') && game.overlay === 'pause') {
        game.setOverlay(null)
      }
    }

    const settings = useSettings.getState()

    // --- time of day ---
    const ts = settings.time
    runtime.time.t = ts.auto
      ? advanceTime(runtime.time.t, dt, WORLD.dayLengthSec, ts.speed)
      : ts.manual
    runtime.time.celest = computeCelestials(runtime.time.t)

    // --- weather ---
    const ws = settings.weather
    weatherSim.setMode(ws.mode)
    const { rain, wetness } = weatherSim.update(dt, ws.mode)
    const intensity = ws.rainIntensity
    runtime.weather.rain = rain * intensity
    runtime.weather.wetness = wetness * intensity
    runtime.weather.wind = 0.4 + runtime.weather.rain * 0.35
    updateWetness(runtime.weather.wetness)

    // --- endless travel ---
    runtime.travel.distance += dt * runtime.travel.speed

    // --- audio ---
    audio.update(dt)
    audio.updateListener(
      runtime.player.pos.x,
      runtime.player.pos.y + 1.6,
      runtime.player.pos.z,
      runtime.player.yaw,
      runtime.player.pitch,
    )

    // --- perf + auto quality ---
    runtime.perf.fps = lerp(runtime.perf.fps, 1 / dt, 0.05)
    const g = useGame.getState()
    if (g.phase === 'playing' && settings.graphics.quality === 'auto') {
      const switched = governor.update(dt)
      if (switched) {
        useGame.getState().setAutoQuality(switched)
      }
    }
    const choice = settings.graphics.quality
    const level = choice === 'auto' ? useGame.getState().autoQuality : choice
    if (runtime.quality.level !== level) {
      runtime.quality = QUALITY_PROFILES[level]
    }
  })

  return null
}

/** Mounted after <Physics>: clears one-frame input state once everyone consumed it. */
export function EndFrame() {
  useFrame(() => {
    input.endFrame()
  })
  return null
}
