import type { QualityLevel } from '../../core/quality'
import type { TurtleLod } from './modelContract'

const ENTER_NEAR = 145
const LEAVE_NEAR = 172
const ENTER_MID = 430
const LEAVE_MID = 485

const QUALITY_MINIMUM_LOD: Readonly<Record<QualityLevel, TurtleLod>> = Object.freeze({
  low: 2,
  medium: 1,
  high: 0,
  ultra: 0,
})

/**
 * Chooses the visible hero mesh from distance to the head, not distance to the
 * island-sized shell origin. Separate enter/leave thresholds prevent a player
 * standing at a boundary from causing visible LOD chatter.
 */
export function selectTurtleLod(
  distanceToHead: number,
  quality: QualityLevel,
  previous: TurtleLod = 2,
): TurtleLod {
  const distance = Number.isFinite(distanceToHead)
    ? Math.max(0, distanceToHead)
    : Number.POSITIVE_INFINITY
  let desired: TurtleLod

  if (previous === 0) desired = distance <= LEAVE_NEAR ? 0 : distance < ENTER_MID ? 1 : 2
  else if (previous === 1) {
    if (distance < ENTER_NEAR) desired = 0
    else desired = distance <= LEAVE_MID ? 1 : 2
  } else desired = distance < ENTER_NEAR ? 0 : distance < ENTER_MID ? 1 : 2

  return Math.max(desired, QUALITY_MINIMUM_LOD[quality]) as TurtleLod
}

export function turtleTextureTierForLod(lod: TurtleLod): '512' | '1k' | '2k' {
  return lod === 0 ? '2k' : lod === 1 ? '1k' : '512'
}
