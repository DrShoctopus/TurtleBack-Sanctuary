/** Default speed for ambient animation while reduced motion is enabled. */
export const REDUCED_MOTION_SCALE = 0.12

/** Resolve the time scale used by comfort-aware ambient animation. */
export function comfortMotionScale(
  reducedMotion: boolean,
  reducedScale = REDUCED_MOTION_SCALE,
): number {
  if (!reducedMotion) return 1
  if (!Number.isFinite(reducedScale)) return REDUCED_MOTION_SCALE
  return Math.min(1, Math.max(0, reducedScale))
}

/** Advance only the new delta so toggling reduced motion never jumps phase. */
export function advanceComfortMotionTime(
  currentTime: number,
  dt: number,
  reducedMotion: boolean,
  reducedScale = REDUCED_MOTION_SCALE,
): number {
  if (!Number.isFinite(dt) || dt <= 0) return currentTime
  return currentTime + dt * comfortMotionScale(reducedMotion, reducedScale)
}

export class ComfortMotionClock {
  private accumulated: number

  constructor(initialTime = 0) {
    this.accumulated = initialTime
  }

  get time(): number {
    return this.accumulated
  }

  advance(dt: number, reducedMotion: boolean, reducedScale = REDUCED_MOTION_SCALE): number {
    this.accumulated = advanceComfortMotionTime(this.accumulated, dt, reducedMotion, reducedScale)
    return this.accumulated
  }

  reset(time = 0): void {
    this.accumulated = time
  }
}
