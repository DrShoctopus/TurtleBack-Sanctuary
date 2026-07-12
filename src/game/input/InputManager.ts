import { events } from '../core/events'
import { useGame } from '../state/gameStore'
import { useSettings } from '../state/settingsStore'
import {
  actionHeld,
  actionPressed,
  applyRadialDeadzone,
  lookCurve,
  padActive,
  type PadAction,
  type PadFrame,
} from './gamepadMath'

export type KeyAction =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jog'
  | 'jump'
  | 'interact'
  | 'menu'
  | 'home'
  | 'map'
  | 'perf'

const KEY_BINDINGS: Record<string, KeyAction> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'jog',
  ShiftRight: 'jog',
  Space: 'jump',
  KeyE: 'interact',
  KeyM: 'menu',
  KeyH: 'home',
  Tab: 'map',
  F3: 'perf',
}

export type MenuNavEvent = {
  kind: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'tabL' | 'tabR'
}

/**
 * Aggregates keyboard + gamepad into game actions. One instance for the app.
 * update() is driven from the render loop; menus receive synthetic nav events.
 */
class InputManager {
  private keysDown = new Set<KeyAction>()
  private keyPressedQueue = new Set<KeyAction>()
  private keyPressTimes = new Map<KeyAction, number>()
  private mouseDX = 0
  private mouseDY = 0
  private padPrev: PadFrame | null = null
  private padCur: PadFrame | null = null
  private padIndex: number | null = null
  private navHold: { kind: MenuNavEvent['kind']; t: number; repeats: number } | null = null
  private attached = false
  jogToggled = false

  attach(): void {
    if (this.attached || typeof window === 'undefined') return
    this.attached = true
    window.addEventListener('keydown', this.onKeyDown, { capture: false })
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('blur', this.clearAll)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearAll()
    })
    window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
      this.padIndex = e.gamepad.index
      useGame.getState().setPadConnected(true)
      useGame.getState().notify('Controller connected')
    })
    window.addEventListener('gamepaddisconnected', (e: GamepadEvent) => {
      if (this.padIndex === e.gamepad.index) {
        this.padIndex = null
        this.padPrev = this.padCur = null
        useGame.getState().setPadConnected(false)
        useGame.getState().setDevice('kb')
        useGame.getState().notify('Controller disconnected')
      }
    })
    events.on('padRumble', ({ strength, ms }) => this.rumble(strength, ms))
  }

  private isTypingTarget(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null
    if (!t) return false
    const tag = t.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isTypingTarget(e)) return
    const action = KEY_BINDINGS[e.code]
    const g = useGame.getState()
    // keep browser focus/scroll behavior out of gameplay keys
    if (action && (g.phase === 'playing' || g.phase === 'title')) {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
    }
    useGame.getState().setDevice('kb')
    if (!action) return
    if (e.repeat) return
    this.keysDown.add(action)
    this.keyPressedQueue.add(action)
    // time-stamped edge: consumable for a short window regardless of the exact
    // frame the keydown lands on, so a press is never dropped by endFrame().
    this.keyPressTimes.set(action, performance.now())
  }

  private onKeyUp = (e: KeyboardEvent) => {
    const action = KEY_BINDINGS[e.code]
    if (action) this.keysDown.delete(action)
  }

  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement) {
      this.mouseDX += e.movementX
      this.mouseDY += e.movementY
    }
  }

  private clearAll = () => {
    this.keysDown.clear()
    this.keyPressedQueue.clear()
    this.keyPressTimes.clear()
    this.mouseDX = 0
    this.mouseDY = 0
  }

  /** Poll pads, generate device + menu-nav events. Call once per frame. */
  update(dt: number): void {
    if (document.hidden) return
    const pads =
      typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []
    let pad: Gamepad | null = null
    if (this.padIndex !== null && pads[this.padIndex]) pad = pads[this.padIndex]
    else {
      for (const p of pads) {
        if (p && p.connected) {
          pad = p
          this.padIndex = p.index
          if (!useGame.getState().padConnected) useGame.getState().setPadConnected(true)
          break
        }
      }
    }
    this.padPrev = this.padCur
    if (pad) {
      this.padCur = {
        buttons: pad.buttons.map((b) => b.pressed),
        axes: [...pad.axes],
      }
      const dz = useSettings.getState().input.deadzone
      if (padActive(this.padCur, dz)) useGame.getState().setDevice('pad')
    } else {
      this.padCur = null
    }
    this.updateMenuNav(dt)
  }

  /** Menu navigation events from pad while an overlay is open. */
  private updateMenuNav(dt: number): void {
    const g = useGame.getState()
    const menuOpen = g.overlay !== null || g.phase === 'title'
    if (!menuOpen || !this.padCur) {
      this.navHold = null
      return
    }
    const dz = Math.max(0.3, useSettings.getState().input.deadzone)
    const ax = this.padCur.axes[0] ?? 0
    const ay = this.padCur.axes[1] ?? 0
    let dir: MenuNavEvent['kind'] | null = null
    if (actionHeld(this.padCur, 'navUp') || ay < -dz) dir = 'up'
    else if (actionHeld(this.padCur, 'navDown') || ay > dz) dir = 'down'
    else if (actionHeld(this.padCur, 'navLeft') || ax < -dz) dir = 'left'
    else if (actionHeld(this.padCur, 'navRight') || ax > dz) dir = 'right'

    if (dir) {
      if (!this.navHold || this.navHold.kind !== dir) {
        this.navHold = { kind: dir, t: 0, repeats: 0 }
        this.dispatchNav(dir)
      } else {
        this.navHold.t += dt
        const delay = this.navHold.repeats === 0 ? 0.4 : 0.13
        if (this.navHold.t >= delay) {
          this.navHold.t = 0
          this.navHold.repeats++
          this.dispatchNav(dir)
        }
      }
    } else if (this.navHold && ['up', 'down', 'left', 'right'].includes(this.navHold.kind)) {
      this.navHold = null
    }

    if (this.padPressed('interact')) this.dispatchNav('confirm')
    if (this.padPressed('back')) this.dispatchNav('back')
    if (this.padPressed('tabL')) this.dispatchNav('tabL')
    if (this.padPressed('tabR')) this.dispatchNav('tabR')
  }

  private dispatchNav(kind: MenuNavEvent['kind']): void {
    window.dispatchEvent(new CustomEvent<MenuNavEvent>('menu-nav', { detail: { kind } }))
  }

  /** Movement vector in local space: x = strafe right, y = forward. */
  getMove(): { x: number; y: number } {
    let x = 0
    let y = 0
    if (this.keysDown.has('forward')) y += 1
    if (this.keysDown.has('back')) y -= 1
    if (this.keysDown.has('right')) x += 1
    if (this.keysDown.has('left')) x -= 1
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2
      x *= inv
      y *= inv
    }
    if (this.padCur) {
      const dz = useSettings.getState().input.deadzone
      const stick = applyRadialDeadzone(this.padCur.axes[0] ?? 0, this.padCur.axes[1] ?? 0, dz)
      if (Math.abs(stick.x) + Math.abs(stick.y) > 0.01) {
        x = stick.x
        y = -stick.y
      }
    }
    return { x, y }
  }

  /** Look delta in radians for this frame (mouse accumulated + pad rate * dt). */
  getLook(dt: number): { dx: number; dy: number } {
    const s = useSettings.getState().input
    let dx = this.mouseDX * 0.0021 * s.mouseSens
    let dy = this.mouseDY * 0.0021 * s.mouseSens
    this.mouseDX = 0
    this.mouseDY = 0
    if (this.padCur) {
      const stick = applyRadialDeadzone(
        this.padCur.axes[2] ?? 0,
        this.padCur.axes[3] ?? 0,
        s.deadzone,
      )
      dx += lookCurve(stick.x) * 2.4 * s.padSens * dt
      dy += lookCurve(stick.y) * 1.7 * s.padSens * dt
    }
    if (s.invertY) dy = -dy
    return { dx, dy }
  }

  jogHeld(): boolean {
    if (this.keysDown.has('jog')) return true
    if (this.padPressed('jog')) this.jogToggled = !this.jogToggled
    return this.jogToggled
  }

  keyHeld(action: KeyAction): boolean {
    return this.keysDown.has(action)
  }

  /** Rising-edge check for keyboard actions (consumes). Time-buffered ~180ms. */
  consumeKey(action: KeyAction): boolean {
    const t = this.keyPressTimes.get(action)
    if (t !== undefined && performance.now() - t < 180) {
      this.keyPressTimes.delete(action)
      this.keyPressedQueue.delete(action)
      return true
    }
    return false
  }

  padPressed(action: PadAction): boolean {
    if (!this.padCur) return false
    return actionPressed(this.padPrev, this.padCur, action)
  }

  padHeld(action: PadAction): boolean {
    return actionHeld(this.padCur, action)
  }

  /** Clear one-frame state at end of frame. */
  endFrame(): void {
    this.keyPressedQueue.clear()
  }

  rumble(strength: number, ms: number): void {
    if (!useSettings.getState().input.vibration) return
    if (this.padIndex === null) return
    const pad = navigator.getGamepads?.()[this.padIndex]
    const actuator = (pad as (Gamepad & { vibrationActuator?: GamepadHapticActuator }) | null)
      ?.vibrationActuator
    actuator?.playEffect?.('dual-rumble', {
      duration: ms,
      weakMagnitude: strength * 0.5,
      strongMagnitude: strength,
    })
  }
}

export const input = new InputManager()
