/** Engine-neutral input actions and their default desktop bindings. */

export const INPUT_ACTION_IDS = [
  'move_forward',
  'move_backward',
  'move_left',
  'move_right',
  'look_x',
  'look_y',
  'jog',
  'jump',
  'interact',
  'pause',
  'open_sanctuary',
  'open_map',
  'return_home',
  'performance_overlay',
  'menu_up',
  'menu_down',
  'menu_left',
  'menu_right',
  'menu_confirm',
  'menu_back',
  'menu_tab_left',
  'menu_tab_right',
] as const

export type InputActionId = (typeof INPUT_ACTION_IDS)[number]

export const KEYBOARD_ACTION_IDS = [
  'move_forward',
  'move_backward',
  'move_left',
  'move_right',
  'jog',
  'jump',
  'interact',
  'pause',
  'open_sanctuary',
  'open_map',
  'return_home',
  'performance_overlay',
] as const

export type KeyboardActionId = (typeof KEYBOARD_ACTION_IDS)[number]
export type KeyboardBindings = Record<KeyboardActionId, string[]>

export const DEFAULT_KEYBOARD_BINDINGS: KeyboardBindings = {
  move_forward: ['KeyW', 'ArrowUp'],
  move_backward: ['KeyS', 'ArrowDown'],
  move_left: ['KeyA', 'ArrowLeft'],
  move_right: ['KeyD', 'ArrowRight'],
  jog: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  interact: ['KeyE'],
  pause: ['Escape'],
  open_sanctuary: ['KeyM'],
  open_map: ['Tab'],
  return_home: ['KeyH'],
  performance_overlay: ['F3'],
}

export const INPUT_ACTION_LABELS: Record<InputActionId, string> = {
  move_forward: 'Move forward',
  move_backward: 'Move backward',
  move_left: 'Move left',
  move_right: 'Move right',
  look_x: 'Look horizontally',
  look_y: 'Look vertically',
  jog: 'Jog',
  jump: 'Hop',
  interact: 'Interact',
  pause: 'Pause',
  open_sanctuary: 'Open sanctuary settings',
  open_map: 'Open map',
  return_home: 'Return home',
  performance_overlay: 'Performance overlay',
  menu_up: 'Menu up',
  menu_down: 'Menu down',
  menu_left: 'Menu left',
  menu_right: 'Menu right',
  menu_confirm: 'Menu confirm',
  menu_back: 'Menu back',
  menu_tab_left: 'Previous menu tab',
  menu_tab_right: 'Next menu tab',
}

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

export type GamepadBindings = Record<PadAction, number>

export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = {
  interact: PAD_BUTTON.a,
  back: PAD_BUTTON.b,
  secondary: PAD_BUTTON.x,
  jump: PAD_BUTTON.x,
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

export function keyboardActionForCode(
  code: string,
  bindings: KeyboardBindings,
): KeyboardActionId | null {
  for (const action of KEYBOARD_ACTION_IDS) {
    if (bindings[action].includes(code)) return action
  }
  return null
}

export function cloneDefaultKeyboardBindings(): KeyboardBindings {
  return Object.fromEntries(
    KEYBOARD_ACTION_IDS.map((action) => [action, [...DEFAULT_KEYBOARD_BINDINGS[action]]]),
  ) as KeyboardBindings
}

