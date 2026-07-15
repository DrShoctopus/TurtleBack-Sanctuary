import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  MeshPhysicalMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
} from 'three'
import { BUILDINGS } from '../config/layout'
import { ComfortMotionClock } from '../core/comfortMotion'
import { runtime } from '../core/runtime'
import type { QualityLevel } from '../core/quality'
import { useQualityProfile } from '../core/useQualityProfile'
import { useSettings } from '../state/settingsStore'
import { registerProbeSection } from '../debug/probes'
import { terrainHeight } from '../world/shell/shellShape'
import { makePuddleAnchors, makeRoofDripAnchors, selectEvenly } from './atmosphereLayout'
import {
  atmosphereConditionAt,
  lightRayOpacityAt,
  mistOpacityAt,
  wetSurfaceResponse,
} from './atmosphereArtDirection'

const RIM_MIST_BASE_COUNT: Readonly<Record<QualityLevel, number>> = {
  low: 6,
  medium: 10,
  high: 14,
  ultra: 18,
}
const ROOF_DRIPS_PER_BUILDING: Readonly<Record<QualityLevel, number>> = {
  low: 3,
  medium: 7,
  high: 12,
  ultra: 16,
}
const PUDDLE_VISIBLE_CAP: Readonly<Record<QualityLevel, number>> = {
  low: 5,
  medium: 9,
  high: Number.POSITIVE_INFINITY,
  ultra: Number.POSITIVE_INFINITY,
}
const PUDDLE_SEGMENTS: Readonly<Record<QualityLevel, number>> = {
  low: 28,
  medium: 28,
  high: 48,
  ultra: 64,
}
const LIGHT_RAY_COUNT: Readonly<Record<QualityLevel, number>> = {
  low: 4,
  medium: 6,
  high: 8,
  ultra: 10,
}

const LIGHT_RAY_ANCHORS = [
  { x: -34, z: -154, yaw: 0.42, scale: 1.2 },
  { x: -102, z: -62, yaw: -0.58, scale: 0.92 },
  { x: -50, z: 72, yaw: 0.22, scale: 1.05 },
  { x: 42, z: -10, yaw: -0.76, scale: 0.84 },
  { x: 72, z: -172, yaw: 0.7, scale: 1.18 },
  { x: 2, z: 142, yaw: -0.16, scale: 1.08 },
  { x: 92, z: 68, yaw: 0.98, scale: 0.8 },
  { x: -116, z: 18, yaw: -0.92, scale: 0.94 },
  { x: 26, z: -92, yaw: 0.08, scale: 0.75 },
  { x: -78, z: 118, yaw: 0.56, scale: 0.9 },
] as const

/** Low-draw-call weather depth: rim mist, roof runoff and reflective puddles. */
export function AtmosphereDetails() {
  const quality = useQualityProfile()
  useEffect(
    () =>
      registerProbeSection('atmosphere', 'authored-weather-composition', () => ({
        condition: atmosphereConditionAt(runtime.time.t, runtime.weather.rain),
        cloudLayers: 2,
        mistLayers: RIM_MIST_BASE_COUNT[quality.level],
        lightRayCount: LIGHT_RAY_COUNT[quality.level],
        puddleCount: Math.min(
          PUDDLE_VISIBLE_CAP[quality.level],
          makePuddleAnchors(BUILDINGS).length,
        ),
        wetness: runtime.weather.wetness,
        puddleOpacity: wetSurfaceResponse(runtime.weather.wetness).puddleOpacity,
        windowLightResponse: 'day-dusk-night' as const,
        oceanResponse: 'clear-rain-turtle-wake' as const,
      })),
    [quality.level],
  )
  return (
    <>
      <RimMist />
      <LightRays />
      <RoofDrips />
      <PuddleSheen />
    </>
  )
}

function RimMist() {
  const quality = useQualityProfile()
  const density = useSettings((state) => state.graphics.particleDensity)
  const baseCount = RIM_MIST_BASE_COUNT[quality.level]
  const count = Math.max(3, Math.round(baseCount * density))
  const meshRef = useRef<InstancedMesh>(null)
  const materialRef = useRef<ShaderMaterial>(null)
  const motionClock = useRef(new ComfortMotionClock())
  const geometry = useMemo(() => new PlaneGeometry(58, 12, 8, 2), [])
  const dummy = useMemo(() => new Object3D(), [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      dummy.position.set(Math.cos(a) * 172, 9.7 + Math.sin(a * 3.1) * 0.8, Math.sin(a) * 253)
      dummy.rotation.set(0, Math.PI / 2 - a, 0)
      dummy.scale.set(0.85 + (i % 3) * 0.12, 0.8 + (i % 2) * 0.18, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [count, dummy])

  useFrame((_, dt) => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uTime.value = motionClock.current.advance(dt, runtime.reducedMotion, 0.08)
    material.uniforms.uNight.value = runtime.time.celest.nightFactor
    material.uniforms.uOpacity.value = mistOpacityAt(
      runtime.weather.rain,
      runtime.time.celest.nightFactor,
    )
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      frustumCulled={false}
      renderOrder={-4}
    >
      <shaderMaterial
        ref={materialRef}
        name="RimMistMaterial"
        transparent
        depthWrite={false}
        side={DoubleSide}
        uniforms={{
          uTime: { value: 0 },
          uNight: { value: 0 },
          uOpacity: { value: 0.062 },
          uColor: { value: new Color('#8db8b2') },
        }}
        vertexShader={MIST_VERT}
        fragmentShader={MIST_FRAG}
      />
    </instancedMesh>
  )
}

function LightRays() {
  const quality = useQualityProfile()
  const count = LIGHT_RAY_COUNT[quality.level]
  const meshRef = useRef<InstancedMesh>(null)
  const materialRef = useRef<ShaderMaterial>(null)
  const motionClock = useRef(new ComfortMotionClock())
  const geometry = useMemo(() => new PlaneGeometry(9.5, 34, 2, 6), [])
  const dummy = useMemo(() => new Object3D(), [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    LIGHT_RAY_ANCHORS.slice(0, count).forEach((anchor, index) => {
      dummy.position.set(anchor.x, terrainHeight(anchor.x, anchor.z) + 15, anchor.z)
      dummy.rotation.set(-0.08, anchor.yaw, index % 2 === 0 ? -0.13 : 0.09)
      dummy.scale.set(anchor.scale, 0.86 + (index % 3) * 0.12, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [count, dummy])

  useFrame((_, dt) => {
    const material = materialRef.current
    if (!material) return
    const c = runtime.time.celest
    material.uniforms.uTime.value = motionClock.current.advance(dt, runtime.reducedMotion, 0.06)
    material.uniforms.uOpacity.value = lightRayOpacityAt(
      c.dayFactor,
      c.duskFactor,
      runtime.weather.rain,
    )
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      frustumCulled={false}
      renderOrder={-3}
    >
      <shaderMaterial
        ref={materialRef}
        name="PainterlyLightRayMaterial"
        transparent
        depthWrite={false}
        side={DoubleSide}
        uniforms={{
          uTime: { value: 0 },
          uOpacity: { value: 0.045 },
          uColor: { value: new Color('#f0c98c') },
        }}
        vertexShader={LIGHT_RAY_VERT}
        fragmentShader={LIGHT_RAY_FRAG}
      />
    </instancedMesh>
  )
}

function RoofDrips() {
  const quality = useQualityProfile()
  const density = useSettings((state) => state.graphics.particleDensity)
  const basePerBuilding = ROOF_DRIPS_PER_BUILDING[quality.level]
  const perBuilding = Math.max(1, Math.round(basePerBuilding * density))
  const materialRef = useRef<ShaderMaterial>(null)
  const motionClock = useRef(new ComfortMotionClock())
  const geometry = useMemo(() => {
    const anchors = makeRoofDripAnchors(BUILDINGS, perBuilding)
    const positions = new Float32Array(anchors.length * 3)
    const seeds = new Float32Array(anchors.length)
    const falls = new Float32Array(anchors.length)
    anchors.forEach((anchor, i) => {
      positions[i * 3] = anchor.x
      positions[i * 3 + 1] = anchor.y
      positions[i * 3 + 2] = anchor.z
      seeds[i] = anchor.seed
      falls[i] = anchor.fall
    })
    const next = new BufferGeometry()
    next.setAttribute('position', new BufferAttribute(positions, 3))
    next.setAttribute('aSeed', new BufferAttribute(seeds, 1))
    next.setAttribute('aFall', new BufferAttribute(falls, 1))
    return next
  }, [perBuilding])

  useFrame((_, dt) => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uTime.value = motionClock.current.advance(dt, runtime.reducedMotion, 0.14)
    material.uniforms.uRain.value = runtime.weather.rain
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        name="RoofDripMaterial"
        transparent
        depthWrite={false}
        uniforms={{ uTime: { value: 0 }, uRain: { value: 0 } }}
        vertexShader={DRIP_VERT}
        fragmentShader={DRIP_FRAG}
      />
    </points>
  )
}

function PuddleSheen() {
  const meshRef = useRef<InstancedMesh>(null)
  const materialRef = useRef<MeshPhysicalMaterial>(null)
  const quality = useQualityProfile()
  const anchors = useMemo(() => makePuddleAnchors(BUILDINGS), [])
  const visibleCount = Math.min(PUDDLE_VISIBLE_CAP[quality.level], anchors.length)
  const visibleAnchors = useMemo(() => selectEvenly(anchors, visibleCount), [anchors, visibleCount])
  const geometry = useMemo(
    () => new CircleGeometry(1, PUDDLE_SEGMENTS[quality.level]),
    [quality.level],
  )
  const dummy = useMemo(() => new Object3D(), [])

  useFrame(() => {
    const mesh = meshRef.current
    const material = materialRef.current
    if (!mesh || !material) return
    const wetness = runtime.weather.wetness
    mesh.visible = wetness > 0.03
    const response = wetSurfaceResponse(wetness)
    material.opacity = response.puddleOpacity
    material.roughness = response.puddleRoughness
  })

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    visibleAnchors.forEach((anchor, i) => {
      dummy.position.set(anchor.x, anchor.y, anchor.z)
      dummy.rotation.set(-Math.PI / 2, 0, anchor.rotation)
      dummy.scale.set(anchor.scaleX, anchor.scaleZ, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [dummy, visibleAnchors])

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, visibleCount]} renderOrder={2}>
      <meshPhysicalMaterial
        ref={materialRef}
        name="PuddleSheenMaterial"
        color="#557f7e"
        roughness={0.3}
        metalness={0.08}
        clearcoat={quality.reflections > 0 ? 1 : 0}
        clearcoatRoughness={0.08}
        transparent
        opacity={0}
        depthWrite={false}
      />
    </instancedMesh>
  )
}

const MIST_VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    vUv = uv;
    vSeed = fract(abs(instanceMatrix[3].x * 0.017 + instanceMatrix[3].z * 0.013));
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`

const MIST_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uNight;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vSeed;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1)), f.x), f.y);
  }
  void main() {
    vec2 p = vec2(vUv.x * 3.2 + uTime * 0.018 + vSeed, vUv.y * 2.0);
    float cloud = noise(p) * 0.62 + noise(p * 2.1 + 4.7) * 0.38;
    float edge = smoothstep(0.0, 0.24, vUv.y) * (1.0 - smoothstep(0.66, 1.0, vUv.y));
    edge *= smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
    float alpha = edge * smoothstep(0.28, 0.82, cloud) * uOpacity;
    gl_FragColor = vec4(mix(uColor, vec3(0.34,0.48,0.53), uNight * 0.42), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const LIGHT_RAY_VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    vUv = uv;
    vSeed = fract(abs(instanceMatrix[3].x * 0.019 + instanceMatrix[3].z * 0.011));
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`

const LIGHT_RAY_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vSeed;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  void main() {
    float side = smoothstep(0.0, 0.2, vUv.x) * (1.0 - smoothstep(0.8, 1.0, vUv.x));
    float vertical = smoothstep(0.0, 0.17, vUv.y) * (1.0 - smoothstep(0.78, 1.0, vUv.y));
    float grain = 0.68 + hash(vec2(floor(vUv.y * 10.0 + uTime * 0.08), vSeed)) * 0.32;
    float split = 0.72 + 0.28 * sin((vUv.x + vSeed) * 17.0 + uTime * 0.025);
    float alpha = side * vertical * grain * split * uOpacity;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const DRIP_VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aFall;
  uniform float uTime;
  uniform float uRain;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float cycle = fract(uTime * (0.62 + aSeed * 0.55) + aSeed * 8.0);
    p.y -= cycle * aFall;
    vAlpha = step(aSeed * 0.82, uRain) * sin(cycle * 3.14159) * uRain;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.4 + aSeed) * (170.0 / max(1.0, -mv.z));
  }
`

const DRIP_FRAG = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float drop = smoothstep(0.5, 0.08, length(vec2(d.x * 2.2, d.y)));
    gl_FragColor = vec4(0.68, 0.84, 0.92, drop * vAlpha * 0.72);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
