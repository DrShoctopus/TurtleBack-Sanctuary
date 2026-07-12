import { describe, it, expect } from 'vitest'
import {
  applyRadialDeadzone,
  lookCurve,
  actionPressed,
  actionHeld,
  padActive,
  PAD_BUTTON,
  PAD_ACTION_MAP,
  type PadFrame,
} from '@/game/input/gamepadMath'

describe('applyRadialDeadzone', () => {
  it('zeroes input inside the deadzone', () => {
    const r = applyRadialDeadzone(0.1, 0.05, 0.15)
    expect(r.x).toBe(0)
    expect(r.y).toBe(0)
  })
  it('passes through and rescales beyond the deadzone', () => {
    const r = applyRadialDeadzone(1, 0, 0.15)
    expect(r.x).toBeCloseTo(1, 5)
    expect(r.y).toBe(0)
  })
  it('preserves direction', () => {
    const r = applyRadialDeadzone(0.6, 0.6, 0.2)
    expect(r.x).toBeCloseTo(r.y, 6)
  })
  it('ramps from 0 at the deadzone edge', () => {
    const dz = 0.2
    const justInside = applyRadialDeadzone(0.2001, 0, dz)
    expect(Math.abs(justInside.x)).toBeLessThan(0.01)
  })
  it('handles exact origin without NaN', () => {
    const r = applyRadialDeadzone(0, 0, 0.15)
    expect(r.x).toBe(0)
    expect(r.y).toBe(0)
  })
  it('clamps magnitude to 1 at full deflection', () => {
    const r = applyRadialDeadzone(1, 1, 0.15)
    const mag = Math.hypot(r.x, r.y)
    expect(mag).toBeLessThanOrEqual(1.0001)
  })
})

describe('lookCurve', () => {
  it('is gentle near center', () => {
    expect(Math.abs(lookCurve(0.1))).toBeLessThan(0.1)
  })
  it('preserves sign', () => {
    expect(lookCurve(-0.5)).toBeLessThan(0)
    expect(lookCurve(0.5)).toBeGreaterThan(0)
  })
  it('maps 0→0 and 1→1', () => {
    expect(lookCurve(0)).toBe(0)
    expect(lookCurve(1)).toBeCloseTo(1, 6)
  })
})

function frame(pressed: number[], axes: number[] = [0, 0, 0, 0]): PadFrame {
  const buttons = new Array(16).fill(false)
  for (const i of pressed) buttons[i] = true
  return { buttons, axes }
}

describe('action mapping', () => {
  it('maps standard-layout buttons to actions', () => {
    expect(PAD_ACTION_MAP.interact).toBe(PAD_BUTTON.a)
    expect(PAD_ACTION_MAP.back).toBe(PAD_BUTTON.b)
    expect(PAD_ACTION_MAP.menu).toBe(PAD_BUTTON.y)
    expect(PAD_ACTION_MAP.pause).toBe(PAD_BUTTON.start)
  })
  it('detects a rising edge only once', () => {
    const prev = frame([])
    const cur = frame([PAD_BUTTON.a])
    expect(actionPressed(prev, cur, 'interact')).toBe(true)
    expect(actionPressed(cur, cur, 'interact')).toBe(false) // still held, no new edge
  })
  it('actionHeld reflects current state', () => {
    expect(actionHeld(frame([PAD_BUTTON.a]), 'interact')).toBe(true)
    expect(actionHeld(frame([]), 'interact')).toBe(false)
    expect(actionHeld(null, 'interact')).toBe(false)
  })
  it('handles null previous frame as no-press baseline', () => {
    expect(actionPressed(null, frame([PAD_BUTTON.a]), 'interact')).toBe(true)
  })
})

describe('padActive', () => {
  it('is true when any button is pressed', () => {
    expect(padActive(frame([PAD_BUTTON.x]), 0.15)).toBe(true)
  })
  it('is true when a stick exceeds the deadzone', () => {
    expect(padActive(frame([], [0.5, 0, 0, 0]), 0.15)).toBe(true)
  })
  it('is false at rest', () => {
    expect(padActive(frame([], [0.05, 0.05, 0, 0]), 0.15)).toBe(false)
  })
})
