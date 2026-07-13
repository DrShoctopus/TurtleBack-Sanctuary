/** Nearest-rank percentile over a defensive, ascending copy of the input. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) throw new RangeError('percentile requires at least one sample')
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new RangeError('percentile must be finite and within [0, 1]')
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new TypeError('percentile samples must all be finite')
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.ceil(p * sorted.length) - 1)
  return sorted[index]
}

/** Small bounded sample buffer used for frame-time decisions and diagnostics. */
export class FrameTimeWindow {
  private readonly samples: number[] = []

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError('frame-time capacity must be a positive integer')
    }
  }

  get size(): number {
    return this.samples.length
  }

  get isFull(): boolean {
    return this.samples.length === this.capacity
  }

  add(frameMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs <= 0) {
      throw new RangeError('frame time must be positive and finite')
    }
    if (this.samples.length === this.capacity) this.samples.shift()
    this.samples.push(frameMs)
  }

  snapshot(): readonly number[] {
    return [...this.samples]
  }

  clear(): void {
    this.samples.length = 0
  }
}
