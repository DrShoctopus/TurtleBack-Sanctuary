import type { Object3D } from 'three'
import {
  SHELL_SEMI_X,
  SHELL_SEMI_Z,
  shellRadius,
  terrainHeight,
  terrainNormal,
} from '../shell/shellShape'

export interface ShellTransitionAnchor {
  readonly index: number
  readonly theta: number
  readonly x: number
  readonly y: number
  readonly z: number
  readonly normal: readonly [number, number, number]
}

export type CollisionPoint = readonly [x: number, y: number, z: number]
export type CollisionTriangle = readonly [CollisionPoint, CollisionPoint, CollisionPoint]

export interface TerrainGoldenSample {
  readonly id: string
  readonly x: number
  readonly z: number
  readonly y: number
}

/**
 * Frozen before any Phase B rendering work. These values cover the home,
 * plaza, four deck centres, and every unique traversal-span endpoint.
 */
export const TERRAIN_GOLDEN_SAMPLES: readonly TerrainGoldenSample[] = Object.freeze([
  { id: 'home-spawn', x: -56, z: -126, y: 12.7 },
  { id: 'plaza', x: 0, z: -40, y: 15.8 },
  { id: 'west-deck', x: -146, z: -24, y: 10.1 },
  { id: 'east-deck', x: 148, z: 58, y: 9.8 },
  { id: 'bow-deck', x: 0, z: -224, y: 10 },
  { id: 'stern-deck', x: 2, z: 236, y: 10.6 },
  { id: 'garden-pond-bridge:a', x: -52, z: 74, y: 13.12064492780912 },
  { id: 'garden-pond-bridge:b', x: -52, z: 86, y: 13 },
  { id: 'observatory-ramp:a', x: 0, z: 154, y: 15.6 },
  { id: 'observatory-ramp:b', x: 0, z: 178, y: 17.532327109778677 },
  { id: 'observatory-stairs:a', x: 4.4, z: 169.6, y: 15.663822202258809 },
  { id: 'observatory-stairs:b', x: 6, z: 176, y: 17.65423052224876 },
  { id: 'stern-descent:a', x: 5.2, z: 220, y: 14.688391161968823 },
  { id: 'stern-descent:b/stern-landing:a', x: 3.6, z: 228, y: 10.6 },
  { id: 'west-deck-gangway:a', x: -130.4, z: -30, y: 11.989107451044058 },
  { id: 'east-deck-gangway:a', x: 126, z: 60, y: 11.892059838285782 },
  { id: 'bow-deck-gangway:a', x: 0, z: -205, y: 11.073978355245691 },
])

export function sampleShellTransitionAnchors(count: number): readonly ShellTransitionAnchor[] {
  if (!Number.isSafeInteger(count) || count < 64) {
    throw new RangeError('shell transition sampling requires at least 64 anchors')
  }
  return Object.freeze(
    Array.from({ length: count }, (_, index) => {
      const theta = (index / count) * Math.PI * 2
      const x = Math.cos(theta) * SHELL_SEMI_X
      const z = Math.sin(theta) * SHELL_SEMI_Z
      return Object.freeze({
        index,
        theta,
        x,
        y: terrainHeight(x, z),
        z,
        normal: Object.freeze(terrainNormal(x, z)),
      })
    }),
  )
}

function midpoint(left: CollisionPoint, right: CollisionPoint): CollisionPoint {
  return [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2, (left[2] + right[2]) / 2]
}

/** Conservative fixed samples used by tests and the offline model validator. */
export function collisionTriangleOverlapsTraversal(
  triangle: CollisionTriangle,
  epsilon = 0.02,
): boolean {
  const [a, b, c] = triangle
  const samples: readonly CollisionPoint[] = [
    a,
    b,
    c,
    midpoint(a, b),
    midpoint(b, c),
    midpoint(c, a),
    [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3],
  ]
  return samples.some(([x, y, z]) => {
    if (shellRadius(x, z) > 1 + epsilon / Math.min(SHELL_SEMI_X, SHELL_SEMI_Z)) return false
    return y >= terrainHeight(x, z) - epsilon
  })
}

/**
 * Runtime development guard: the analytic shell is the sole traversal source.
 * Visual authored meshes may declare `traversalCollision: false`, never true.
 */
export function authoredTraversalCollisionViolations(root: Object3D): readonly string[] {
  const violations: string[] = []
  root.traverse((object) => {
    if (object.userData.traversalCollision !== true) return
    if (object.userData.traversalSource === 'analytic-shell') return
    violations.push(object.name || object.uuid)
  })
  return Object.freeze(violations.sort())
}
