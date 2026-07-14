import { useEffect, type RefObject } from 'react'
import type { MenuNavEvent } from '../../input/InputManager'
import { events } from '../../core/events'

function navItems(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-nav]')).filter((el) => {
    if ((el as HTMLButtonElement).disabled) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  })
}

/** Programmatically nudge a range input so React onChange still fires. */
function stepRange(el: HTMLInputElement, dir: 1 | -1): void {
  const min = Number(el.min || 0)
  const max = Number(el.max || 100)
  const step = Number(el.step || 1)
  const next = Math.min(max, Math.max(min, Number(el.value) + dir * step))
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, String(next))
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * Keyboard + gamepad navigation for a menu container.
 * Up/Down (or dpad/stick) moves focus through [data-nav] elements;
 * Left/Right adjusts a focused slider; confirm clicks; back closes.
 */
export function useMenuNav(
  ref: RefObject<HTMLElement | null>,
  opts: { onBack?: () => void; onTab?: (dir: 1 | -1) => void; autoFocus?: boolean },
): void {
  const { onBack, onTab, autoFocus = true } = opts
  useEffect(() => {
    const container = ref.current
    if (!container) return
    if (autoFocus) {
      const preferred = container.querySelector<HTMLElement>('[data-nav-default]')
      ;(preferred ?? navItems(container)[0])?.focus()
    }

    const move = (dir: 1 | -1) => {
      const list = navItems(container)
      if (list.length === 0) return
      const active = document.activeElement as HTMLElement | null
      let idx = active ? list.indexOf(active) : -1
      idx = idx === -1 ? (dir === 1 ? 0 : list.length - 1) : (idx + dir + list.length) % list.length
      list[idx].focus()
      list[idx].scrollIntoView({ block: 'nearest' })
      events.emit('uiSound', { kind: 'move' })
    }

    const horizontal = (dir: 1 | -1) => {
      const active = document.activeElement as HTMLElement | null
      if (active instanceof HTMLInputElement && active.type === 'range') {
        stepRange(active, dir)
        events.emit('uiSound', { kind: 'soft' })
        return
      }
      // inside a segmented control, move between siblings
      const seg = active?.closest('.seg')
      if (seg && active) {
        const btns = Array.from(seg.querySelectorAll<HTMLElement>('button'))
        const i = btns.indexOf(active)
        if (i !== -1) {
          const next = btns[(i + dir + btns.length) % btns.length]
          next.focus()
          events.emit('uiSound', { kind: 'move' })
          return
        }
      }
      move(dir)
    }

    const confirm = () => {
      const active = document.activeElement as HTMLElement | null
      if (!active || !container.contains(active)) return
      events.emit('uiSound', { kind: 'confirm' })
      active.click()
    }

    const onNavEvent = (e: Event) => {
      const { kind } = (e as CustomEvent<MenuNavEvent>).detail
      switch (kind) {
        case 'up':
          move(-1)
          break
        case 'down':
          move(1)
          break
        case 'left':
          horizontal(-1)
          break
        case 'right':
          horizontal(1)
          break
        case 'confirm':
          confirm()
          break
        case 'back':
          events.emit('uiSound', { kind: 'back' })
          onBack?.()
          break
        case 'tabL':
          onTab?.(-1)
          break
        case 'tabR':
          onTab?.(1)
          break
      }
    }

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement
          ? target.type === 'text' || target.type === 'url'
          : target instanceof HTMLTextAreaElement
      if (typing) return
      switch (e.code) {
        case 'ArrowUp':
          e.preventDefault()
          move(-1)
          break
        case 'ArrowDown':
          e.preventDefault()
          move(1)
          break
        case 'ArrowLeft':
          e.preventDefault()
          horizontal(-1)
          break
        case 'ArrowRight':
          e.preventDefault()
          horizontal(1)
          break
        case 'PageUp':
          e.preventDefault()
          onTab?.(-1)
          break
        case 'PageDown':
          e.preventDefault()
          onTab?.(1)
          break
      }
    }

    window.addEventListener('menu-nav', onNavEvent)
    container.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('menu-nav', onNavEvent)
      container.removeEventListener('keydown', onKey)
    }
  }, [ref, onBack, onTab, autoFocus])
}
