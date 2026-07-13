import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { updatePlayerZone } from '../village/zones'
import { applySimpleWetness } from '../weather/simpleWet'
import { runtime } from '../core/runtime'
import { events } from '../core/events'
import { terrainHeight } from './shell/shellShape'

interface TurtlebackDebug {
  teleport: (x: number, z: number, yaw?: number, pitch?: number) => void
  player: () => { x: number; y: number; z: number; yaw: number }
}

/**
 * Low-frequency world housekeeping that doesn't belong to any single object:
 * zone tracking (throttled) and exterior material wetness updates.
 */
export function WorldSystems() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const portraitCamera = useRef(false)
  useEffect(() => {
    if (import.meta.env.DEV) {
      const devWindow = window as unknown as Record<string, unknown>
      const teleport = (x: number, z: number, yaw = 0, pitch = 0) => {
        events.emit('teleport', {
          x,
          y: terrainHeight(x, z) + 0.08,
          z,
          yaw,
          reason: 'debug',
        })
        runtime.player.pitch = pitch
      }
      devWindow.__scene = scene
      devWindow.__turtlebackDebug = {
        teleport,
        player: () => ({
          x: runtime.player.pos.x,
          y: runtime.player.pos.y,
          z: runtime.player.pos.z,
          yaw: runtime.player.yaw,
        }),
      } satisfies TurtlebackDebug
      const onBenchmarkKey = (event: KeyboardEvent) => {
        if (!event.altKey) return
        if (event.shiftKey && event.code === 'Digit1') teleport(0, -202, 0, -0.08)
        else if (event.shiftKey && event.code === 'Digit2') teleport(123, 60, -Math.PI / 2, -0.08)
        else if (event.shiftKey && event.code === 'Digit3') teleport(5.2, 219, Math.PI, -0.12)
        else if (event.shiftKey && event.code === 'Digit4') teleport(-127, -31, Math.PI / 2, -0.08)
        else if (event.shiftKey && event.code === 'Digit7') teleport(-52, 91, 0, -0.1)
        else if (event.shiftKey && event.code === 'Digit9') teleport(0, 151, Math.PI, -0.08)
        else if (event.code === 'Digit1') teleport(0, -238, 0, -0.25)
        else if (event.code === 'Digit2') teleport(166, 58, -Math.PI / 2, -0.55)
        else if (event.code === 'Digit3') teleport(2, 232, Math.PI, -0.18)
        else if (event.code === 'Digit4') teleport(-166, -24, Math.PI / 2, -0.55)
        else if (event.code === 'Digit5') portraitCamera.current = true
        else if (event.code === 'Digit6') teleport(0, -60, Math.PI, -0.04)
        else if (event.code === 'Digit7') teleport(-54, 98, 0, -0.08)
        else if (event.code === 'Digit8') teleport(70, 43, -2.18, -0.04)
        else if (event.code === 'Digit9') teleport(-110, -38, -2.77, -0.04)
        else if (event.code === 'Digit0') portraitCamera.current = false
        else return
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
    if (import.meta.env.DEV && portraitCamera.current) {
      camera.position.set(0, 7.5, -336)
      camera.lookAt(0, 4.5, -295)
    }
  })
  return null
}
