/** Ring buffer of recent safe standing spots for gentle respawns. Pure — unit tested. */

export interface SafeSpot {
  x: number
  y: number
  z: number
  yaw: number
}

export class SafePositionTracker {
  private slots: SafeSpot[] = []
  private sinceRecord = Infinity

  constructor(
    private minIntervalSec = 2,
    private capacity = 6,
    initial?: SafeSpot,
  ) {
    if (initial) this.slots.push({ ...initial })
  }

  /** Call every frame. Record when `safe` and enough time has passed. */
  update(dt: number, pos: SafeSpot, safe: boolean): void {
    this.sinceRecord += dt
    if (!safe) return
    if (this.sinceRecord < this.minIntervalSec) return
    this.sinceRecord = 0
    const last = this.slots[this.slots.length - 1]
    if (last && Math.hypot(last.x - pos.x, last.z - pos.z) < 0.75) {
      last.x = pos.x
      last.y = pos.y
      last.z = pos.z
      last.yaw = pos.yaw
      return
    }
    this.slots.push({ ...pos })
    if (this.slots.length > this.capacity) this.slots.shift()
  }

  /**
   * Where to respawn after a fall: prefer the spot *before* the most recent one —
   * the newest may sit right on the edge the player slipped from.
   */
  respawnTarget(): SafeSpot | null {
    if (this.slots.length === 0) return null
    if (this.slots.length === 1) return { ...this.slots[0] }
    return { ...this.slots[this.slots.length - 2] }
  }

  reset(spot: SafeSpot): void {
    this.slots = [{ ...spot }]
    this.sinceRecord = 0
  }
}
