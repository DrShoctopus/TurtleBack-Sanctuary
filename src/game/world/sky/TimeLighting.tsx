import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Object3D,
  Vector3,
} from 'three'
import { runtime } from '../../core/runtime'
import { SUN_COLOR, hemiIntensityAt, sampleColor, sunIntensityAt } from './palette'
import { useQualityProfile } from '../../core/useQualityProfile'
import { resolveShadowMapSize } from '../../core/quality'
import {
  createPainterlyEnvironmentSample,
  samplePainterlyEnvironment,
} from '../../rendering/painterlyPalette'
import { updatePainterlyMaterialEnvironment } from '../../rendering/painterlyMaterials'
import {
  ambientIntensityAt,
  coolFillIntensityAt,
  moonIntensityAt,
} from '../../weather/atmosphereArtDirection'

/**
 * Sun + moon + hemisphere lighting and scene fog, all driven per-frame from
 * runtime.time. The sun shadow frustum follows the player, snapped to texels.
 */
export function TimeLighting() {
  const quality = useQualityProfile()
  const maxTextureSize = useThree((state) => state.gl.capabilities.maxTextureSize)
  const shadowMapSize = useMemo(
    () => resolveShadowMapSize(quality.shadowMapSize, maxTextureSize),
    [quality.shadowMapSize, maxTextureSize],
  )
  const sunRef = useRef<DirectionalLight>(null)
  const moonRef = useRef<DirectionalLight>(null)
  const fillRef = useRef<DirectionalLight>(null)
  const hemiRef = useRef<HemisphereLight>(null)
  const ambientRef = useRef<AmbientLight>(null)
  const target = useMemo(() => new Object3D(), [])
  const moonTarget = useMemo(() => new Object3D(), [])
  const scene = useThree((s) => s.scene)
  const fog = useMemo(() => new FogExp2('#cfe3ea', 0.0016), [])
  const atmosphere = useMemo(() => createPainterlyEnvironmentSample(), [])
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
    const q = quality
    const sun = sunRef.current
    const moon = moonRef.current
    const fill = fillRef.current
    const hemi = hemiRef.current
    const ambient = ambientRef.current
    const p = runtime.player.pos
    const rain = runtime.weather.rain
    samplePainterlyEnvironment(atmosphere, c.t, rain, c.sunDir)
    updatePainterlyMaterialEnvironment(atmosphere)

    if (sun) {
      // Snap the shadow anchor to a coarse grid so the shadow map doesn't swim.
      const snap = 4
      const ax = Math.round(p.x / snap) * snap
      const az = Math.round(p.z / snap) * snap
      target.position.set(ax, 0, az)
      tmp.set(c.sunDir[0], Math.max(0.03, c.sunDir[1]), c.sunDir[2]).multiplyScalar(190)
      sun.position.set(ax + tmp.x, tmp.y, az + tmp.z)
      sampleColor(sun.color, SUN_COLOR, c.t)
      sun.intensity = sunIntensityAt(c.t) * (1 - rain * 0.62)
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
      if (sun.shadow.mapSize.x !== shadowMapSize) {
        sun.shadow.mapSize.set(shadowMapSize, shadowMapSize)
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
      moon.intensity = moonIntensityAt(c.nightFactor, c.moonPhaseVisible, rain)
    }

    if (fill) {
      fill.target = target
      fill.position.set(p.x - c.sunDir[0] * 120, 74 + c.nightFactor * 32, p.z - c.sunDir[2] * 120)
      fill.color.copy(atmosphere.skyFill)
      fill.intensity = coolFillIntensityAt(c.duskFactor, c.nightFactor, rain)
    }

    if (hemi) {
      hemi.intensity = hemiIntensityAt(c.t) * (1 - rain * 0.12)
      hemi.color.copy(atmosphere.skyFill)
      hemi.groundColor.copy(atmosphere.groundFill)
    }

    if (ambient) {
      ambient.intensity = ambientIntensityAt(c.t, rain)
      ambient.color.copy(atmosphere.skyFill).lerp(atmosphere.highlightTint, 0.24)
    }

    fog.color.copy(atmosphere.fogMid)
    fog.density = atmosphere.fogDensity
    if (scene.background instanceof Color) scene.background.copy(atmosphere.fogFar)
  })

  return (
    <>
      <directionalLight ref={sunRef} castShadow intensity={3} />
      <directionalLight ref={moonRef} intensity={0} color="#8ea7b3" />
      <directionalLight ref={fillRef} intensity={0.22} color="#8fa9ad" />
      <hemisphereLight ref={hemiRef} intensity={0.8} />
      {/* Authored bounce floor: silhouettes stay colored without flattening the key light. */}
      <ambientLight ref={ambientRef} intensity={0.22} color="#77939d" />
    </>
  )
}
