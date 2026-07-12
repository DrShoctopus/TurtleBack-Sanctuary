import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { runtime } from '../../core/runtime'
import { SKY_HORIZON, SKY_TOP, SUN_COLOR, sampleColor } from './palette'
import { mulberry32 } from '../../core/rng'

const DOME_RADIUS = 1500

export function SkyDome() {
  const matRef = useRef<ShaderMaterial>(null)
  const geometry = useMemo(() => new SphereGeometry(DOME_RADIUS, 40, 24), [])
  const uniforms = useMemo(
    () => ({
      uTop: { value: new Color('#79b4e2') },
      uHorizon: { value: new Color('#e2f1f6') },
      uSunDir: { value: new Vector3(0, 1, 0) },
      uMoonDir: { value: new Vector3(0, -1, 0) },
      uSunColor: { value: new Color('#fff6e4') },
      uNight: { value: 0 },
      uRain: { value: 0 },
      uMoonPhase: { value: 0 },
      uTime: { value: 0 },
      uAurora: { value: 0 },
      uMotion: { value: 1 },
    }),
    [],
  )

  useFrame((state) => {
    const c = runtime.time.celest
    sampleColor(uniforms.uTop.value, SKY_TOP, c.t)
    sampleColor(uniforms.uHorizon.value, SKY_HORIZON, c.t)
    sampleColor(uniforms.uSunColor.value, SUN_COLOR, c.t)
    uniforms.uSunDir.value.set(c.sunDir[0], c.sunDir[1], c.sunDir[2])
    uniforms.uMoonDir.value.set(c.moonDir[0], c.moonDir[1], c.moonDir[2])
    uniforms.uNight.value = c.nightFactor
    uniforms.uMoonPhase.value = c.moonPhaseVisible
    uniforms.uRain.value = runtime.weather.rain
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uAurora.value =
      c.nightFactor *
      c.nightFactor *
      (1 - runtime.weather.rain * 0.92) *
      (runtime.quality.level === 'low' ? 0.78 : 1.35)
    uniforms.uMotion.value = runtime.reducedMotion ? 0.16 : 1
  })

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={-100}>
      <shaderMaterial
        ref={matRef}
        side={BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={SKY_VERT}
        fragmentShader={SKY_FRAG}
      />
    </mesh>
  )
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 pos = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * pos;
  gl_Position.z = gl_Position.w * 0.99999; // pin to far plane
}
`

const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunColor;
uniform float uNight;
uniform float uRain;
uniform float uMoonPhase;
uniform float uTime;
uniform float uAurora;
uniform float uMotion;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  vec3 dir = normalize(vDir);
  float h = max(dir.y, 0.0);
  float belowH = clamp(-dir.y * 4.0, 0.0, 1.0);
  float grad = pow(1.0 - h, 1.7);
  vec3 col = mix(uTop, uHorizon, grad);
  // below the horizon fade into a deep haze so the ocean seam is soft
  col = mix(col, uHorizon * 0.72, belowH);

  float sd = dot(dir, uSunDir);
  // warm halo around the sun
  float halo = pow(max(sd, 0.0), 18.0) * 0.35 + pow(max(sd, 0.0), 90.0) * 0.5;
  col += uSunColor * halo * (1.0 - uNight);
  // sun disc
  float disc = smoothstep(0.99955, 0.99985, sd);
  col += uSunColor * disc * 4.0 * (1.0 - uNight * 0.9);

  // moon: cool disc with soft limb + halo
  float md = dot(dir, uMoonDir);
  float mdisc = smoothstep(0.99962, 0.99987, md);
  float mhalo = pow(max(md, 0.0), 160.0) * 0.35;
  vec3 moonCol = vec3(0.82, 0.88, 0.98);
  col += (moonCol * mdisc * 1.6 + moonCol * mhalo) * uMoonPhase;

  // A broad, translucent aurora curtain in the northern sky. It is deliberately
  // low-frequency and slow so it reads as a breathing atmosphere, not an effect.
  float north = 0.5 + 0.5 * smoothstep(-0.75, 0.3, dir.z);
  float auroraHeight = smoothstep(0.08, 0.2, dir.y) * (1.0 - smoothstep(0.82, 0.98, dir.y));
  float azimuth = atan(dir.x, max(0.02, dir.z));
  float drift = uTime * 0.018 * uMotion;
  float broadNoise = noise21(vec2(azimuth * 1.2 + drift, dir.y * 3.1 - drift * 0.4));
  float foldA = sin(azimuth * 7.0 + broadNoise * 3.2 + drift * 2.0);
  float foldB = sin(azimuth * 11.0 - dir.y * 5.0 - drift * 1.4);
  float curtain = pow(clamp(0.5 + 0.32 * foldA + 0.18 * foldB, 0.0, 1.0), 2.4);
  curtain *= 0.55 + 0.45 * noise21(vec2(azimuth * 3.0 - drift, dir.y * 7.0));
  float lowerVeil = exp(-pow((dir.y - 0.28 - foldA * 0.035) * 7.5, 2.0));
  float upperVeil = exp(-pow((dir.y - 0.53 - foldB * 0.028) * 9.0, 2.0));
  float auroraAlpha = (curtain * 0.62 + lowerVeil * 0.82 + upperVeil * 0.44) * north * auroraHeight * uAurora;
  float flowingBand = (0.5 + 0.5 * sin(azimuth * 5.5 + broadNoise * 2.4 + drift)) *
                      smoothstep(0.05, 0.18, dir.y) * (1.0 - smoothstep(0.7, 0.92, dir.y));
  auroraAlpha = max(auroraAlpha, flowingBand * north * uAurora * 0.34);
  vec3 auroraGreen = vec3(0.18, 0.92, 0.67);
  vec3 auroraViolet = vec3(0.45, 0.32, 0.92);
  vec3 auroraColor = mix(auroraGreen, auroraViolet, smoothstep(0.42, 0.78, dir.y) + broadNoise * 0.12);
  col += auroraColor * (auroraAlpha * 1.08 + auroraHeight * uAurora * 0.075);

  // rain mutes and cools everything
  float g = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(g) * vec3(0.82, 0.88, 0.96), uRain * 0.55);
  col *= 1.0 - uRain * 0.18;

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`

/** Twinkling star field, faded in by nightFactor. */
export function Stars() {
  const ref = useRef<Points>(null)
  const { geometry, material } = useMemo(() => buildStars(), [])
  useFrame((state) => {
    const m = material as ShaderMaterial
    m.uniforms.uOpacity.value =
      runtime.time.celest.starIntensity * (1 - runtime.weather.rain * 0.85)
    m.uniforms.uTime.value = state.clock.elapsedTime
  })
  return (
    <points
      ref={ref}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={-99}
    />
  )
}

function buildStars() {
  const rng = mulberry32(4242)
  const count = 1500
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const sizes = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    // hemisphere distribution, biased upward
    const theta = rng() * Math.PI * 2
    const y = 0.06 + Math.pow(rng(), 0.7) * 0.94
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const R = DOME_RADIUS * 0.96
    positions[i * 3] = Math.cos(theta) * r * R
    positions[i * 3 + 1] = y * R
    positions[i * 3 + 2] = Math.sin(theta) * r * R
    seeds[i] = rng() * 100
    sizes[i] = 1 + Math.pow(rng(), 3) * 2.6
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1))
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute float aSize;
      varying float vTwinkle;
      uniform float uTime;
      void main() {
        vTwinkle = 0.6 + 0.4 * sin(uTime * (0.6 + fract(aSeed) * 1.8) + aSeed);
        vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vTwinkle;
      uniform float uOpacity;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.12, length(d));
        gl_FragColor = vec4(vec3(0.92, 0.95, 1.0), a * uOpacity * vTwinkle);
      }
    `,
  })
  return { geometry, material }
}
