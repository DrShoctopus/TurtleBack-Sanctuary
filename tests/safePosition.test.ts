import { describe, it, expect } from 'vitest'
import { SafePositionTracker } from '@/game/player/safePosition'

describe('SafePositionTracker', () => {
  it('records safe spots at the configured interval', () => {
    const t = new SafePositionTracker(2, 6)
    t.update(1, { x: 0, y: 5, z: 0, yaw: 0 }, true) // 1s < 2s → no record
    t.update(1.5, { x: 10, y: 5, z: 0, yaw: 0 }, true) // now 2.5s → record
    const target = t.respawnTarget()
    expect(target).not.toBeNull()
  })

  it('does not record while unsafe', () => {
    const t = new SafePositionTracker(0.1, 6)
    t.update(1, { x: 0, y: 5, z: 0, yaw: 0 }, false)
    t.update(1, { x: 5, y: 5, z: 0, yaw: 0 }, false)
    expect(t.respawnTarget()).toBeNull()
  })

  it('respawns to the spot before the most recent (edge safety)', () => {
    const t = new SafePositionTracker(0.1, 6)
    t.update(1, { x: 0, y: 5, z: 0, yaw: 0 }, true)
    t.update(1, { x: 20, y: 5, z: 0, yaw: 0 }, true)
    t.update(1, { x: 40, y: 5, z: 0, yaw: 0 }, true)
    // newest is (40); respawn should prefer (20), the one before
    expect(t.respawnTarget()).toMatchObject({ x: 20 })
  })

  it('returns a copy, not the internal slot', () => {
    const t = new SafePositionTracker(0.1, 6, { x: 1, y: 2, z: 3, yaw: 0 })
    const a = t.respawnTarget()!
    a.x = 999
    expect(t.respawnTarget()!.x).toBe(1)
  })

  it('reset replaces history with a single spot', () => {
    const t = new SafePositionTracker(0.1, 6)
    t.update(1, { x: 5, y: 5, z: 0, yaw: 0 }, true)
    t.reset({ x: 100, y: 12, z: 50, yaw: 1 })
    expect(t.respawnTarget()).toMatchObject({ x: 100, y: 12, z: 50 })
  })

  it('coalesces near-duplicate positions instead of filling the buffer', () => {
    const t = new SafePositionTracker(0.1, 6)
    for (let i = 0; i < 20; i++) t.update(0.2, { x: 0.1, y: 5, z: 0.1, yaw: 0 }, true)
    // all within 0.75m of each other → single slot, respawn falls back to it
    expect(t.respawnTarget()).toMatchObject({ x: 0.1 })
  })
})
