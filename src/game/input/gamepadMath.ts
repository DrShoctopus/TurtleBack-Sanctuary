/** Pure gamepad processing — deadzones, curves, standard-layout mapping. Testable in node. */

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

/** Standard-layout button indices (https://w3c.github.io/gamepad/#remapping). */
export const PAD_BUTTON = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  select: 8,
  start: 9,
  l3: 10,
  r3: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const

export type PadButtonName = keyof typeof PAD_BUTTON

export type PadAction =
  | 'interact'
  | 'back'
  | 'secondary'
  | 'menu'
  | 'tabL'
  | 'tabR'
  | 'interactAlt'
  | 'map'
  | 'pause'
  | 'jog'
  | 'jump'
  | 'navUp'
  | 'navDown'
  | 'navLeft'
  | 'navRight'

/** Default button → action map. */
export const PAD_ACTION_MAP: Record<PadAction, number> = {
  interact: PAD_BUTTON.a,
  back: PAD_BUTTON.b,
  secondary: PAD_BUTTON.x,
  jump: PAD_BUTTON.x, // X doubles as jump while walking (no secondary target)
  menu: PAD_BUTTON.y,
  tabL: PAD_BUTTON.lb,
  tabR: PAD_BUTTON.rb,
  interactAlt: PAD_BUTTON.rt,
  map: PAD_BUTTON.select,
  pause: PAD_BUTTON.start,
  jog: PAD_BUTTON.l3,
  navUp: PAD_BUTTON.up,
  navDown: PAD_BUTTON.down,
  navLeft: PAD_BUTTON.left,
  navRight: PAD_BUTTON.right,
}

export interface PadFrame {
  buttons: boolean[]
  axes: number[]
}

/** Rising-edge detection between two frames for a given action. */
export function actionPressed(prev: PadFrame | null, cur: PadFrame, action: PadAction): boolean {
  const idx = PAD_ACTION_MAP[action]
  const now = cur.buttons[idx] ?? false
  const before = prev?.buttons[idx] ?? false
  return now && !before
}

export function actionHeld(cur: PadFrame | null, action: PadAction): boolean {
  if (!cur) return false
  return cur.buttons[PAD_ACTION_MAP[action]] ?? false
}

/** Any button pressed or stick moved beyond deadzone → used for device detection. */
export function padActive(frame: PadFrame, deadzone: number): boolean {
  if (frame.buttons.some(Boolean)) return true
  for (let i = 0; i < Math.min(4, frame.axes.length); i++) {
    if (Math.abs(frame.axes[i]) > Math.max(0.2, deadzone)) return true
  }
  return false
}
