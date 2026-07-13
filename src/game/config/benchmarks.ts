export interface TeleportBenchmark {
  mode: 'teleport'
  x: number
  z: number
  yaw: number
  pitch: number
}

export interface FixedBenchmark {
  mode: 'fixed'
  position: readonly [number, number, number]
  lookAt: readonly [number, number, number]
}

export type BenchmarkView = TeleportBenchmark | FixedBenchmark

/** Stable art-review cameras. IDs are public through window.__turtlebackDebug. */
export const BENCHMARKS = {
  'arrival-bridge': { mode: 'teleport', x: 0, z: -202, yaw: 0, pitch: -0.08 },
  'east-deck': { mode: 'teleport', x: 123, z: 60, yaw: -Math.PI / 2, pitch: -0.08 },
  'stern-deck': { mode: 'teleport', x: 5.2, z: 219, yaw: Math.PI, pitch: -0.12 },
  'west-deck': { mode: 'teleport', x: -127, z: -31, yaw: Math.PI / 2, pitch: -0.08 },
  'home-interior': { mode: 'teleport', x: -62, z: -132, yaw: -1.2, pitch: -0.02 },
  'cafe-interior': { mode: 'teleport', x: 36, z: -52, yaw: 0.8, pitch: -0.02 },
  'garden-pond': { mode: 'teleport', x: -52, z: 91, yaw: 0, pitch: -0.1 },
  'bookshop-interior': { mode: 'teleport', x: -30, z: -14, yaw: 0.4, pitch: -0.02 },
  'observatory-approach': { mode: 'teleport', x: 0, z: 151, yaw: Math.PI, pitch: -0.08 },
  'observatory-interior': { mode: 'teleport', x: 12, z: 194, yaw: Math.PI, pitch: -0.02 },
  'bow-edge': { mode: 'teleport', x: 0, z: -238, yaw: 0, pitch: -0.25 },
  'east-edge': { mode: 'teleport', x: 166, z: 58, yaw: -Math.PI / 2, pitch: -0.55 },
  'stern-edge': { mode: 'teleport', x: 2, z: 232, yaw: Math.PI, pitch: -0.18 },
  'west-edge': { mode: 'teleport', x: -166, z: -24, yaw: Math.PI / 2, pitch: -0.55 },
  plaza: { mode: 'teleport', x: 0, z: -60, yaw: Math.PI, pitch: -0.04 },
  landmarks: { mode: 'teleport', x: 70, z: 43, yaw: -2.18, pitch: -0.04 },
  cottages: { mode: 'teleport', x: -110, z: -38, yaw: -2.77, pitch: -0.04 },
  'turtle-portrait': {
    mode: 'fixed',
    position: [0, 7.5, -336],
    lookAt: [0, 4.5, -295],
  },
} as const satisfies Record<string, BenchmarkView>

export type BenchmarkId = keyof typeof BENCHMARKS

export const BENCHMARK_SHORTCUTS: Record<string, BenchmarkId> = {
  'Shift+Digit1': 'arrival-bridge',
  'Shift+Digit2': 'east-deck',
  'Shift+Digit3': 'stern-deck',
  'Shift+Digit4': 'west-deck',
  'Shift+Digit5': 'home-interior',
  'Shift+Digit6': 'cafe-interior',
  'Shift+Digit7': 'garden-pond',
  'Shift+Digit8': 'bookshop-interior',
  'Shift+Digit9': 'observatory-approach',
  'Shift+Digit0': 'observatory-interior',
  Digit1: 'bow-edge',
  Digit2: 'east-edge',
  Digit3: 'stern-edge',
  Digit4: 'west-edge',
  Digit5: 'turtle-portrait',
  Digit6: 'plaza',
  Digit7: 'garden-pond',
  Digit8: 'landmarks',
  Digit9: 'cottages',
}

export function isBenchmarkId(value: string): value is BenchmarkId {
  return Object.prototype.hasOwnProperty.call(BENCHMARKS, value)
}
