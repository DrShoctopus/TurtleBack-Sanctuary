import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { events } from '../../core/events'
import { runtime } from '../../core/runtime'
import { useQualityProfile } from '../../core/useQualityProfile'
import { registerProbeSection } from '../../debug/probes'
import { useSettings } from '../../state/settingsStore'
import { WildlifeDirector } from './WildlifeDirector'
import { InstancedWildlife } from './render/InstancedWildlife'
import type { WildlifeFrame } from './types'

export function WildlifeWorld() {
  const worldSeed = useSettings((state) => state.worldSeed)
  const quietMode = useSettings((state) => state.quietMode)
  const quality = useQualityProfile()
  const director = useMemo(() => new WildlifeDirector(worldSeed), [worldSeed])
  const frameRef = useRef<WildlifeFrame | null>(null)

  useEffect(() => {
    const unregisterWildlife = registerProbeSection('wildlife', 'director', () => ({
      ...director.snapshot(),
      lowHabitatCoverage:
        quality.level !== 'low' ||
        (director.snapshot().habitats.length >= 7 && director.snapshot().categories.length >= 6),
    }))
    const unregisterAudio = registerProbeSection('audio', 'wildlife', () => {
      const snapshot = director.snapshot()
      return {
        wildlifeOwnedCalls: snapshot.ownedCalls,
        wildlifeOrphanCalls: snapshot.orphanCalls,
        wildlifeEmitterCount: snapshot.representedEmitters,
      }
    })
    return () => {
      unregisterAudio()
      unregisterWildlife()
      director.dispose()
    }
  }, [director, quality.level])

  useFrame((_, dt) => {
    const frame = director.update(dt, {
      player: [runtime.player.pos.x, runtime.player.pos.y, runtime.player.pos.z],
      time: runtime.time.t,
      rain: runtime.weather.rain,
      wind: runtime.weather.wind,
      quietMode,
      reducedMotion: runtime.reducedMotion,
    }, quality.wildlife)
    frameRef.current = frame
    for (const call of frame.calls) events.emit('wildlifeCall', call)
  }, -20)

  return (
    <group name="wildlife:director">
      <InstancedWildlife frameRef={frameRef} />
    </group>
  )
}
