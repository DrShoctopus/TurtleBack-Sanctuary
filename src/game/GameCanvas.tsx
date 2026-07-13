import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { PCFSoftShadowMap } from 'three'
import { HOME_SPAWN, PLAYER, WORLD } from './config/constants'
import { EndFrame, FrameDriver } from './core/FrameDriver'
import { PlayerController } from './player/PlayerController'
import { TurtleWorld } from './world/TurtleWorld'
import { useGame } from './state/gameStore'
import { QUALITY_PROFILES, resolveCanvasDpr } from './core/quality'
import { useSettings } from './state/settingsStore'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { configureRendererColor } from './rendering/colorContract'
import { useDevicePixelRatio } from './core/devicePixelRatio'

export function GameCanvas() {
  const autoQuality = useGame((s) => s.autoQuality)
  const choice = useSettings((s) => s.graphics.quality)
  const level = choice === 'auto' ? autoQuality : choice
  const profile = QUALITY_PROFILES[level]
  const devicePixelRatio = useDevicePixelRatio()
  const dpr = resolveCanvasDpr(devicePixelRatio, profile)

  return (
    <Canvas
      shadows={{ enabled: true, type: PCFSoftShadowMap }}
      dpr={dpr}
      camera={{
        fov: PLAYER.fovDefault,
        near: 0.12,
        far: 2800,
        position: [HOME_SPAWN.x, HOME_SPAWN.y + 1.7, HOME_SPAWN.z],
      }}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        stencil: false,
        alpha: false,
      }}
      onCreated={({ gl }) => {
        configureRendererColor(gl)
        const canvas = gl.domElement
        canvas.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          useGame.getState().setWebglLost(true)
        })
        canvas.addEventListener('webglcontextrestored', () => {
          useGame.getState().setWebglLost(false)
        })
      }}
    >
      <color attach="background" args={['#0d1a26']} />
      <FrameDriver />
      <Suspense fallback={null}>
        <Physics gravity={[0, WORLD.gravity, 0]} timeStep="vary">
          <PlayerController />
          <TurtleWorld />
          <SceneReadyProbe />
        </Physics>
      </Suspense>
      <SanctuaryPostProcessing bloomAllowed={profile.bloomAllowed} />
      <EndFrame />
    </Canvas>
  )
}

function SanctuaryPostProcessing({ bloomAllowed }: { bloomAllowed: boolean }) {
  const enabled = useSettings((s) => s.graphics.bloom)
  if (!enabled || !bloomAllowed) return null
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        mipmapBlur
        intensity={0.22}
        luminanceThreshold={0.88}
        luminanceSmoothing={0.28}
        radius={0.5}
      />
    </EffectComposer>
  )
}

/** Mounts only after rapier + world children resolved; flips the boot screen. */
function SceneReadyProbe() {
  const setSceneReady = useGame((s) => s.setSceneReady)
  useEffect(() => {
    const id = window.setTimeout(() => setSceneReady(true), 80)
    return () => window.clearTimeout(id)
  }, [setSceneReady])
  return null
}
