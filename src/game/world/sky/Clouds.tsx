import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, Color, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import { runtime } from '../../core/runtime'
import { lerp } from '../../core/mathUtils'
import { useQualityProfile } from '../../core/useQualityProfile'
import { ComfortMotionClock } from '../../core/comfortMotion'

/**
 * A noise-shader cloud shell just inside the sky dome. Coverage follows
 * weather; colors follow the sun so dawn/dusk tint the cloud bellies.
 */
export function Clouds() {
  const quality = useQualityProfile()
  const matRef = useRef<ShaderMaterial>(null)
  const motionClock = useRef(new ComfortMotionClock())
  const geometry = useMemo(() => new SphereGeometry(1350, 36, 20), [])
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTravel: { value: 0 },
      uCoverage: { value: 0.35 },
      uLight: { value: new Color('#ffffff') },
      uShade: { value: new Color('#80a2b8') },
      uSunDir: { value: new Vector3(0, 1, 0) },
      uDetail: { value: 1 },
    }),
    [],
  )

  useFrame((_, dt) => {
    const material = matRef.current
    if (!material) return
    const live = material.uniforms
    const motionTime = motionClock.current.advance(dt, runtime.reducedMotion)
    live.uTime.value = motionTime
    live.uTravel.value = motionTime * runtime.travel.speed
    const rain = runtime.weather.rain
    const night = runtime.time.celest.nightFactor
    live.uCoverage.value = lerp(0.32, 0.78, rain)
    const c = runtime.time.celest
    live.uSunDir.value.set(c.sunDir[0], c.sunDir[1], c.sunDir[2])
    live.uLight.value
      .setRGB(1, 0.98, 0.95)
      .multiplyScalar(lerp(1, 0.25, night) * lerp(1, 0.75, rain))
    live.uShade.value.setRGB(0.52, 0.58, 0.68).multiplyScalar(lerp(1, 0.22, night))
    live.uDetail.value = quality.cloudDetail
  })

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={-98}>
      <shaderMaterial
        ref={matRef}
        name="CloudsMaterial"
        transparent
        depthWrite={false}
        side={BackSide}
        fog={false}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
      />
    </mesh>
  )
}

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`

const FRAG = /* glsl */ `
varying vec3 vDir;
uniform float uTime;
uniform float uTravel;
uniform float uCoverage;
uniform vec3 uLight;
uniform vec3 uShade;
uniform vec3 uSunDir;
uniform float uDetail;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p, float oct) {
  float a = 0.5;
  float s = 0.0;
  float n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= oct) break;
    s += vnoise(p) * a;
    n += a;
    a *= 0.5;
    p *= 2.13;
  }
  return s / max(n, 0.001);
}

void main() {
  vec3 dir = normalize(vDir);
  if (dir.y < 0.02) discard;
  // project onto a virtual cloud plane
  vec2 uv = dir.xz / (dir.y + 0.22);
  uv *= 1.9;
  uv.y += uTravel * 0.004;
  uv.x += uTime * 0.006;
  float oct = 3.0 + uDetail;
  float n = fbm(uv, oct);
  float cover = smoothstep(1.0 - uCoverage, 1.0 - uCoverage + 0.34, n);
  if (cover < 0.01) discard;
  float horizonFade = smoothstep(0.03, 0.2, dir.y);
  // light clouds toward the sun
  float lit = clamp(dot(dir, normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uShade, uLight, lit * 0.7 + n * 0.3);
  float alpha = cover * horizonFade * 0.82;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
