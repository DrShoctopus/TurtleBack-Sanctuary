import { useEffect, useState } from 'react'
import { useGame } from '../../state/gameStore'
import { runtime } from '../../core/runtime'

/** Development-only performance readout (F3). */
export function PerfOverlay() {
  const on = useGame((s) => s.perfOverlay)
  const [text, setText] = useState('')
  useEffect(() => {
    if (!on) return
    const id = window.setInterval(() => {
      const p = runtime.player.pos
      setText(
        `fps ${runtime.perf.fps.toFixed(0)}\n` +
          `quality ${runtime.quality.level}\n` +
          `pos ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}\n` +
          `zone ${runtime.player.zone}${runtime.player.indoors ? ' (in)' : ''}\n` +
          `time ${runtime.time.t.toFixed(3)} rain ${runtime.weather.rain.toFixed(2)}\n` +
          `travel ${(runtime.travel.distance / 1000).toFixed(2)} km`,
      )
    }, 300)
    return () => window.clearInterval(id)
  }, [on])
  if (!import.meta.env.DEV || !on) return null
  return <div className="perf-overlay">{text}</div>
}
