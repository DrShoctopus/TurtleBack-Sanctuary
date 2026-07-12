import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three'
import { getTexture } from '../textures'

/**
 * The colossal turtle herself. Purely visual — the walkable shell above is the
 * physics terrain; these parts animate slowly (neck sway, blinks, flipper
 * strokes) without ever moving the player's reference frame.
 */
export function Turtle() {
  const mats = useMemo(() => buildMaterials(), [])
  const neckRef = useRef<Group>(null)
  const headRef = useRef<Group>(null)
  const eyelidL = useRef<Mesh>(null)
  const eyelidR = useRef<Mesh>(null)
  const flipperFL = useRef<Group>(null)
  const flipperFR = useRef<Group>(null)
  const flipperBL = useRef<Group>(null)
  const flipperBR = useRef<Group>(null)
  const blinkState = useRef({ next: 4, phase: 0 })

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    // slow swimming rhythm — one stroke ~9 seconds
    const stroke = Math.sin(t * 0.7 * 0.99)
    const strokeSlow = Math.sin(t * 0.33)
    if (flipperFL.current) {
      flipperFL.current.rotation.z = 0.32 + strokeSlow * 0.3
      flipperFL.current.rotation.x = Math.sin(t * 0.33 + 0.7) * 0.16
    }
    if (flipperFR.current) {
      flipperFR.current.rotation.z = -0.32 - Math.sin(t * 0.33 + 0.4) * 0.3
      flipperFR.current.rotation.x = Math.sin(t * 0.33 + 1.1) * 0.16
    }
    if (flipperBL.current) flipperBL.current.rotation.z = 0.2 + Math.sin(t * 0.27 + 2.1) * 0.18
    if (flipperBR.current) flipperBR.current.rotation.z = -0.2 - Math.sin(t * 0.27 + 2.8) * 0.18
    if (neckRef.current) {
      neckRef.current.rotation.y = Math.sin(t * 0.11) * 0.1
      neckRef.current.rotation.x = Math.sin(t * 0.21) * 0.035 + stroke * 0.008
    }
    if (headRef.current) {
      headRef.current.rotation.x = Math.sin(t * 0.17 + 1) * 0.05
      headRef.current.position.y = Math.sin(t * 0.24) * 1.1
    }
    // blinking
    const b = blinkState.current
    b.next -= dt
    if (b.next <= 0) {
      b.phase = 0.22
      b.next = 3.5 + Math.random() * 7
    }
    if (b.phase > 0) {
      b.phase = Math.max(0, b.phase - dt)
      const closed = Math.sin((1 - b.phase / 0.22) * Math.PI)
      const s = 1 - closed * 0.92
      if (eyelidL.current) eyelidL.current.scale.y = s
      if (eyelidR.current) eyelidR.current.scale.y = s
    }
  })

  return (
    <group>
      {/* body wall connecting shell rim to the sea (slightly inside the skirt) */}
      <mesh geometry={BODY_WALL} material={mats.hide} position={[0, -6, 2]} />
      {/* submerged body mass */}
      <mesh material={mats.hide} position={[0, -20, 6]} scale={[176, 34, 254]} geometry={UNIT_SPHERE} />

      {/* neck + head */}
      <group ref={neckRef} position={[0, -2, -244]}>
        <mesh material={mats.skin} position={[0, -2, -22]} rotation={[1.25, 0, 0]} geometry={NECK} castShadow />
        <group ref={headRef} position={[0, 4, -52]}>
          <mesh material={mats.skin} scale={[15, 12.5, 20]} geometry={UNIT_SPHERE} castShadow />
          {/* snout */}
          <mesh material={mats.skin} position={[0, -2.5, -16]} scale={[10, 7.5, 9]} geometry={UNIT_SPHERE} />
          {/* eyes */}
          <mesh material={mats.eye} position={[-11.4, 2.2, -7]} scale={[2.2, 2.6, 2.6]} geometry={UNIT_SPHERE} />
          <mesh material={mats.eye} position={[11.4, 2.2, -7]} scale={[2.2, 2.6, 2.6]} geometry={UNIT_SPHERE} />
          <mesh ref={eyelidL} material={mats.skin} position={[-11.5, 2.4, -7]} scale={[2.5, 2.9, 2.9]} geometry={UNIT_SPHERE} />
          <mesh ref={eyelidR} material={mats.skin} position={[11.5, 2.4, -7]} scale={[2.5, 2.9, 2.9]} geometry={UNIT_SPHERE} />
        </group>
      </group>

      {/* flippers — pivots at the shoulders so rotation reads as a stroke */}
      <group ref={flipperFL} position={[-150, -14, -96]} rotation={[0, 0.5, 0.32]}>
        <mesh material={mats.skin} position={[-42, 0, 0]} scale={[52, 7, 24]} geometry={UNIT_SPHERE} castShadow />
      </group>
      <group ref={flipperFR} position={[150, -14, -96]} rotation={[0, -0.5, -0.32]}>
        <mesh material={mats.skin} position={[42, 0, 0]} scale={[52, 7, 24]} geometry={UNIT_SPHERE} castShadow />
      </group>
      <group ref={flipperBL} position={[-122, -16, 178]} rotation={[0, -0.6, 0.2]}>
        <mesh material={mats.skin} position={[-30, 0, 6]} scale={[36, 6, 19]} geometry={UNIT_SPHERE} />
      </group>
      <group ref={flipperBR} position={[122, -16, 178]} rotation={[0, 0.6, -0.2]}>
        <mesh material={mats.skin} position={[30, 0, 6]} scale={[36, 6, 19]} geometry={UNIT_SPHERE} />
      </group>
      {/* tail */}
      <mesh material={mats.hide} position={[0, -14, 252]} scale={[14, 8, 22]} geometry={UNIT_SPHERE} />
    </group>
  )
}

const UNIT_SPHERE = new SphereGeometry(1, 28, 20)
const NECK = new CylinderGeometry(9, 15, 52, 20, 4)
const BODY_WALL = (() => {
  const g = new CylinderGeometry(1, 1.06, 22, 48, 3, true)
  g.scale(172, 1, 251)
  return g
})()

function buildMaterials() {
  const rockTex = getTexture('shellRock')
  const skin = new MeshStandardMaterial({
    color: '#6b7a5c',
    roughness: 0.82,
    metalness: 0,
    map: rockTex,
  })
  const hide = new MeshStandardMaterial({
    color: '#4a5346',
    roughness: 0.9,
    metalness: 0,
    map: rockTex,
  })
  const eye = new MeshStandardMaterial({ color: '#101613', roughness: 0.25, metalness: 0.1 })
  return { skin, hide, eye }
}
