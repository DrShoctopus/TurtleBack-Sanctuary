import { WORLD } from '../../config/constants'

export const TURTLE_REQUIRED_NODES = [
  'WorldRoot',
  'Body',
  'Neck',
  'Head',
  'Jaw',
  'Nostril_L',
  'Nostril_R',
  'Eyelid_L',
  'Eyelid_R',
  'Eye_L',
  'Eye_R',
  'EyeFocus',
  'Flipper_FL',
  'Flipper_FR',
  'Flipper_BL',
  'Flipper_BR',
  'ShellSkirt',
  'Wake_FL',
  'Wake_FR',
  'Wake_BL',
  'Wake_BR',
] as const

export const TURTLE_REQUIRED_CLIPS = [
  'Idle_Breathe',
  'Swim_Stroke',
  'Neck_Drift',
  'Blink',
  'Head_Turn',
  'Eye_Contact',
  'Jaw_Micro',
  'Nostril_Micro',
] as const

export type TurtleClipName = (typeof TURTLE_REQUIRED_CLIPS)[number]
export type TurtleLod = 0 | 1 | 2

export const TURTLE_SHELL_ANCHOR = Object.freeze({
  semiX: WORLD.shellWidth / 2,
  semiZ: WORLD.shellLength / 2,
  rimY: WORLD.rimHeight,
})

export interface TurtleModelContract {
  metreScale: 1
  bowAxis: '-z'
  nodes: readonly string[]
  clips: readonly string[]
  lods: readonly {
    level: TurtleLod
    triangleCount: number
    bounds: readonly [number, number, number, number, number, number]
  }[]
  shellAnchor: { semiX: number; semiZ: number; rimY: number }
  collision: { animated: false; overlapsTraversal: false }
}

export interface TurtleModelContractIssue {
  code: string
  message: string
}

const WAKE_EMITTERS = ['Wake_FL', 'Wake_FR', 'Wake_BL', 'Wake_BR'] as const
const WAKE_EMITTER_SET = new Set<string>(WAKE_EMITTERS)
const LOD_LEVELS = [0, 1, 2] as const
const AXES = ['x', 'y', 'z'] as const
const MAX_BOUNDS_DRIFT = 0.015
const DRIFT_EPSILON = Number.EPSILON * 64

interface BoundsMetrics {
  readonly extent: readonly [number, number, number]
  readonly center: readonly [number, number, number]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function duplicateStrings(values: readonly string[]): readonly string[] {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort(compareCodePoints)
}

function validBounds(value: unknown): BoundsMetrics | null {
  if (
    !Array.isArray(value) ||
    value.length !== 6 ||
    !value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  ) {
    return null
  }

  const bounds = value as number[]
  if (bounds[0] >= bounds[3] || bounds[1] >= bounds[4] || bounds[2] >= bounds[5]) {
    return null
  }
  return {
    extent: [bounds[3] - bounds[0], bounds[4] - bounds[1], bounds[5] - bounds[2]],
    center: [(bounds[0] + bounds[3]) / 2, (bounds[1] + bounds[4]) / 2, (bounds[2] + bounds[5]) / 2],
  }
}

export function validateTurtleModelContract(
  contract: TurtleModelContract,
): readonly TurtleModelContractIssue[] {
  const issues: TurtleModelContractIssue[] = []
  const add = (code: string, message: string) => issues.push(Object.freeze({ code, message }))
  const value = contract as unknown

  if (!isRecord(value)) {
    add('invalid-contract', 'Turtle model contract must be an object')
    return Object.freeze(issues)
  }

  if (value.metreScale !== 1) {
    add('invalid-metre-scale', 'Turtle visual LODs must use metreScale 1')
  }
  if (value.bowAxis !== '-z') {
    add('invalid-bow-axis', 'Turtle bow axis must be -z')
  }

  if (!Array.isArray(value.nodes)) {
    add('invalid-node-list', 'Turtle nodes must be an array')
  } else {
    const nodeValues = value.nodes
    const nodes = nodeValues.filter((entry): entry is string => typeof entry === 'string')
    if (
      nodes.length !== nodeValues.length ||
      nodes.some((name) => name.length === 0 || name !== name.trim())
    ) {
      add('invalid-node-name', 'Turtle node names must be nonblank strings without whitespace')
    }
    for (const duplicate of duplicateStrings(nodes)) {
      add('duplicate-node', `Turtle node name appears more than once: ${duplicate}`)
    }
    const present = new Set(nodes)
    for (const required of TURTLE_REQUIRED_NODES) {
      if (present.has(required)) continue
      if (WAKE_EMITTER_SET.has(required)) {
        add('missing-wake-emitter', `Missing turtle wake emitter: ${required}`)
      } else {
        add('missing-node', `Missing required turtle node: ${required}`)
      }
    }
  }

  if (!Array.isArray(value.clips)) {
    add('invalid-clip-list', 'Turtle clips must be an array')
  } else {
    const clipValues = value.clips
    const clips = clipValues.filter((entry): entry is string => typeof entry === 'string')
    if (
      clips.length !== clipValues.length ||
      clips.some((name) => name.length === 0 || name !== name.trim())
    ) {
      add('invalid-clip-name', 'Turtle clip names must be nonblank strings without whitespace')
    }
    for (const duplicate of duplicateStrings(clips)) {
      add('duplicate-clip', `Turtle clip name appears more than once: ${duplicate}`)
    }
    const present = new Set(clips)
    for (const required of TURTLE_REQUIRED_CLIPS) {
      if (!present.has(required)) add('missing-clip', `Missing required turtle clip: ${required}`)
    }
  }

  if (!Array.isArray(value.lods)) {
    add('invalid-lod-list', 'Turtle LOD metadata must be an array')
  } else {
    const byLevel = new Map<TurtleLod, Record<string, unknown>[]>()
    let hasInvalidLevel = false
    for (const candidate of value.lods) {
      if (
        !isRecord(candidate) ||
        !LOD_LEVELS.includes(candidate.level as (typeof LOD_LEVELS)[number])
      ) {
        hasInvalidLevel = true
        continue
      }
      const level = candidate.level as TurtleLod
      const entries = byLevel.get(level) ?? []
      entries.push(candidate)
      byLevel.set(level, entries)
    }
    if (hasInvalidLevel) {
      add('invalid-lod-level', 'Turtle LOD levels must be exactly 0, 1, or 2')
    }

    const uniqueLods = new Map<TurtleLod, Record<string, unknown>>()
    for (const level of LOD_LEVELS) {
      const entries = byLevel.get(level) ?? []
      if (entries.length === 0) {
        add('missing-lod-level', `Missing turtle LOD level ${level}`)
      } else if (entries.length > 1) {
        add('duplicate-lod-level', `Turtle LOD level ${level} appears more than once`)
      } else {
        uniqueLods.set(level, entries[0])
      }
    }

    const triangleCounts = new Map<TurtleLod, number>()
    const boundsByLevel = new Map<TurtleLod, BoundsMetrics>()
    for (const level of LOD_LEVELS) {
      const lod = uniqueLods.get(level)
      if (!lod) continue
      const triangleCount = lod.triangleCount
      if (
        typeof triangleCount !== 'number' ||
        !Number.isSafeInteger(triangleCount) ||
        triangleCount <= 0
      ) {
        add(
          'invalid-triangle-count',
          `Turtle LOD${level} triangleCount must be a positive safe integer`,
        )
      } else {
        triangleCounts.set(level, triangleCount)
      }

      const bounds = validBounds(lod.bounds)
      if (!bounds) {
        add(
          'invalid-lod-bounds',
          `Turtle LOD${level} bounds must contain finite ordered min/max values`,
        )
      } else {
        boundsByLevel.set(level, bounds)
      }
    }

    for (const [near, distant] of [
      [0, 1],
      [1, 2],
    ] as const) {
      const nearCount = triangleCounts.get(near)
      const distantCount = triangleCounts.get(distant)
      if (nearCount !== undefined && distantCount !== undefined && nearCount <= distantCount) {
        add('lod-triangle-order', `Turtle LOD${near} triangleCount must exceed LOD${distant}`)
      }
    }

    const lod0Bounds = boundsByLevel.get(0)
    if (lod0Bounds) {
      for (const level of [1, 2] as const) {
        const bounds = boundsByLevel.get(level)
        if (!bounds) continue
        for (let axis = 0; axis < AXES.length; axis++) {
          const baseExtent = lod0Bounds.extent[axis]
          const extentDrift = Math.abs(bounds.extent[axis] - baseExtent) / baseExtent
          if (extentDrift > MAX_BOUNDS_DRIFT + DRIFT_EPSILON) {
            add(
              'lod-bounds-extent-drift',
              `Turtle LOD${level} ${AXES[axis]} extent drifts more than 1.5% from LOD0`,
            )
          }
          const centerDrift = Math.abs(bounds.center[axis] - lod0Bounds.center[axis]) / baseExtent
          if (centerDrift > MAX_BOUNDS_DRIFT + DRIFT_EPSILON) {
            add(
              'lod-bounds-center-drift',
              `Turtle LOD${level} ${AXES[axis]} center drifts more than 1.5% of LOD0 extent`,
            )
          }
        }
      }
    }
  }

  const expectedAnchor = {
    semiX: WORLD.shellWidth / 2,
    semiZ: WORLD.shellLength / 2,
    rimY: WORLD.rimHeight,
  } as const
  if (!isRecord(value.shellAnchor)) {
    add('invalid-shell-anchor', 'Turtle shellAnchor must be an object')
  } else {
    for (const key of ['semiX', 'semiZ', 'rimY'] as const) {
      if (value.shellAnchor[key] !== expectedAnchor[key]) {
        add('invalid-shell-anchor', `Turtle shellAnchor.${key} must equal ${expectedAnchor[key]}`)
      }
    }
  }

  if (!isRecord(value.collision)) {
    add('invalid-collision', 'Turtle collision metadata must be an object')
  } else {
    if (value.collision.animated !== false) {
      add('animated-collision', 'Turtle body collision must remain static')
    }
    if (value.collision.overlapsTraversal !== false) {
      add(
        'collision-overlaps-traversal',
        'Turtle body collision must not overlap walkable shell traversal',
      )
    }
  }

  return Object.freeze(issues)
}
