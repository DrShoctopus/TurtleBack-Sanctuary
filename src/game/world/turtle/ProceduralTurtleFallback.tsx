import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector2,
} from 'three'
import { getSurfaceDetail, getTexture } from '../textures'
import { runtime } from '../../core/runtime'
import { ComfortMotionClock } from '../../core/comfortMotion'

/**
 * The colossal turtle herself. The walkable shell remains a stable physics
 * surface; only the visible body, face, neck and flippers breathe and swim.
 */
export function ProceduralTurtleFallback() {
  const mats = useMemo(() => buildMaterials(), [])
  const bodyRef = useRef<Group>(null)
  const neckRef = useRef<Group>(null)
  const headRef = useRef<Group>(null)
  const eyelidL = useRef<Mesh>(null)
  const eyelidR = useRef<Mesh>(null)
  const flipperFL = useRef<Group>(null)
  const flipperFR = useRef<Group>(null)
  const flipperBL = useRef<Group>(null)
  const flipperBR = useRef<Group>(null)
  const blinkState = useRef({ next: 4.4, phase: 0, count: 0 })
  const motionClock = useRef(new ComfortMotionClock())

  useFrame((_, dt) => {
    const t = motionClock.current.advance(dt, runtime.reducedMotion)
    const motion = runtime.reducedMotion ? 0.12 : 1
    const stroke = Math.sin(t * 0.33)
    const breath = 0.5 + Math.sin(t * 0.38) * 0.5

    if (bodyRef.current) bodyRef.current.scale.y = 1 + breath * 0.012 * motion
    if (flipperFL.current) {
      flipperFL.current.rotation.z = 0.3 + stroke * 0.28 * motion
      flipperFL.current.rotation.x = Math.sin(t * 0.33 + 0.72) * 0.14 * motion
      flipperFL.current.rotation.y = 0.9 + Math.sin(t * 0.17) * 0.04 * motion
    }
    if (flipperFR.current) {
      flipperFR.current.rotation.z = -0.3 - Math.sin(t * 0.33 + 0.42) * 0.28 * motion
      flipperFR.current.rotation.x = Math.sin(t * 0.33 + 1.14) * 0.14 * motion
      flipperFR.current.rotation.y = -0.9 - Math.sin(t * 0.17 + 0.4) * 0.04 * motion
    }
    if (flipperBL.current) {
      flipperBL.current.rotation.z = 0.18 + Math.sin(t * 0.27 + 2.1) * 0.16 * motion
    }
    if (flipperBR.current) {
      flipperBR.current.rotation.z = -0.18 - Math.sin(t * 0.27 + 2.8) * 0.16 * motion
    }
    if (neckRef.current) {
      neckRef.current.rotation.y = Math.sin(t * 0.11) * 0.085 * motion
      neckRef.current.rotation.x = Math.sin(t * 0.21) * 0.03 * motion
      const neckBreath = 1 + breath * 0.014 * motion
      neckRef.current.scale.set(neckBreath, 1 + breath * 0.02 * motion, neckBreath)
    }
    if (headRef.current) {
      const attentiveYaw = clamp(runtime.player.pos.x / 420, -0.16, 0.16)
      headRef.current.rotation.y = attentiveYaw + Math.sin(t * 0.1) * 0.045 * motion
      headRef.current.rotation.x = Math.sin(t * 0.17 + 1) * 0.038 * motion
      headRef.current.position.y = 6.5 + Math.sin(t * 0.24) * 0.72 * motion
      headRef.current.position.z = -52 + Math.sin(t * 0.16 + 0.8) * 0.35 * motion
    }

    // Deterministic, asymmetric blink intervals keep captures and tests stable.
    const blink = blinkState.current
    blink.next -= dt
    if (blink.next <= 0) {
      blink.phase = 0.24
      blink.count++
      blink.next = 4.1 + ((blink.count * 2.73) % 5.4)
    }
    const closed = blink.phase > 0 ? Math.sin((1 - blink.phase / 0.24) * Math.PI) : 0
    blink.phase = Math.max(0, blink.phase - dt)
    setEyelid(eyelidL.current, closed)
    setEyelid(eyelidR.current, closed)
  })

  return (
    <group>
      <group ref={bodyRef}>
        {/* hide and body mass join the walkable shell to the sea */}
        <mesh geometry={BODY_WALL} material={mats.hide} position={[0, -6, 2]} />
        <mesh
          material={mats.hide}
          position={[0, -20, 6]}
          scale={[176, 34, 254]}
          geometry={BODY_SPHERE}
        />
      </group>

      <group ref={neckRef} position={[0, -2, -244]}>
        <mesh
          material={mats.skin}
          position={[0, -2, -22]}
          rotation={[1.25, 0, 0]}
          geometry={NECK}
          castShadow
          receiveShadow
        />
        <group ref={headRef} position={[0, 6.5, -52]}>
          <mesh
            material={mats.skin}
            scale={[15.5, 12.3, 19.5]}
            geometry={HEAD}
            castShadow
            receiveShadow
          />
          <mesh
            material={mats.skin}
            position={[0, -3.15, -15.8]}
            scale={[9.2, 5.45, 7.7]}
            geometry={SNOUT}
            castShadow
          />

          {/* warm irises, dark pupils and tiny catchlights remain readable at night */}
          <mesh
            material={mats.iris}
            position={[-9.7, 1.85, -13.05]}
            scale={[2.15, 2.45, 2.15]}
            geometry={EYE_SPHERE}
          />
          <mesh
            material={mats.iris}
            position={[9.7, 1.85, -13.05]}
            scale={[2.15, 2.45, 2.15]}
            geometry={EYE_SPHERE}
          />
          <mesh
            material={mats.pupil}
            position={[-10.35, 1.8, -14.75]}
            scale={[0.82, 1.25, 0.68]}
            geometry={EYE_SPHERE}
          />
          <mesh
            material={mats.pupil}
            position={[10.35, 1.8, -14.75]}
            scale={[0.82, 1.25, 0.68]}
            geometry={EYE_SPHERE}
          />
          <mesh
            material={mats.catchlight}
            position={[-10.72, 2.5, -15.25]}
            scale={[0.21, 0.26, 0.18]}
            geometry={EYE_SPHERE}
          />
          <mesh
            material={mats.catchlight}
            position={[10.72, 2.5, -15.25]}
            scale={[0.21, 0.26, 0.18]}
            geometry={EYE_SPHERE}
          />
          <mesh
            ref={eyelidL}
            material={mats.skin}
            position={[-9.7, 4.2, -13.05]}
            scale={[2.55, 0.08, 2.45]}
            geometry={EYE_SPHERE}
          />
          <mesh
            ref={eyelidR}
            material={mats.skin}
            position={[9.7, 4.2, -13.05]}
            scale={[2.55, 0.08, 2.45]}
            geometry={EYE_SPHERE}
          />

          <mesh
            material={mats.mouth}
            position={[-3.0, -1.6, -23.35]}
            scale={[0.34, 0.2, 0.15]}
            geometry={EYE_SPHERE}
          />
          <mesh
            material={mats.mouth}
            position={[3.0, -1.6, -23.35]}
            scale={[0.34, 0.2, 0.15]}
            geometry={EYE_SPHERE}
          />
        </group>
      </group>

      {/* Tapered sculpted flippers retain simple pivot groups for swimming. */}
      <group ref={flipperFL} position={[-150, -14, -96]} rotation={[0, 0.9, 0.3]}>
        <mesh
          material={mats.skin}
          position={[-42, 0, 0]}
          scale={[54, 8, 27]}
          geometry={FLIPPER_LEFT}
          castShadow
        />
      </group>
      <group ref={flipperFR} position={[150, -14, -96]} rotation={[0, -0.9, -0.3]}>
        <mesh
          material={mats.skin}
          position={[42, 0, 0]}
          scale={[54, 8, 27]}
          geometry={FLIPPER_RIGHT}
          castShadow
        />
      </group>
      <group ref={flipperBL} position={[-122, -16, 178]} rotation={[0, -0.6, 0.18]}>
        <mesh
          material={mats.skin}
          position={[-30, 0, 6]}
          scale={[38, 6.5, 20]}
          geometry={FLIPPER_LEFT}
        />
      </group>
      <group ref={flipperBR} position={[122, -16, 178]} rotation={[0, 0.6, -0.18]}>
        <mesh
          material={mats.skin}
          position={[30, 0, 6]}
          scale={[38, 6.5, 20]}
          geometry={FLIPPER_RIGHT}
        />
      </group>
      <mesh material={mats.hide} position={[0, -14, 252]} scale={[14, 8, 22]} geometry={SNOUT} />
    </group>
  )
}

function setEyelid(lid: Mesh | null, closed: number): void {
  if (!lid) return
  lid.visible = closed > 0.01
  lid.scale.y = 0.08 + closed * 2.35
  lid.position.y = 4.2 - closed * 2.15
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function organicSphere(seed: number, width = 44, height = 28): SphereGeometry {
  const geometry = new SphereGeometry(1, width, height)
  const positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const y = positions.getY(i)
    const z = positions.getZ(i)
    const ripple =
      Math.sin(x * 7.1 + y * 4.7 + seed) * 0.012 + Math.sin(z * 8.3 - y * 5.2 + seed * 1.7) * 0.009
    const scale = 1 + ripple
    positions.setXYZ(i, x * scale, y * scale, z * scale)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

function makeFlipper(tipDirection: -1 | 1): SphereGeometry {
  const geometry = new SphereGeometry(1, 40, 20)
  const positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const y = positions.getY(i)
    const z = positions.getZ(i)
    const towardTip = clamp((tipDirection * x + 0.1) / 1.1, 0, 1)
    const taper = 1 - towardTip * 0.58
    const trailingWave = Math.sin((x + 1) * 3.2) * 0.055 * (1 - Math.abs(y))
    positions.setXYZ(i, x, y * taper, z * taper + trailingWave)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

const BODY_SPHERE = organicSphere(1.3, 32, 20)
const HEAD = organicSphere(2.1)
const SNOUT = organicSphere(3.4, 36, 24)
const EYE_SPHERE = new SphereGeometry(1, 28, 20)
const FLIPPER_LEFT = makeFlipper(-1)
const FLIPPER_RIGHT = makeFlipper(1)
const NECK = new LatheGeometry(
  [
    new Vector2(14.5, -26),
    new Vector2(13.2, -20),
    new Vector2(11.2, -10),
    new Vector2(9.4, 2),
    new Vector2(9.8, 13),
    new Vector2(11.5, 26),
  ],
  36,
)
const BODY_WALL = (() => {
  const geometry = new CylinderGeometry(1, 1.06, 22, 64, 4, true)
  geometry.scale(172, 1, 251)
  return geometry
})()

function buildMaterials() {
  const skinTexture = getTexture('turtleSkin')
  const skinDetail = getSurfaceDetail('turtleSkin')
  const shellTexture = getTexture('shellRock')
  const skin = new MeshStandardMaterial({
    color: '#d9ded0',
    roughness: 0.84,
    metalness: 0,
    emissive: '#102219',
    emissiveIntensity: 0.2,
    map: skinTexture,
    normalMap: skinDetail.normalMap,
    roughnessMap: skinDetail.roughnessMap,
    normalScale: new Vector2(0.32, 0.32),
  })
  const hide = new MeshStandardMaterial({
    color: '#4a5346',
    roughness: 0.92,
    metalness: 0,
    map: shellTexture,
  })
  const iris = new MeshStandardMaterial({ color: '#a38d55', roughness: 0.32, metalness: 0.04 })
  const pupil = new MeshStandardMaterial({ color: '#07100b', roughness: 0.16, metalness: 0.08 })
  const catchlight = new MeshStandardMaterial({
    color: '#ecfff8',
    emissive: '#bcefe1',
    emissiveIntensity: 0.7,
    roughness: 0.08,
  })
  const mouth = new MeshStandardMaterial({ color: '#20251f', roughness: 0.72 })
  return { skin, hide, iris, pupil, catchlight, mouth }
}
