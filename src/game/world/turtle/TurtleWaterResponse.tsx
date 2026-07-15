import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  PlaneGeometry,
  Points,
  ShaderMaterial,
} from 'three'
import { runtime } from '../../core/runtime'
import { useQualityProfile } from '../../core/useQualityProfile'

/** Broad displacement veil plus sparse event spray around the four flippers. */
export function TurtleWaterResponse() {
  const quality = useQualityProfile()
  const wakeMaterial = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uWake: { value: 0.15 },
          uNight: { value: 0 },
          uRain: { value: 0 },
        },
        vertexShader: WAKE_VERT,
        fragmentShader: WAKE_FRAG,
      }),
    [],
  )
  const wakeGeometry = useMemo(() => {
    const geometry = new PlaneGeometry(560, 420, 1, 1)
    geometry.rotateX(-Math.PI / 2)
    return geometry
  }, [])

  useFrame((state) => {
    wakeMaterial.uniforms.uTime.value = state.clock.elapsedTime
    wakeMaterial.uniforms.uWake.value = runtime.turtle.wakeStrength
    wakeMaterial.uniforms.uNight.value = runtime.time.celest.nightFactor
    wakeMaterial.uniforms.uRain.value = runtime.weather.rain
  })

  return (
    <group name="TurtleWaterResponse" userData={{ traversalCollision: false }}>
      <mesh
        name="BroadTurtleDisplacement"
        geometry={wakeGeometry}
        material={wakeMaterial}
        position={[0, 0.34, -64]}
        renderOrder={-87}
        frustumCulled={false}
      />
      <TurtleSpray count={quality.level === 'ultra' ? 72 : quality.level === 'high' ? 48 : 24} />
      <group name="Wake_FL" position={[-198, 0, -92]} />
      <group name="Wake_FR" position={[198, 0, -92]} />
      <group name="Wake_BL" position={[-160, 0, 188]} />
      <group name="Wake_BR" position={[160, 0, 188]} />
    </group>
  )
}

function TurtleSpray({ count }: { count: number }) {
  const pointsRef = useRef<Points>(null)
  const geometry = useMemo(() => {
    const geometry = new BufferGeometry()
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const emitters = [
      [-198, 0.5, -92],
      [198, 0.5, -92],
      [-160, 0.5, 188],
      [160, 0.5, 188],
    ] as const
    for (let index = 0; index < count; index += 1) {
      const emitter = emitters[index % emitters.length]
      positions.set(emitter, index * 3)
      seeds[index] = ((index * 0.618_033_988_75) % 1) + (index % 4) * 0.013
    }
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
    return geometry
  }, [count])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uSpray: { value: 0 } },
        vertexShader: SPRAY_VERT,
        fragmentShader: SPRAY_FRAG,
      }),
    [],
  )

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uSpray.value = runtime.turtle.sprayStrength
    if (pointsRef.current) pointsRef.current.visible = runtime.turtle.sprayStrength > 0.015
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
}

const WAKE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const WAKE_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uWake;
uniform float uNight;
uniform float uRain;

float ellipse(vec2 point, vec2 center, vec2 scale) {
  return length((point - center) / scale);
}

void main() {
  vec2 p = vUv;
  float phase = uTime * 0.055;
  float bowDistance = ellipse(p, vec2(0.5, 0.02), vec2(0.24, 0.16));
  float bowBands = sin(bowDistance * 54.0 - phase * 8.0) * 0.5 + 0.5;
  float bowFade = exp(-bowDistance * 2.9) * smoothstep(0.12, 0.7, bowDistance);

  float leftFront = ellipse(p, vec2(0.15, 0.42), vec2(0.13, 0.23));
  float rightFront = ellipse(p, vec2(0.85, 0.42), vec2(0.13, 0.23));
  float frontBands =
    (exp(-leftFront * 2.2) * (0.45 + 0.55 * sin(leftFront * 48.0 - phase * 11.0))) +
    (exp(-rightFront * 2.2) * (0.45 + 0.55 * sin(rightFront * 48.0 - phase * 10.0)));
  float wake = max(bowBands * bowFade, frontBands * 0.7) * uWake;
  wake *= 1.0 - uRain * 0.45;
  if (wake < 0.015) discard;
  vec3 day = vec3(0.72, 0.91, 0.86);
  vec3 night = vec3(0.18, 0.35, 0.42);
  gl_FragColor = vec4(mix(day, night, uNight), wake * 0.48);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const SPRAY_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uSpray;
varying float vAlpha;
void main() {
  float phase = fract(uTime * 0.22 + aSeed);
  float side = mod(floor(aSeed * 1000.0), 2.0) * 2.0 - 1.0;
  vec3 transformed = position;
  transformed.x += side * phase * (4.0 + fract(aSeed * 31.0) * 11.0) * uSpray;
  transformed.z += (phase - 0.5) * (8.0 + fract(aSeed * 17.0) * 14.0) * uSpray;
  transformed.y += sin(phase * 3.14159) * (5.0 + fract(aSeed * 53.0) * 10.0) * uSpray;
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_PointSize = (3.0 + fract(aSeed * 71.0) * 4.0) * uSpray * (120.0 / -mvPosition.z);
  vAlpha = sin(phase * 3.14159) * uSpray;
  gl_Position = projectionMatrix * mvPosition;
}
`

const SPRAY_FRAG = /* glsl */ `
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  gl_FragColor = vec4(0.78, 0.94, 0.9, (1.0 - d * 2.0) * vAlpha * 0.8);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
