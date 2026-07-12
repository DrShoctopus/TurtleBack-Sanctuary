import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Color,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from 'three'
import { runtime } from '../../core/runtime'
import { FOG_COLOR, SKY_HORIZON, SKY_TOP, SUN_COLOR, sampleColor } from '../sky/palette'

const OCEAN_SIZE = 2600

/**
 * Endless Gerstner-wave ocean. The mesh follows the player snapped to its own
 * grid; wave phases scroll with travel distance so the turtle appears to swim
 * forward while physics stays at the origin.
 */
export function Ocean() {
  const meshRef = useRef<Mesh>(null)
  const segments = runtime.quality.oceanSegments
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, segments, segments)
    g.rotateX(-Math.PI / 2)
    return g
  }, [segments])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTravel: { value: 0 },
      uOffset: { value: new Vector3() },
      uCamPos: { value: new Vector3() },
      uSunDir: { value: new Vector3(0, 1, 0) },
      uMoonDir: { value: new Vector3(0, -1, 0) },
      uSunColor: { value: new Color('#fff6e4') },
      uSkyTop: { value: new Color('#79b4e2') },
      uHorizon: { value: new Color('#e2f1f6') },
      uFogColor: { value: new Color('#cfe3ea') },
      uFogDensity: { value: 0.0016 },
      uNight: { value: 0 },
      uRain: { value: 0 },
      uDetail: { value: 1 },
      uMotion: { value: 1 },
    }),
    [],
  )

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return
    const p = runtime.player.pos
    const grid = OCEAN_SIZE / segments
    mesh.position.set(Math.round(p.x / grid) * grid, 0, Math.round(p.z / grid) * grid)
    uniforms.uOffset.value.copy(mesh.position)
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uTravel.value = runtime.travel.distance
    uniforms.uCamPos.value.copy(state.camera.position)
    const c = runtime.time.celest
    uniforms.uSunDir.value.set(c.sunDir[0], c.sunDir[1], c.sunDir[2])
    uniforms.uMoonDir.value.set(c.moonDir[0], c.moonDir[1], c.moonDir[2])
    sampleColor(uniforms.uSunColor.value, SUN_COLOR, c.t)
    sampleColor(uniforms.uSkyTop.value, SKY_TOP, c.t)
    sampleColor(uniforms.uHorizon.value, SKY_HORIZON, c.t)
    sampleColor(uniforms.uFogColor.value, FOG_COLOR, c.t)
    uniforms.uNight.value = c.nightFactor
    uniforms.uRain.value = runtime.weather.rain
    uniforms.uFogDensity.value = 0.0015 + c.nightFactor * 0.001 + runtime.weather.rain * 0.0022
    uniforms.uDetail.value = runtime.quality.oceanDetail
    uniforms.uMotion.value = runtime.reducedMotion ? 0.18 : 1
  })

  return (
    <>
      <mesh ref={meshRef} geometry={geometry} frustumCulled={false} renderOrder={-90}>
        <shaderMaterial uniforms={uniforms} vertexShader={VERT} fragmentShader={FRAG} fog={false} />
      </mesh>
      <EdgeLappingWaves />
    </>
  )
}

/** One translucent elliptical veil for readable, calm foam at every shell edge. */
function EdgeLappingWaves() {
  const geometry = useMemo(() => {
    const ring = new RingGeometry(1.095, 1.29, 256, 12)
    ring.rotateX(-Math.PI / 2)
    return ring
  }, [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: DoubleSide,
        fog: false,
        uniforms: {
          uTime: { value: 0 },
          uNight: { value: 0 },
          uRain: { value: 0 },
          uMotion: { value: 1 },
        },
        vertexShader: EDGE_VERT,
        fragmentShader: EDGE_FRAG,
      }),
    [],
  )

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uNight.value = runtime.time.celest.nightFactor
    material.uniforms.uRain.value = runtime.weather.rain
    material.uniforms.uMotion.value = runtime.reducedMotion ? 0.1 : 1
  })

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, 0.16, 0]}
      scale={[170, 1, 250]}
      frustumCulled={false}
      renderOrder={-89}
    />
  )
}

const EDGE_VERT = /* glsl */ `
varying vec2 vRingPos;
uniform float uTime;
uniform float uMotion;

void main() {
  vRingPos = vec2(position.x, -position.z);
  vec3 transformed = position;
  float angle = atan(vRingPos.y, vRingPos.x);
  transformed.y += sin(angle * 3.0 - uTime * 0.18 * uMotion) * 0.035;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`

const EDGE_FRAG = /* glsl */ `
varying vec2 vRingPos;
uniform float uTime;
uniform float uNight;
uniform float uRain;
uniform float uMotion;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float radius = length(vRingPos);
  float angle = atan(vRingPos.y, vRingPos.x);
  float travel = uTime * 0.045 * uMotion;
  float noise = hash21(vec2(floor(angle * 11.0), floor(travel * 3.0)));
  float curl = sin(angle * 5.0 - travel * 3.2 + noise * 2.4) * 0.006;
  float bandA = exp(-pow((radius - 1.132 - curl) * 118.0, 2.0));
  float bandB = exp(-pow((radius - 1.182 + curl * 0.6) * 84.0, 2.0));
  float bandC = exp(-pow((radius - 1.248 - curl * 0.35) * 62.0, 2.0));
  float broken = smoothstep(0.18, 0.78,
    0.5 + 0.32 * sin(angle * 13.0 + travel * 2.0) +
    0.18 * sin(angle * 29.0 - travel * 1.3 + noise * 4.0));
  float alpha = (bandA * 0.62 + bandB * 0.4 + bandC * 0.22) *
                mix(0.72, 1.0, broken) * (1.0 - uRain * 0.42);
  if (alpha < 0.008) discard;
  vec3 dayFoam = vec3(0.46, 0.82, 0.76);
  vec3 nightFoam = vec3(0.12, 0.38, 0.4);
  gl_FragColor = vec4(mix(dayFoam, nightFoam, uNight), alpha);
  #include <colorspace_fragment>
}
`

const VERT = /* glsl */ `
uniform float uTime;
uniform float uTravel;
uniform vec3 uOffset;
uniform float uMotion;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vCrest;

// Four gerstner waves: direction (xy), steepness, wavelength
const vec4 W0 = vec4(0.22, 0.98, 0.14, 96.0);
const vec4 W1 = vec4(-0.55, 0.83, 0.10, 55.0);
const vec4 W2 = vec4(0.95, 0.31, 0.08, 27.0);
const vec4 W3 = vec4(-0.35, -0.94, 0.06, 14.0);

vec3 gerstner(vec4 w, vec2 p, float t, inout vec3 tangent, inout vec3 binormal) {
  vec2 d = normalize(w.xy);
  float k = 6.28318 / w.w;
  float c = sqrt(9.8 / k);
  float f = k * (dot(d, p) - c * t);
  float a = w.z / k;
  float sf = sin(f);
  float cf = cos(f);
  tangent += vec3(-d.x * d.x * w.z * sf, d.x * w.z * cf, -d.x * d.y * w.z * sf);
  binormal += vec3(-d.x * d.y * w.z * sf, d.y * w.z * cf, -d.y * d.y * w.z * sf);
  return vec3(d.x * a * cf, a * sf, d.y * a * cf);
}

void main() {
  vec3 base = position + uOffset;
  // the world flows past the stationary turtle: shift the sampled field by travel
  vec2 p = vec2(base.x, base.z + uTravel);
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  vec3 disp = vec3(0.0);
  float t = uTime * max(0.08, uMotion);
  disp += gerstner(W0, p, t, tangent, binormal);
  disp += gerstner(W1, p, t, tangent, binormal);
  disp += gerstner(W2, p, t, tangent, binormal);
  disp += gerstner(W3, p, t, tangent, binormal);
  // calm the water immediately around the shell so the waterline stays gentle
  float dTurtle = length(vec2(base.x / 210.0, base.z / 290.0));
  float calm = smoothstep(0.85, 1.35, dTurtle);
  disp *= mix(0.14, 1.0, calm);
  vec3 pos = vec3(base.x + disp.x, disp.y, base.z + disp.z);
  vWorldPos = pos;
  vNormal = normalize(cross(binormal, tangent));
  vCrest = disp.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}
`

const FRAG = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vCrest;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunColor;
uniform vec3 uSkyTop;
uniform vec3 uHorizon;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uNight;
uniform float uRain;
uniform float uTime;
uniform float uTravel;
uniform float uDetail;
uniform float uMotion;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec3 N = normalize(vNormal);
  vec2 flow = vec2(vWorldPos.x, vWorldPos.z + uTravel);

  // procedural detail normal (skipped on low quality)
  if (uDetail > 0.5) {
    float e = 0.6;
    float n0 = vnoise(flow * 0.35 + uTime * 0.06);
    float nx = vnoise((flow + vec2(e, 0.0)) * 0.35 + uTime * 0.06);
    float nz = vnoise((flow + vec2(0.0, e)) * 0.35 + uTime * 0.06);
    vec3 dn = vec3((n0 - nx) * 1.2, 1.0, (n0 - nz) * 1.2);
    // rain pocks the surface
    if (uRain > 0.01) {
      float r0 = vnoise(flow * 2.3 + uTime * 1.7);
      float rx = vnoise((flow + vec2(e * 0.3, 0.0)) * 2.3 + uTime * 1.7);
      float rz = vnoise((flow + vec2(0.0, e * 0.3)) * 2.3 + uTime * 1.7);
      dn.xz += vec2(r0 - rx, r0 - rz) * 2.2 * uRain;
    }
    N = normalize(N + normalize(dn) - vec3(0.0, 1.0, 0.0));
  }

  vec3 V = normalize(uCamPos - vWorldPos);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 5.0);
  fresnel = 0.04 + 0.72 * fresnel;

  // water body color: deep teal → soft shallow near the turtle
  vec3 deep = mix(vec3(0.02, 0.09, 0.13), vec3(0.006, 0.02, 0.045), uNight);
  vec3 shallow = mix(vec3(0.05, 0.2, 0.23), vec3(0.01, 0.05, 0.09), uNight);
  float dTurtle = length(vec2(vWorldPos.x / 230.0, vWorldPos.z / 310.0));
  float shellR = length(vec2(vWorldPos.x / 170.0, vWorldPos.z / 250.0));
  vec3 body = mix(shallow, deep, smoothstep(0.7, 1.6, dTurtle));
  float shoreline = exp(-pow((shellR - 1.035) * 11.5, 2.0));
  vec3 edgeTint = mix(vec3(0.07, 0.29, 0.29), vec3(0.018, 0.11, 0.14), uNight);
  body = mix(body, edgeTint, shoreline * (0.38 + (1.0 - uRain) * 0.28));

  // sky reflection approximation
  vec3 R = reflect(-V, N);
  float up = clamp(R.y, 0.0, 1.0);
  vec3 skyRef = mix(uHorizon, uSkyTop, pow(up, 0.6));
  skyRef *= mix(0.82, 0.9, uNight);
  skyRef = mix(skyRef, skyRef * vec3(0.75, 0.82, 0.92), uRain * 0.5);

  float edgeFresnel = fresnel * (1.0 - shoreline * 0.44);
  vec3 col = mix(body, skyRef, edgeFresnel);

  // A faint aurora reflection in the northern water at night. This is not a
  // mirror; it is a wide, broken colour path shaped by the moving surface.
  float northReflection = smoothstep(-0.15, 0.65, R.z) * smoothstep(0.02, 0.42, R.y);
  float auroraRipple = 0.5 + 0.5 * sin(flow.x * 0.032 + vnoise(flow * 0.018) * 7.0 + uTime * 0.035 * uMotion);
  vec3 auroraWater = mix(vec3(0.08, 0.62, 0.48), vec3(0.34, 0.2, 0.72), auroraRipple);
  col += auroraWater * northReflection * auroraRipple * uNight * (1.0 - uRain) * 0.075;

  // sun glitter path
  float specPow = mix(340.0, 60.0, uRain);
  float sunSpec = pow(max(dot(R, normalize(uSunDir)), 0.0), specPow);
  col += uSunColor * sunSpec * (1.2 - uNight) * (1.0 - uRain * 0.5);
  // moon glitter
  float moonSpec = pow(max(dot(R, normalize(uMoonDir)), 0.0), 420.0);
  col += vec3(0.68, 0.78, 0.92) * moonSpec * uNight * 0.32;

  // foam: wave crests + the churned ring around the turtle body
  float crestFoam = smoothstep(0.75, 1.35, vCrest) * 0.5;
  float ring = exp(-pow((shellR - 1.055) * 26.0, 2.0));
  float wake = ring * (0.18 + 0.42 * vnoise(flow * 0.48 + uTime * 0.14 * uMotion));
  wake += shoreline * 0.14 * (1.0 - uRain * 0.3);
  // Slow lapping bands travel around the shell perimeter. From the viewing
  // decks these read as calm waves folding into the turtle's wake.
  float edgeAngle = atan(vWorldPos.z / 250.0, vWorldPos.x / 170.0);
  float lapPhase = uTime * 0.115 * uMotion + edgeAngle * 1.75 + vnoise(flow * 0.021) * 1.65;
  float edgeRadius = 1.025 + sin(lapPhase) * 0.008;
  float lapA = exp(-pow((shellR - edgeRadius) * 82.0, 2.0));
  float lapB = exp(-pow((shellR - edgeRadius - 0.032) * 70.0, 2.0));
  float lapC = exp(-pow((shellR - edgeRadius - 0.068) * 56.0, 2.0));
  float foamNoise = vnoise(flow * 0.09 + vec2(uTime * 0.018 * uMotion, edgeAngle));
  float strand = 0.5 + 0.5 * sin(edgeAngle * 8.0 - uTime * 0.07 * uMotion + foamNoise * 4.0);
  float lapBreak = smoothstep(0.22, 0.62, foamNoise * 0.68 + strand * 0.32);
  wake += (lapA * 0.66 + lapB * 0.38 + lapC * 0.18) * lapBreak * (1.0 - uRain * 0.42);
  // A translucent jade line just below the foam gives the shell edge depth.
  col += mix(vec3(0.08, 0.34, 0.31), vec3(0.04, 0.16, 0.2), uNight) *
         shoreline * (0.028 + lapBreak * 0.025);
  // bow push at the head (head sits toward -z)
  float bow = exp(-length(vec2(vWorldPos.x * 0.02, (vWorldPos.z + 300.0) * 0.012)));
  wake += bow * vnoise(flow * 0.8 + uTime * 0.35) * 0.9;
  float foam = clamp(crestFoam + wake, 0.0, 1.0);
  vec3 foamCol = mix(vec3(0.82, 0.94, 0.91), vec3(0.25, 0.32, 0.42), uNight);
  col = mix(col, foamCol, foam * 0.82);

  // distance fog
  float dist = length(uCamPos - vWorldPos);
  float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFogColor, clamp(f, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`
