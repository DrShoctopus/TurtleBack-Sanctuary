import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { updatePlayerZone } from '../village/zones'
import { applySimpleWetness } from '../weather/simpleWet'
import { runtime } from '../core/runtime'

/**
 * Low-frequency world housekeeping that doesn't belong to any single object:
 * zone tracking (throttled) and exterior material wetness updates.
 */
export function WorldSystems() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__scene = scene
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
  })
  return null
}
