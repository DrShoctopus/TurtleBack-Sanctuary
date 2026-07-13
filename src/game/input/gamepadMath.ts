/** Pure gamepad processing — deadzones, curves, standard-layout mapping. Testable in node. */

import {
  DEFAULT_GAMEPAD_BINDINGS,
  PAD_BUTTON,
  type GamepadBindings,
  type PadAction,
  type PadButtonName,
} from './actions'

export { DEFAULT_GAMEPAD_BINDINGS as PAD_ACTION_MAP, PAD_BUTTON }
export type { PadAction, PadButtonName }

export interface StickValue {
  x: number
  y: number
}

/**
 * Radial deadzone with rescaling: output magnitude ramps smoothly from 0 at the
 * deadzone edge to 1 at full deflection, preserving direction.
 */
export function applyRadialDeadzone(x: number, y: number, deadzone: number): StickValue {
  const mag = Math.hypot(x, y)
  if (mag <= deadzone || mag === 0) return { x: 0, y: 0 }
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone))
  const k = scaled / mag
  return { x: x * k, y: y * k }
}

/** Response curve for look sticks: gentle near center, faster at edge. */
export function lookCurve(v: number, exponent = 1.6): number {
  const s = Math.sign(v)
  return s * Math.pow(Math.abs(v), exponent)
}

export interface PadFrame {
  buttons: boolean[]
  axes: number[]
}

/** Rising-edge detection between two frames for a given action. */
export function actionPressed(
  prev: PadFrame | null,
  cur: PadFrame,
  action: PadAction,
  bindings: GamepadBindings = DEFAULT_GAMEPAD_BINDINGS,
): boolean {
  const idx = bindings[action]
  const now = cur.buttons[idx] ?? false
  const before = prev?.buttons[idx] ?? false
  return now && !before
}

export function actionHeld(
  cur: PadFrame | null,
  action: PadAction,
  bindings: GamepadBindings = DEFAULT_GAMEPAD_BINDINGS,
): boolean {
  if (!cur) return false
  return cur.buttons[bindings[action]] ?? false
}

/** Any button pressed or stick moved beyond deadzone → used for device detection. */
export function padActive(frame: PadFrame, deadzone: number): boolean {
  if (frame.buttons.some(Boolean)) return true
  for (let i = 0; i < Math.min(4, frame.axes.length); i++) {
    if (Math.abs(frame.axes[i]) > Math.max(0.2, deadzone)) return true
  }
  return false
}
