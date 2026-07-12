import { Vector3 } from 'three'
import { HOME_SPAWN, WORLD } from '../config/constants'
import { computeCelestials, type CelestialState } from '../time/timeMath'
import { QUALITY_PROFILES, type QualityProfile } from './quality'

/**
 * Mutable per-frame world state, deliberately outside React.
 * Systems write here from useFrame; UI samples it at low frequency.
 */
export interface Runtime {
  time: {
    t: number
    celest: CelestialState
  }
  weather: {
    /** effective rain 0..1 (already scaled by user intensity) */
    rain: number
    wetness: number
    wind: number
  }
  travel: {
    distance: number
    speed: number
  }
  player: {
    pos: Vector3
    yaw: number
    pitch: number
    grounded: boolean
    speed: number
    /** current audio/ambience zone id, 'outdoor' when outside */
    zone: string
    indoors: boolean
    surface: 'grass' | 'stone' | 'wood' | 'shell' | 'interior'
  }
  quality: QualityProfile
  reducedMotion: boolean
  /** true while menus/tv pause gameplay simulation of input (world keeps breathing) */
  uiCaptured: boolean
  perf: { fps: number }
}

export const runtime: Runtime = {
  time: { t: 0.35, celest: computeCelestials(0.35) },
  weather: { rain: 0, wetness: 0, wind: 0.5 },
  travel: { distance: 0, speed: WORLD.travelSpeed },
  player: {
    pos: new Vector3(HOME_SPAWN.x, HOME_SPAWN.y, HOME_SPAWN.z),
    yaw: HOME_SPAWN.yaw,
    pitch: 0,
    grounded: false,
    speed: 0,
    zone: 'outdoor',
    indoors: false,
    surface: 'shell',
  },
  quality: QUALITY_PROFILES.medium,
  reducedMotion: false,
  uiCaptured: true,
  perf: { fps: 60 },
}
