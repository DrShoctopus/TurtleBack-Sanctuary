import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, DirectionalLight, FogExp2, HemisphereLight, Object3D, Vector3 } from 'three'
import { runtime } from '../../core/runtime'
import { FOG_COLOR, SUN_COLOR, hemiIntensityAt, sampleColor, sunIntensityAt } from './palette'
import { lerp } from '../../core/mathUtils'

/**
 * Sun + moon + hemisphere lighting and scene fog, all driven per-frame from
 * runtime.time. The sun shadow frustum follows the player, snapped to texels.
 */
export function TimeLighting() {
  const sunRef = useRef<DirectionalLight>(null)
  const moonRef = useRef<DirectionalLight>(null)
  const hemiRef = useRef<HemisphereLight>(null)
  const target = useMemo(() => new Object3D(), [])
  const moonTarget = useMemo(() => new Object3D(), [])
  const scene = useThree((s) => s.scene)
  const fog = useMemo(() => new FogExp2('#cfe3ea', 0.0016), [])
  const fogColor = useMemo(() => new Color(), [])
  const tmp = useMemo(() => new Vector3(), [])

  useEffect(() => {
    scene.fog = fog
    scene.add(target)
    scene.add(moonTarget)
    return () => {
      scene.fog = null
      scene.remove(target)
      scene.remove(moonTarget)
    }
  }, [scene, fog, target, moonTarget])

  useEffect(() => {
    const sun = sunRef.current
    if (!sun) return
    sun.target = target
    const moon = moonRef.current
    if (moon) moon.target = moonTarget
  }, [target, moonTarget])

  useFrame(() => {
    const c = runtime.time.celest
    const q = runtime.quality
    const sun = sunRef.current
    const moon = moonRef.current
    const hemi = hemiRef.current
    const p = runtime.player.pos

    if (sun) {
      // Snap the shadow anchor to a coarse grid so the shadow map doesn't swim.
      const snap = 4
      const ax = Math.round(p.x / snap) * snap
      const az = Math.round(p.z / snap) * snap
      target.position.set(ax, 0, az)
      tmp.set(c.sunDir[0], Math.max(0.03, c.sunDir[1]), c.sunDir[2]).multiplyScalar(190)
      sun.position.set(ax + tmp.x, tmp.y, az + tmp.z)
      sampleColor(sun.color, SUN_COLOR, c.t)
      sun.intensity = sunIntensityAt(c.t) * (1 - runtime.weather.rain * 0.62)
      sun.castShadow = q.shadowsEnabled && sun.intensity > 0.05
      const cam = sun.shadow.camera
      const ext = q.shadowDistance
      if (cam.right !== ext) {
        cam.left = -ext
        cam.right = ext
        cam.top = ext
        cam.bottom = -ext
        cam.near = 20
        cam.far = 420
        cam.updateProjectionMatrix()
      }
      if (sun.shadow.mapSize.x !== q.shadowMapSize) {
        sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize)
        sun.shadow.map?.dispose()
        sun.shadow.map = null
      }
      sun.shadow.bias = -0.0004
      sun.shadow.normalBias = 0.06
    }

    if (moon) {
      moonTarget.position.set(p.x, 0, p.z)
      moon.position.set(
        p.x + c.moonDir[0] * 180,
        Math.max(8, c.moonDir[1] * 180),
        p.z + c.moonDir[2] * 180,
      )
      moon.intensity = 0.32 * c.moonPhaseVisible * c.nightFactor * (1 - runtime.weather.rain * 0.5)
    }

    if (hemi) {
      hemi.intensity = hemiIntensityAt(c.t) * (1 - runtime.weather.rain * 0.25)
      sampleColor(hemi.color, FOG_COLOR, c.t)
      hemi.color.lerp(SKY_TINT, 0.35)
      hemi.groundColor.setRGB(0.16, 0.14, 0.12)
    }

    // fog: denser at night and in rain, tinted by the cycle
    sampleColor(fogColor, FOG_COLOR, c.t)
    const rain = runtime.weather.rain
    fogColor.lerp(RAIN_FOG, rain * 0.6)
    fog.color.copy(fogColor)
    const base = lerp(0.0015, 0.0026, c.nightFactor)
    fog.density = base + rain * 0.0022
    if (scene.background instanceof Color) scene.background.copy(fogColor)
  })

  return (
    <>
      <directionalLight ref={sunRef} castShadow intensity={3} />
      <directionalLight ref={moonRef} intensity={0} color="#a9c3e8" />
      <hemisphereLight ref={hemiRef} intensity={0.8} />
      {/* faint constant fill so nothing ever reads as pure black */}
      <ambientLight intensity={0.055} color="#8fa8c0" />
    </>
  )
}

const SKY_TINT = new Color('#bcd6e4')
const RAIN_FOG = new Color('#8fa1ad')
