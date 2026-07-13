import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { updatePlayerZone } from '../village/zones'
import { applySimpleWetness } from '../weather/simpleWet'
import { runtime } from '../core/runtime'
import { events } from '../core/events'
import { terrainHeight } from './shell/shellShape'
import {
  BENCHMARKS,
  BENCHMARK_SHORTCUTS,
  isBenchmarkId,
  type BenchmarkId,
  type FixedBenchmark,
} from '../config/benchmarks'

interface TurtlebackDebug {
  teleport: (x: number, z: number, yaw?: number, pitch?: number) => void
  benchmark: (id: string) => boolean
  benchmarks: () => BenchmarkId[]
  player: () => { x: number; y: number; z: number; yaw: number }
}

/**
 * Low-frequency world housekeeping that doesn't belong to any single object:
 * zone tracking (throttled) and exterior material wetness updates.
 */
export function WorldSystems() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const fixedCamera = useRef<FixedBenchmark | null>(null)
  useEffect(() => {
    if (import.meta.env.DEV) {
      const devWindow = window as unknown as Record<string, unknown>
      const teleport = (x: number, z: number, yaw = 0, pitch = 0) => {
        fixedCamera.current = null
        events.emit('teleport', {
          x,
          y: terrainHeight(x, z) + 0.08,
          z,
          yaw,
          reason: 'debug',
        })
        runtime.player.pitch = pitch
      }
      const benchmark = (id: string) => {
        if (!isBenchmarkId(id)) return false
        const view = BENCHMARKS[id]
        if (view.mode === 'fixed') fixedCamera.current = view
        else teleport(view.x, view.z, view.yaw, view.pitch)
        return true
      }
      devWindow.__scene = scene
      devWindow.__turtlebackDebug = {
        teleport,
        benchmark,
        benchmarks: () => Object.keys(BENCHMARKS) as BenchmarkId[],
        player: () => ({
          x: runtime.player.pos.x,
          y: runtime.player.pos.y,
          z: runtime.player.pos.z,
          yaw: runtime.player.yaw,
        }),
      } satisfies TurtlebackDebug
      const onBenchmarkKey = (event: KeyboardEvent) => {
        if (!event.altKey) return
        if (event.code === 'Digit0' && !event.shiftKey) {
          fixedCamera.current = null
          event.preventDefault()
          return
        }
        const shortcut = `${event.shiftKey ? 'Shift+' : ''}${event.code}`
        const id = BENCHMARK_SHORTCUTS[shortcut]
        if (!id) return
        benchmark(id)
        event.preventDefault()
      }
      window.addEventListener('keydown', onBenchmarkKey)
      return () => {
        window.removeEventListener('keydown', onBenchmarkKey)
        delete devWindow.__scene
        delete devWindow.__turtlebackDebug
      }
    }
  }, [scene])
  let zoneAcc = 0
  useFrame((_, dt) => {
    zoneAcc += dt
    if (zoneAcc >= 0.25) {
      zoneAcc = 0
      updatePlayerZone()
    }
    applySimpleWetness(runtime.weather.wetness)
    if (import.meta.env.DEV && fixedCamera.current) {
      const view = fixedCamera.current
      camera.position.set(...view.position)
      camera.lookAt(...view.lookAt)
    }
  })
  return null
}
