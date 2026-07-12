import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  InstancedMesh,
  Object3D,
  Points,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from 'three'
import { runtime } from '../core/runtime'
import { mulberry32 } from '../core/rng'
import { useSettings } from '../state/settingsStore'

const FALL_HEIGHT = 18
const RADIUS = 26

/**
 * Rain streaks in a recycling cylinder around the camera. GPU-animated fall;
 * the draw call is skipped entirely while rain is zero. Ripple rings pool on
 * the ground near the player.
 */
export function Rain() {
  const maxCount = runtime.quality.rainMax
  const density = useSettings((s) => s.graphics.particleDensity)
  const count = Math.floor(maxCount * Math.max(0.2, density))

  const { geometry, material } = useMemo(() => buildRain(count), [count])
  const pointsRef = useRef<Points>(null)
  const anchor = useMemo(() => new Vector3(), [])

  useFrame((state) => {
    const pts = pointsRef.current
    if (!pts) return
    const rain = runtime.weather.rain
    const indoors = runtime.player.indoors
    pts.visible = rain > 0.02
    if (!pts.visible) return
    const p = runtime.player.pos
    anchor.set(p.x, p.y, p.z)
    pts.position.copy(anchor)
    const u = (material as ShaderMaterial).uniforms
    u.uTime.value = state.clock.elapsedTime
    // indoors the streaks thin out — what remains reads through the windows
    u.uRain.value = rain * (indoors ? 0.3 : 1)
    u.uWind.value = runtime.weather.wind
  })

  return (
    <>
      <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
      <RippleRings />
    </>
  )
}

function buildRain(count: number) {
  const rng = mulberry32(7717)
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2
    const r = Math.sqrt(rng()) * RADIUS
    positions[i * 3] = Math.cos(a) * r
    positions[i * 3 + 1] = 0
    positions[i * 3 + 2] = Math.sin(a) * r
    seeds[i] = rng()
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uRain: { value: 0 },
      uWind: { value: 0.5 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uRain;
      uniform float uWind;
      varying float vAlpha;
      void main() {
        float speed = 13.0 + aSeed * 6.0;
        float h = ${FALL_HEIGHT.toFixed(1)};
        float y = h - mod(uTime * speed + aSeed * h * 7.0, h);
        // band rides the player (parent group): from ~14m overhead to just underfoot
        vec3 pos = position;
        pos.x += uWind * y * 0.14;
        pos.y = y - 4.0;
        // fade drops in only while the rain amount covers this seed; fade at ground
        vAlpha = step(aSeed, uRain) * 0.5 * smoothstep(0.0, 2.2, y - 0.8);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.1 + aSeed * 1.3) * (140.0 / max(1.0, -mv.z));
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        // elongated streak
        float a = smoothstep(0.5, 0.05, abs(d.x) * 3.2) * smoothstep(0.5, 0.2, abs(d.y));
        gl_FragColor = vec4(0.62, 0.72, 0.85, a * vAlpha);
      }
    `,
  })
  return { geometry, material }
}

// ---------------------------------------------------------------------------

/** Pooled expanding ripple rings on walkable ground while it rains. */
function RippleRings() {
  const COUNT = 26
  const meshRef = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const states = useMemo(() => {
    const rng = mulberry32(515)
    return Array.from({ length: COUNT }, () => ({ x: 0, y: 0, z: 0, t: rng() * 1.4 }))
  }, [])

  useFrame((_, dt) => {
    const mesh = meshRef.current
    if (!mesh) return
    const rain = runtime.weather.rain
    mesh.visible = rain > 0.05 && !runtime.player.indoors
    if (!mesh.visible) return
    const p = runtime.player.pos
    const rng = Math.random // placement jitter need not be deterministic
    states.forEach((s, i) => {
      s.t += dt * (0.9 + rain * 0.5)
      if (s.t > 1.2) {
        s.t = 0
        const a = rng() * Math.PI * 2
        const r = 1.5 + rng() * 9
        s.x = p.x + Math.cos(a) * r
        s.z = p.z + Math.sin(a) * r
        s.y = p.y + 0.03
      }
      const scale = 0.08 + s.t * 0.5
      dummy.position.set(s.x, s.y, s.z)
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    const mat = mesh.material as ShaderMaterial
    mat.uniforms.uRain.value = rain
  })

  const { ringGeo, ringMat } = useMemo(() => {
    const ringGeo = new RingGeometry(0.75, 1, 20)
    const ringMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uRain: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vScale;
        void main() {
          vUv = uv;
          vScale = length(vec3(instanceMatrix[0].x, instanceMatrix[0].y, instanceMatrix[0].z));
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vScale;
        uniform float uRain;
        void main() {
          float fade = 1.0 - smoothstep(0.1, 0.6, vScale);
          gl_FragColor = vec4(0.75, 0.85, 0.95, fade * 0.32 * uRain);
        }
      `,
    })
    return { ringGeo, ringMat }
  }, [])

  return <instancedMesh ref={meshRef} args={[ringGeo, ringMat, COUNT]} frustumCulled={false} />
}
