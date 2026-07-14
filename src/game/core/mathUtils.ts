/** Small pure math helpers shared across systems. No three.js imports — testable in node. */

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
export const clamp01 = (v: number) => clamp(v, 0, 1)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Frame-rate independent exponential approach. `halfLife` in seconds. */
export function damp(current: number, target: number, halfLife: number, dt: number): number {
  if (halfLife <= 0) return target
  return target + (current - target) * Math.pow(2, -dt / halfLife)
}

/** Move `current` toward `target` by at most `maxDelta`. */
export function moveToward(current: number, target: number, maxDelta: number): number {
  const d = target - current
  if (Math.abs(d) <= maxDelta) return target
  return current + Math.sign(d) * maxDelta
}

export const wrap01 = (t: number) => ((t % 1) + 1) % 1

/** Shortest signed distance from a to b on the unit circle [0,1). */
export function wrappedDelta01(a: number, b: number): number {
  let d = wrap01(b) - wrap01(a)
  if (d > 0.5) d -= 1
  if (d < -0.5) d += 1
  return d
}

export type ColorStop = { t: number; color: [number, number, number] }

/**
 * Sample a cyclic gradient (t in [0,1), wraps around midnight).
 * Stops must be sorted by t ascending.
 */
export function sampleCycle(stops: ColorStop[], t: number): [number, number, number] {
  const tt = wrap01(t)
  if (stops.length === 0) return [0, 0, 0]
  if (stops.length === 1) return stops[0].color
  let prev = stops[stops.length - 1]
  let next = stops[0]
  for (let i = 0; i < stops.length; i++) {
    if (stops[i].t > tt) {
      next = stops[i]
      prev = stops[(i + stops.length - 1) % stops.length]
      break
    }
    if (i === stops.length - 1) {
      prev = stops[i]
      next = stops[0]
    }
  }
  let span = next.t - prev.t
  if (span <= 0) span += 1
  let f = (tt - prev.t) / span
  if (f < 0) f += 1 / span // wrapped segment
  f = clamp01(f)
  const s = f * f * (3 - 2 * f)
  return [
    lerp(prev.color[0], next.color[0], s),
    lerp(prev.color[1], next.color[1], s),
    lerp(prev.color[2], next.color[2], s),
  ]
}

export const DEG2RAD = Math.PI / 180
export const RAD2DEG = 180 / Math.PI

/** Perceptual volume curve: slider value → gain. */
export const volumeToGain = (v: number) => clamp01(v) * clamp01(v)
