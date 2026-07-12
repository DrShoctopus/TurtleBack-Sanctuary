import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  LinearFilter,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
} from 'three'
import { runtime } from '../../core/runtime'

const CURTAINS = 10

/**
 * Layered translucent aurora ribbons. The strips surround the sanctuary so a
 * slow curtain is visible from every district, while their low-frequency sway
 * remains gentle enough for the comfort-focused camera.
 */
export function Aurora() {
  const groupRef = useRef<Group>(null)
  const geometry = useMemo(() => buildCurtainGeometry(), [])
  const texture = useMemo(() => buildAuroraTexture(), [])
  const materials = useMemo(
    () =>
      Array.from(
        { length: CURTAINS },
        (_, i) =>
          new MeshBasicMaterial({
            color: new Color().setHSL(0.46 + (i % 3) * 0.025, 0.5, 0.78),
            map: texture,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            depthTest: true,
            side: DoubleSide,
            blending: AdditiveBlending,
            toneMapped: false,
          }),
      ),
    [texture],
  )

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    const night = runtime.time.celest.starIntensity
    const strength =
      night *
      night *
      (1 - runtime.weather.rain * 0.95) *
      (runtime.quality.level === 'low' ? 0.52 : 1)
    const motion = runtime.reducedMotion ? 0.12 : 1
    const t = state.clock.elapsedTime
    group.rotation.y = t * 0.0025 * motion
    texture.offset.x = (t * 0.0018 * motion) % 1
    group.children.forEach((child, i) => {
      materials[i].opacity = strength * (0.24 + (i % 3) * 0.035)
      child.position.y = 250 + Math.sin(t * 0.045 * motion + i * 1.7) * 18
      child.scale.y = 0.92 + Math.sin(t * 0.055 * motion + i) * 0.08
    })
  })

  return (
    <group ref={groupRef} renderOrder={-97}>
      {materials.map((material, i) => {
        const angle = (i / CURTAINS) * Math.PI * 2
        const radius = 720 + (i % 2) * 55
        return (
          <mesh
            key={i}
            geometry={geometry}
            material={material}
            position={[Math.sin(angle) * radius, 250, Math.cos(angle) * radius]}
            rotation={[0, angle, (i % 2 ? -1 : 1) * 0.055]}
            frustumCulled={false}
            renderOrder={-97}
          />
        )
      })}
    </group>
  )
}

function buildCurtainGeometry(): PlaneGeometry {
  const geometry = new PlaneGeometry(430, 300, 36, 10)
  const positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const y = positions.getY(i)
    const vertical = (y + 150) / 300
    positions.setX(i, x + Math.sin(x * 0.025 + vertical * 3.4) * (12 + vertical * 18))
    positions.setZ(i, Math.sin(x * 0.031 + vertical * 5.2) * 22 + Math.sin(x * 0.011) * 14)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

function buildAuroraTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(canvas.width, canvas.height)
  for (let y = 0; y < canvas.height; y++) {
    const v = y / (canvas.height - 1)
    for (let x = 0; x < canvas.width; x++) {
      const u = x / (canvas.width - 1)
      const wave = Math.sin(u * Math.PI * 8) * 0.035 + Math.sin(u * Math.PI * 19) * 0.014
      const center = 0.43 + wave
      const lower = Math.exp(-Math.pow((v - center) * 7.2, 2))
      const upper = Math.exp(-Math.pow((v - center - 0.2) * 10.5, 2))
      const threads = 0.35 + 0.65 * Math.pow(Math.abs(Math.sin(u * Math.PI * 27)), 1.5)
      const edge = Math.pow(Math.sin(u * Math.PI), 0.42)
      const verticalFade = smooth01(v / 0.1) * smooth01((1 - v) / 0.14)
      const alpha = Math.min(1, (lower * 0.74 + upper * 0.36) * threads * edge * verticalFade)
      const violet = smooth01((v - 0.48) / 0.32)
      const i = (y * canvas.width + x) * 4
      image.data[i] = Math.round(55 + violet * 75)
      image.data[i + 1] = Math.round(225 - violet * 95)
      image.data[i + 2] = Math.round(165 + violet * 80)
      image.data[i + 3] = Math.round(alpha * 255)
    }
  }
  ctx.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

function smooth01(value: number): number {
  const x = Math.min(1, Math.max(0, value))
  return x * x * (3 - 2 * x)
}
