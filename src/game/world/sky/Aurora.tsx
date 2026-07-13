import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BackSide, Color, ShaderMaterial, SphereGeometry } from 'three'
import { runtime } from '../../core/runtime'
import { useQualityProfile } from '../../core/useQualityProfile'
import { ComfortMotionClock } from '../../core/comfortMotion'

const AURORA_RADIUS = 1420

/**
 * A continuous spherical aurora veil. All folds are evaluated in sky direction
 * space, so there are no billboard edges or repeated curtain panels as the
 * player turns around the sanctuary.
 */
export function Aurora() {
  const quality = useQualityProfile()
  const motionClock = useRef(new ComfortMotionClock())
  const geometry = useMemo(() => new SphereGeometry(AURORA_RADIUS, 48, 32), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: BackSide,
        blending: AdditiveBlending,
        toneMapped: false,
        fog: false,
        uniforms: {
          uTime: { value: 0 },
          uStrength: { value: 0 },
          uMotion: { value: 1 },
          uDetail: { value: 2 },
          uGreen: { value: new Color('#42e8ae') },
          uCyan: { value: new Color('#60d7dc') },
          uViolet: { value: new Color('#a477e8') },
        },
        vertexShader: AURORA_VERT,
        fragmentShader: AURORA_FRAG,
      }),
    [],
  )

  useFrame((_, dt) => {
    const night = runtime.time.celest.starIntensity
    material.uniforms.uTime.value = motionClock.current.advance(dt, runtime.reducedMotion, 0.08)
    material.uniforms.uMotion.value = 1
    material.uniforms.uDetail.value =
      quality.level === 'low' ? 0 : quality.level === 'medium' ? 1 : 2
    material.uniforms.uStrength.value =
      night *
      night *
      Math.max(0, 1 - runtime.weather.rain * 1.45) *
      (quality.level === 'low' ? 0.4 : quality.level === 'medium' ? 0.58 : 0.72)
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-97} />
}

const AURORA_VERT = /* glsl */ `
varying vec3 vDir;

void main() {
  vDir = normalize(position);
  vec4 pos = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * pos;
}
`

const AURORA_FRAG = /* glsl */ `
varying vec3 vDir;
uniform float uTime;
uniform float uStrength;
uniform float uMotion;
uniform float uDetail;
uniform vec3 uGreen;
uniform vec3 uCyan;
uniform vec3 uViolet;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float value = noise21(p) * 0.56;
  if (uDetail > 0.5) {
    p = mat2(1.62, 1.18, -1.18, 1.62) * p;
    value += noise21(p) * 0.27;
  }
  if (uDetail > 1.5) {
    p = mat2(1.7, 1.12, -1.12, 1.7) * p;
    value += noise21(p) * 0.13;
  }
  return value;
}

float ribbon(float y, float centre, float width) {
  float d = (y - centre) / width;
  return exp(-d * d);
}

void main() {
  vec3 dir = normalize(vDir);
  if (dir.y < 0.035 || uStrength < 0.002) discard;

  float azimuth = atan(dir.x, dir.z);
  float drift = uTime * 0.012 * uMotion;
  float north = smoothstep(-0.88, 0.34, dir.z);
  float horizon = smoothstep(0.055, 0.17, dir.y);
  float zenith = 1.0 - smoothstep(0.78, 0.98, dir.y);

  float broad = fbm(vec2(azimuth * 0.72 + drift * 0.42, dir.y * 2.4 - drift * 0.16));
  float folds = fbm(vec2(azimuth * 2.65 - drift * 0.6, dir.y * 6.2 + drift * 0.2));
  float fine = noise21(vec2(azimuth * 7.8 + drift, dir.y * 12.0 - drift * 0.35));

  // Three independently travelling arcs create depth without duplicating mesh
  // layers. Their centres warp slowly across azimuth and never meet at a seam.
  float centreA = 0.23 + sin(azimuth * 1.7 + drift + broad * 2.1) * 0.07;
  float centreB = 0.42 + sin(azimuth * 1.16 - drift * 0.72 + folds * 1.7) * 0.085;
  float centreC = 0.61 + sin(azimuth * 0.82 + drift * 0.4 + broad * 1.3) * 0.07;
  float bandA = ribbon(dir.y, centreA, 0.058);
  float bandB = ribbon(dir.y, centreB, 0.072);
  float bandC = ribbon(dir.y, centreC, 0.086);

  float verticalFolds = pow(clamp(0.3 + folds * 0.58 + fine * 0.18, 0.0, 1.0), 2.75);
  float strands = 0.48 + 0.52 * pow(0.5 + 0.5 * sin(azimuth * 19.0 + broad * 7.0 + drift * 1.4), 2.0);
  float veil = (bandA * 0.88 + bandB * 0.68 + bandC * 0.52) * verticalFolds;
  veil *= mix(0.62, 1.0, strands);

  // Broader translucent emission integrates the ribbons with surrounding sky.
  float haze = ribbon(dir.y, 0.39 + (broad - 0.5) * 0.12, 0.3) * (0.22 + broad * 0.18);
  float alpha = (veil + haze * 0.045) * north * horizon * zenith * uStrength;
  alpha *= smoothstep(-2.8, -1.55, azimuth) * (1.0 - smoothstep(2.45, 3.05, azimuth));

  float heightMix = smoothstep(0.28, 0.72, dir.y + (broad - 0.5) * 0.12);
  vec3 lowColor = mix(uGreen, uCyan, folds * 0.42);
  vec3 highColor = mix(uCyan, uViolet, 0.38 + fine * 0.42);
  vec3 color = mix(lowColor, highColor, heightMix);
  color *= 0.58 + fine * 0.22;

  gl_FragColor = vec4(color, clamp(alpha * 0.38, 0.0, 0.34));
  #include <colorspace_fragment>
}
`
