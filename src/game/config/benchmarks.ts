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
  'home-porch': { mode: 'teleport', x: -53.5, z: -134.9, yaw: 1.9, pitch: -0.08 },
  'cafe-interior': { mode: 'teleport', x: 36, z: -52, yaw: 0.8, pitch: -0.02 },
  'store-interior': { mode: 'teleport', x: 56, z: -22, yaw: 1.29, pitch: -0.02 },
  'garden-pond': { mode: 'teleport', x: -52, z: 91, yaw: 0, pitch: -0.1 },
  'bookshop-interior': { mode: 'teleport', x: -30, z: -14, yaw: 0.4, pitch: -0.02 },
  'records-interior': { mode: 'teleport', x: 80, z: 38, yaw: 1.79, pitch: -0.02 },
  'greenhouse-exterior': { mode: 'teleport', x: -57.9, z: 56.1, yaw: 2.2, pitch: -0.08 },
  'greenhouse-interior': { mode: 'teleport', x: -66, z: 62, yaw: -0.94, pitch: -0.04 },
  'gallery-interior': { mode: 'teleport', x: 100, z: 62, yaw: 2.24, pitch: -0.02 },
  'bathhouse-exterior': { mode: 'teleport', x: -34.2, z: 110.8, yaw: 2.75, pitch: -0.08 },
  'bathhouse-interior': { mode: 'teleport', x: -38, z: 120, yaw: -0.39, pitch: -0.02 },
  'pavilion-interior': { mode: 'teleport', x: -6, z: 36, yaw: -2.79, pitch: -0.06 },
  'cottage-interior': { mode: 'teleport', x: -94, z: -46, yaw: -1.79, pitch: -0.02 },
  'observatory-approach': { mode: 'teleport', x: 0, z: 151, yaw: Math.PI, pitch: -0.08 },
  'observatory-interior': { mode: 'teleport', x: 12, z: 194, yaw: Math.PI, pitch: -0.02 },
  'bow-edge': { mode: 'teleport', x: 0, z: -238, yaw: 0, pitch: -0.25 },
  'east-edge': { mode: 'teleport', x: 166, z: 58, yaw: -Math.PI / 2, pitch: -0.55 },
  'stern-edge': { mode: 'teleport', x: 2, z: 232, yaw: Math.PI, pitch: -0.18 },
  'west-edge': { mode: 'teleport', x: -166, z: -24, yaw: Math.PI / 2, pitch: -0.55 },
  plaza: { mode: 'teleport', x: 0, z: -60, yaw: Math.PI, pitch: -0.04 },
  landmarks: { mode: 'teleport', x: 70, z: 43, yaw: -2.18, pitch: -0.04 },
  cottages: { mode: 'teleport', x: -110, z: -38, yaw: -2.77, pitch: -0.04 },
  'forest-interior': { mode: 'teleport', x: -110, z: -38, yaw: -0.42, pitch: -0.1 },
  'biome-threshold': { mode: 'teleport', x: 70, z: 43, yaw: -2.18, pitch: -0.08 },
  'wildlife-grouping': { mode: 'teleport', x: -52, z: 91, yaw: 0.25, pitch: -0.12 },
  'waterfall-rim': { mode: 'teleport', x: -34.2, z: 110.8, yaw: 2.75, pitch: -0.22 },
  'flipper-scale': { mode: 'teleport', x: 150, z: -80, yaw: -Math.PI / 2, pitch: -0.46 },
  'galecrest-turtle-reveal': { mode: 'teleport', x: 80, z: -210, yaw: 0.7, pitch: -0.035 },
  'turtle-eye-encounter': { mode: 'teleport', x: 20, z: -245, yaw: 0.29, pitch: 0.035 },
  'turtle-material-close': {
    mode: 'fixed',
    position: [56, 17, -286],
    lookAt: [0, 4, -314],
  },
  'turtle-distant-silhouette': {
    mode: 'fixed',
    position: [480, 38, -150],
    lookAt: [0, -2, -65],
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
  Digit5: 'galecrest-turtle-reveal',
  Digit6: 'turtle-eye-encounter',
  Digit7: 'turtle-distant-silhouette',
  Digit8: 'turtle-material-close',
  Digit9: 'plaza',
  F6: 'turtle-eye-encounter',
  F7: 'turtle-distant-silhouette',
  F8: 'turtle-material-close',
}

export function isBenchmarkId(value: string): value is BenchmarkId {
  return Object.prototype.hasOwnProperty.call(BENCHMARKS, value)
}
