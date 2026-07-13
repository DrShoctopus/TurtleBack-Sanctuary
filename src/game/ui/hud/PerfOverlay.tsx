import { useEffect, useState } from 'react'
import { useGame } from '../../state/gameStore'
import { runtime } from '../../core/runtime'
import type { SceneProbeSnapshot } from '../../debug/probes'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

function readProbe(): SceneProbeSnapshot | null {
  const debug = (window as unknown as { __turtlebackDebug?: { probe?: () => SceneProbeSnapshot } })
    .__turtlebackDebug
  try {
    return debug?.probe?.() ?? null
  } catch {
    return null
  }
}

/** Development-only performance readout (F3). */
export function PerfOverlay() {
  const on = useGame((s) => s.perfOverlay)
  const [text, setText] = useState('')
  useEffect(() => {
    if (
      !on ||
      !(import.meta.env.DEV || import.meta.env.VITE_TURTLEBACK_DIAGNOSTICS === '1')
    ) {
      return
    }
    const id = window.setInterval(() => {
      const p = runtime.player.pos
      const probe = readProbe()
      setText(
        `fps ${runtime.perf.fps.toFixed(0)}\n` +
          `p95 ${runtime.perf.p95FrameMs.toFixed(1)} ms\n` +
          `quality ${runtime.quality.level}\n` +
          `draws ${probe?.renderer.calls ?? 0} triangles ${probe?.renderer.triangles ?? 0}\n` +
          `cells ${probe?.activeCells.length ?? 0}/${probe?.retainedCells.length ?? 0} active/retained\n` +
          `assets ${probe?.loadedAssetIds.length ?? 0} textures ${formatBytes(probe?.estimatedTextureBytes ?? 0)}\n` +
          `pos ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}\n` +
          `zone ${runtime.player.zone}${runtime.player.indoors ? ' (in)' : ''}\n` +
          `time ${runtime.time.t.toFixed(3)} rain ${runtime.weather.rain.toFixed(2)}\n` +
          `travel ${(runtime.travel.distance / 1000).toFixed(2)} km`,
      )
    }, 300)
    return () => window.clearInterval(id)
  }, [on])
  if (
    !(import.meta.env.DEV || import.meta.env.VITE_TURTLEBACK_DIAGNOSTICS === '1') ||
    !on
  ) {
    return null
  }
  return <div className="perf-overlay">{text}</div>
}
