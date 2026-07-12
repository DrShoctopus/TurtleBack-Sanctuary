import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../state/gameStore'
import { useSettings, reducedMotionEnabled } from '../../state/settingsStore'

const PHASES = [
  { label: 'Breathe in', dur: 4.2, from: 0.62, to: 1 },
  { label: 'Hold', dur: 3.2, from: 1, to: 1 },
  { label: 'Breathe out', dur: 5.8, from: 1, to: 0.62 },
  { label: 'Rest', dur: 1.6, from: 0.62, to: 0.62 },
]

/** Gentle guided-breathing pulse. Dismiss with any input. Not medical advice — a comfort aid. */
export function BreathingOverlay() {
  const breathing = useGame((s) => s.breathing)
  const setBreathing = useGame((s) => s.setBreathing)
  const [label, setLabel] = useState(PHASES[0].label)
  const circleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!breathing) return
    let raf = 0
    let phase = 0
    let t0 = performance.now()
    const settings = useSettings.getState()
    const reduced = reducedMotionEnabled(settings)
    setLabel(PHASES[0].label)
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - t0 > 400) {
        const pads = navigator.getGamepads?.() ?? []
        const padInput = Array.from(pads).some(
          (pad) =>
            pad &&
            (pad.buttons.some((button) => button.pressed) ||
              pad.axes.some((axis) => Math.abs(axis) > 0.35)),
        )
        if (padInput) {
          setBreathing(false)
          return
        }
      }
      const p = PHASES[phase]
      const t = (now - t0) / 1000 / p.dur
      if (t >= 1) {
        phase = (phase + 1) % PHASES.length
        t0 = now
        setLabel(PHASES[phase].label)
        return
      }
      const ease = t * t * (3 - 2 * t)
      const s = p.from + (p.to - p.from) * ease
      const el = circleRef.current
      if (el) {
        if (reduced) {
          el.style.transform = 'scale(1)'
          el.style.opacity = String(0.35 + s * 0.5)
        } else {
          el.style.transform = `scale(${s})`
          el.style.opacity = '0.9'
        }
      }
    }
    raf = requestAnimationFrame(loop)
    const dismiss = () => setBreathing(false)
    window.addEventListener('keydown', dismiss)
    window.addEventListener('pointerdown', dismiss)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', dismiss)
      window.removeEventListener('pointerdown', dismiss)
    }
  }, [breathing, setBreathing])

  if (!breathing) return null
  return (
    <div className="breath-overlay" role="img" aria-label="Guided breathing pulse">
      <div ref={circleRef} className="breath-circle" />
      <div className="breath-label">{label}</div>
    </div>
  )
}
