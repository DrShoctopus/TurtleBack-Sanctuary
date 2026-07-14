import { Vector3 } from 'three'
import { HOME_SPAWN, WORLD } from '../config/constants'
import { computeCelestials, type CelestialState } from '../time/timeMath'
import { cellNeighborhood, worldToCell } from '../world/spatial/cells'
import {
  DEFAULT_SPATIAL_GRID,
  type SpatialRuntimeState,
} from '../world/spatial/types'
import { QUALITY_PROFILES, type QualityProfile } from './quality'

const INITIAL_QUALITY = QUALITY_PROFILES.medium
const INITIAL_SPATIAL_CENTER = Object.freeze(
  worldToCell(HOME_SPAWN.x, HOME_SPAWN.z, {
    ...DEFAULT_SPATIAL_GRID,
    loadRadius: INITIAL_QUALITY.cellLoadRadius,
    retainRadius: INITIAL_QUALITY.cellRetainRadius,
  }),
)
const INITIAL_SPATIAL: SpatialRuntimeState = Object.freeze({
  center: INITIAL_SPATIAL_CENTER,
  active: Object.freeze(
    cellNeighborhood(INITIAL_SPATIAL_CENTER, INITIAL_QUALITY.cellLoadRadius),
  ),
  retained: Object.freeze(
    cellNeighborhood(INITIAL_SPATIAL_CENTER, INITIAL_QUALITY.cellRetainRadius),
  ),
})

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
  /** Discrete 10 Hz cell residency for imperative systems and diagnostics. */
  spatial: SpatialRuntimeState
  reducedMotion: boolean
  /** true while menus/tv pause gameplay simulation of input (world keeps breathing) */
  uiCaptured: boolean
  perf: { fps: number; p95FrameMs: number }
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
  quality: INITIAL_QUALITY,
  spatial: INITIAL_SPATIAL,
  reducedMotion: false,
  uiCaptured: true,
  perf: { fps: 60, p95FrameMs: 0 },
}
