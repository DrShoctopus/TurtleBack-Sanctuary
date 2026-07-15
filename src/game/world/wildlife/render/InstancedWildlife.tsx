import { type MutableRefObject, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  ConeGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
} from 'three'
import type { WildlifeAgent, WildlifeFrame, WildlifeSpeciesId } from '../types'

const MAX_AGENTS = 48
const MAX_INSECTS = 96

interface MeshRefs {
  songbirdBody: MutableRefObject<InstancedMesh | null>
  songbirdHead: MutableRefObject<InstancedMesh | null>
  songbirdBeak: MutableRefObject<InstancedMesh | null>
  songbirdEye: MutableRefObject<InstancedMesh | null>
  songbirdWingL: MutableRefObject<InstancedMesh | null>
  songbirdWingR: MutableRefObject<InstancedMesh | null>
  songbirdTail: MutableRefObject<InstancedMesh | null>
  seabirdBody: MutableRefObject<InstancedMesh | null>
  seabirdHead: MutableRefObject<InstancedMesh | null>
  seabirdBeak: MutableRefObject<InstancedMesh | null>
  seabirdWingL: MutableRefObject<InstancedMesh | null>
  seabirdWingR: MutableRefObject<InstancedMesh | null>
  seabirdTail: MutableRefObject<InstancedMesh | null>
  hareBody: MutableRefObject<InstancedMesh | null>
  hareChest: MutableRefObject<InstancedMesh | null>
  hareHead: MutableRefObject<InstancedMesh | null>
  hareEarL: MutableRefObject<InstancedMesh | null>
  hareEarR: MutableRefObject<InstancedMesh | null>
  hareTail: MutableRefObject<InstancedMesh | null>
  hareEye: MutableRefObject<InstancedMesh | null>
  insectBody: MutableRefObject<InstancedMesh | null>
  insectWingL: MutableRefObject<InstancedMesh | null>
  insectWingR: MutableRefObject<InstancedMesh | null>
  fireflyGlow: MutableRefObject<InstancedMesh | null>
  rayBody: MutableRefObject<InstancedMesh | null>
  rayWing: MutableRefObject<InstancedMesh | null>
  rayTail: MutableRefObject<InstancedMesh | null>
}

interface LocalTransform {
  readonly position: readonly [number, number, number]
  readonly scale: readonly [number, number, number]
  readonly rotation?: readonly [number, number, number]
}

const dummy = new Object3D()

function place(
  mesh: InstancedMesh | null,
  index: number,
  agent: WildlifeAgent,
  local: LocalTransform,
  lift = 0,
): void {
  if (!mesh) return
  const [lx, ly, lz] = local.position
  const cos = Math.cos(agent.heading)
  const sin = Math.sin(agent.heading)
  dummy.position.set(
    agent.position[0] + (lx * cos + lz * sin) * agent.scale,
    agent.position[1] + (ly + lift) * agent.scale,
    agent.position[2] + (-lx * sin + lz * cos) * agent.scale,
  )
  const [rx, ry, rz] = local.rotation ?? [0, 0, 0]
  dummy.rotation.set(rx, agent.heading + ry, rz, 'YXZ')
  dummy.scale.set(
    local.scale[0] * agent.scale,
    local.scale[1] * agent.scale,
    local.scale[2] * agent.scale,
  )
  dummy.updateMatrix()
  mesh.setMatrixAt(index, dummy.matrix)
}

function finish(mesh: InstancedMesh | null, count: number): void {
  if (!mesh) return
  mesh.count = count
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
}

function species(frame: WildlifeFrame | null, id: WildlifeSpeciesId): readonly WildlifeAgent[] {
  return frame?.agents.filter((agent) => agent.speciesId === id) ?? []
}

function expandGroup(agent: WildlifeAgent, spacing: number): readonly WildlifeAgent[] {
  return Array.from({ length: agent.groupSize }, (_, index) => {
    if (index === 0) return agent
    const side = index % 2 === 0 ? 1 : -1
    const row = Math.ceil(index / 2)
    const forward = row * spacing * 0.72
    const lateral = side * row * spacing
    const cos = Math.cos(agent.heading)
    const sin = Math.sin(agent.heading)
    return {
      ...agent,
      id: `${agent.id}:member:${index}`,
      position: [
        agent.position[0] + lateral * cos + forward * sin,
        agent.position[1] + (index % 3 - 1) * spacing * 0.12,
        agent.position[2] - lateral * sin + forward * cos,
      ],
      phase: (agent.phase + index * 0.217) % 1,
      scale: agent.scale * (0.92 + (index % 3) * 0.05),
    }
  })
}

export function InstancedWildlife({ frameRef }: { frameRef: MutableRefObject<WildlifeFrame | null> }) {
  const refs: MeshRefs = {
    songbirdBody: useRef(null), songbirdHead: useRef(null), songbirdBeak: useRef(null), songbirdEye: useRef(null), songbirdWingL: useRef(null), songbirdWingR: useRef(null), songbirdTail: useRef(null),
    seabirdBody: useRef(null), seabirdHead: useRef(null), seabirdBeak: useRef(null), seabirdWingL: useRef(null), seabirdWingR: useRef(null), seabirdTail: useRef(null),
    hareBody: useRef(null), hareChest: useRef(null), hareHead: useRef(null), hareEarL: useRef(null), hareEarR: useRef(null), hareTail: useRef(null), hareEye: useRef(null),
    insectBody: useRef(null), insectWingL: useRef(null), insectWingR: useRef(null), fireflyGlow: useRef(null),
    rayBody: useRef(null), rayWing: useRef(null), rayTail: useRef(null),
  }
  const geometry = useMemo(() => ({
    rounded: new IcosahedronGeometry(1, 2),
    head: new SphereGeometry(1, 10, 8),
    wing: new ConeGeometry(0.72, 1.8, 3),
    tail: new ConeGeometry(0.44, 1.5, 3),
    beak: new ConeGeometry(0.22, 0.72, 6),
    ear: new ConeGeometry(0.32, 1.7, 7),
    insect: new IcosahedronGeometry(1, 1),
    insectWing: new PlaneGeometry(1, 1),
    rayWing: new IcosahedronGeometry(1, 1),
    rayTail: new ConeGeometry(0.12, 2.4, 5),
  }), [])
  const materials = useMemo(() => ({
    songbird: new MeshStandardMaterial({ color: '#46594a', roughness: 0.82, flatShading: true }),
    songbirdCrown: new MeshStandardMaterial({ color: '#c7a55d', roughness: 0.76, flatShading: true }),
    beak: new MeshStandardMaterial({ color: '#d5a85f', roughness: 0.7, flatShading: true }),
    eye: new MeshBasicMaterial({ color: '#11140f' }),
    songbirdWing: new MeshStandardMaterial({ color: '#293b39', roughness: 0.86, flatShading: true, side: DoubleSide }),
    seabird: new MeshStandardMaterial({ color: '#d8d3c3', roughness: 0.78, flatShading: true }),
    seabirdWing: new MeshStandardMaterial({ color: '#59646b', roughness: 0.82, flatShading: true, side: DoubleSide }),
    hare: new MeshStandardMaterial({ color: '#887552', roughness: 0.96, flatShading: true }),
    hareChest: new MeshStandardMaterial({ color: '#c2ae7c', roughness: 0.92, flatShading: true }),
    hareTail: new MeshStandardMaterial({ color: '#d2c8a9', roughness: 0.9, flatShading: true }),
    insect: new MeshStandardMaterial({ color: '#363c2c', roughness: 0.72, metalness: 0.08 }),
    insectWing: new MeshStandardMaterial({ color: '#d8b46e', emissive: '#5b3d22', emissiveIntensity: 0.12, transparent: true, opacity: 0.74, roughness: 0.54, side: DoubleSide, depthWrite: false }),
    glow: new MeshBasicMaterial({ color: '#c7f28a', transparent: true, opacity: 0.86, toneMapped: false, depthWrite: false }),
    ray: new MeshStandardMaterial({ color: '#496b68', roughness: 0.72, flatShading: true }),
    rayWing: new MeshStandardMaterial({ color: '#789083', roughness: 0.78, flatShading: true }),
  }), [])

  useFrame(() => {
    const frame = frameRef.current
    const t = frame?.elapsedSeconds ?? 0

    const songbirds = species(frame, 'crownwood-songbird').flatMap((agent) => expandGroup(agent, 1.1))
    songbirds.forEach((agent, index) => {
      const flying = agent.behavior === 'flock' || agent.behavior === 'takeoff'
      const flap = flying ? Math.sin(t * 8.5 + agent.phase * 20) * 0.72 : 0.12
      place(refs.songbirdBody.current, index, agent, { position: [0, 0, 0], scale: [0.36, 0.3, 0.62], rotation: [0.1, 0, 0] })
      place(refs.songbirdHead.current, index, agent, { position: [0, 0.24, -0.47], scale: [0.25, 0.25, 0.28] })
      place(refs.songbirdBeak.current, index, agent, { position: [0, 0.23, -0.79], scale: [0.46, 0.46, 0.46], rotation: [-Math.PI / 2, 0, 0] })
      place(refs.songbirdEye.current, index, agent, { position: [0.18, 0.31, -0.68], scale: [0.055, 0.055, 0.055] })
      place(refs.songbirdWingL.current, index, agent, { position: [-0.32, 0.03, 0], scale: [0.42, 0.5, 0.18], rotation: [0, 0, Math.PI / 2 + flap] })
      place(refs.songbirdWingR.current, index, agent, { position: [0.32, 0.03, 0], scale: [0.42, 0.5, 0.18], rotation: [0, 0, -Math.PI / 2 - flap] })
      place(refs.songbirdTail.current, index, agent, { position: [0, 0.03, 0.62], scale: [0.34, 0.48, 0.22], rotation: [Math.PI / 2, 0, 0] })
    })
    ;['songbirdBody', 'songbirdHead', 'songbirdBeak', 'songbirdEye', 'songbirdWingL', 'songbirdWingR', 'songbirdTail'].forEach((key) => finish(refs[key as keyof MeshRefs].current, songbirds.length))

    const seabirds = species(frame, 'galecrest-seabird').flatMap((agent) => expandGroup(agent, 4.4))
    seabirds.forEach((agent, index) => {
      const glide = 0.18 + Math.sin(t * 2.1 + agent.phase * 14) * 0.12
      place(refs.seabirdBody.current, index, agent, { position: [0, 0, 0], scale: [0.44, 0.3, 0.86] })
      place(refs.seabirdHead.current, index, agent, { position: [0, 0.16, -0.72], scale: [0.3, 0.28, 0.34] })
      place(refs.seabirdBeak.current, index, agent, { position: [0, 0.12, -1.08], scale: [0.54, 0.54, 0.54], rotation: [-Math.PI / 2, 0, 0] })
      place(refs.seabirdWingL.current, index, agent, { position: [-0.78, 0, 0], scale: [0.8, 1.15, 0.22], rotation: [0, 0, Math.PI / 2 + glide] })
      place(refs.seabirdWingR.current, index, agent, { position: [0.78, 0, 0], scale: [0.8, 1.15, 0.22], rotation: [0, 0, -Math.PI / 2 - glide] })
      place(refs.seabirdTail.current, index, agent, { position: [0, 0, 0.9], scale: [0.38, 0.52, 0.26], rotation: [Math.PI / 2, 0, 0] })
    })
    ;['seabirdBody', 'seabirdHead', 'seabirdBeak', 'seabirdWingL', 'seabirdWingR', 'seabirdTail'].forEach((key) => finish(refs[key as keyof MeshRefs].current, seabirds.length))

    const hares = species(frame, 'shell-hare').flatMap((agent) => expandGroup(agent, 1.45))
    hares.forEach((agent, index) => {
      const hop = agent.behavior === 'flee' ? Math.abs(Math.sin(t * 5.2 + agent.phase * 9)) * 0.58 : agent.behavior === 'forage' ? Math.abs(Math.sin(t * 1.4 + agent.phase * 9)) * 0.12 : 0
      place(refs.hareBody.current, index, agent, { position: [0, 0.44, 0.16], scale: [0.5, 0.5, 0.78] }, hop)
      place(refs.hareChest.current, index, agent, { position: [0, 0.55, -0.38], scale: [0.38, 0.58, 0.38] }, hop)
      place(refs.hareHead.current, index, agent, { position: [0, 0.98, -0.53], scale: [0.34, 0.36, 0.38] }, hop)
      place(refs.hareEarL.current, index, agent, { position: [-0.14, 1.52, -0.46], scale: [0.42, 0.6, 0.32], rotation: [0.08, 0, 0.08] }, hop)
      place(refs.hareEarR.current, index, agent, { position: [0.14, 1.48, -0.44], scale: [0.42, 0.58, 0.32], rotation: [-0.04, 0, -0.12] }, hop)
      place(refs.hareTail.current, index, agent, { position: [0, 0.62, 0.87], scale: [0.25, 0.25, 0.25] }, hop)
      place(refs.hareEye.current, index, agent, { position: [0.26, 1.06, -0.69], scale: [0.065, 0.065, 0.065] }, hop)
    })
    ;['hareBody', 'hareChest', 'hareHead', 'hareEarL', 'hareEarR', 'hareTail', 'hareEye'].forEach((key) => finish(refs[key as keyof MeshRefs].current, hares.length))

    const insectGroups = [...species(frame, 'blossom-pollinators'), ...species(frame, 'lumenfen-insects')]
    let insectCount = 0
    let glowCount = 0
    for (const agent of insectGroups) {
      for (let localIndex = 0; localIndex < agent.groupSize && insectCount < MAX_INSECTS; localIndex++) {
        const phase = agent.phase * 31 + localIndex * 1.71
        const radius = 0.7 + (localIndex % 3) * 0.55
        const local: readonly [number, number, number] = [Math.cos(t * 0.62 + phase) * radius, Math.sin(t * 0.91 + phase) * 0.58, Math.sin(t * 0.53 + phase) * radius]
        const proxy = { ...agent, position: [agent.position[0] + local[0], agent.position[1] + local[1], agent.position[2] + local[2]] as const, scale: agent.speciesId === 'lumenfen-insects' ? 0.72 : 0.9 }
        const flap = Math.sin(t * 12 + phase) * 0.74
        place(refs.insectBody.current, insectCount, proxy, { position: [0, 0, 0], scale: [0.09, 0.08, 0.24] })
        place(refs.insectWingL.current, insectCount, proxy, { position: [-0.17, 0.02, 0], scale: [0.34, 0.22, 0.34], rotation: [0, 0, flap] })
        place(refs.insectWingR.current, insectCount, proxy, { position: [0.17, 0.02, 0], scale: [0.34, 0.22, 0.34], rotation: [0, 0, -flap] })
        if (agent.behavior === 'glow') {
          place(refs.fireflyGlow.current, glowCount++, proxy, { position: [0, -0.02, 0.14], scale: [0.24, 0.24, 0.24] })
        }
        insectCount++
      }
    }
    ;['insectBody', 'insectWingL', 'insectWingR'].forEach((key) => finish(refs[key as keyof MeshRefs].current, insectCount))
    finish(refs.fireflyGlow.current, glowCount)

    const rays = species(frame, 'shell-ray').flatMap((agent) => expandGroup(agent, 5.8))
    rays.forEach((agent, index) => {
      const bank = Math.sin(t * 0.8 + agent.phase * 13) * 0.18
      place(refs.rayBody.current, index, agent, { position: [0, 0, 0], scale: [0.62, 0.18, 0.82], rotation: [bank, 0, 0] })
      place(refs.rayWing.current, index, agent, { position: [0, 0, 0.08], scale: [1.2, 0.16, 0.82], rotation: [bank, Math.PI / 4, 0] })
      place(refs.rayTail.current, index, agent, { position: [0, 0, 1.5], scale: [0.5, 1.1, 0.5], rotation: [Math.PI / 2, 0, 0] })
    })
    ;['rayBody', 'rayWing', 'rayTail'].forEach((key) => finish(refs[key as keyof MeshRefs].current, rays.length))
  })

  return (
    <group name="wildlife:instanced-shape-language">
      <instancedMesh ref={refs.songbirdBody} args={[geometry.rounded, materials.songbird, MAX_AGENTS]} castShadow />
      <instancedMesh ref={refs.songbirdHead} args={[geometry.head, materials.songbirdCrown, MAX_AGENTS]} castShadow />
      <instancedMesh ref={refs.songbirdBeak} args={[geometry.beak, materials.beak, MAX_AGENTS]} />
      <instancedMesh ref={refs.songbirdEye} args={[geometry.head, materials.eye, MAX_AGENTS]} />
      <instancedMesh ref={refs.songbirdWingL} args={[geometry.wing, materials.songbirdWing, MAX_AGENTS]} />
      <instancedMesh ref={refs.songbirdWingR} args={[geometry.wing, materials.songbirdWing, MAX_AGENTS]} />
      <instancedMesh ref={refs.songbirdTail} args={[geometry.tail, materials.songbirdWing, MAX_AGENTS]} />
      <instancedMesh ref={refs.seabirdBody} args={[geometry.rounded, materials.seabird, MAX_AGENTS]} />
      <instancedMesh ref={refs.seabirdHead} args={[geometry.head, materials.seabird, MAX_AGENTS]} />
      <instancedMesh ref={refs.seabirdBeak} args={[geometry.beak, materials.beak, MAX_AGENTS]} />
      <instancedMesh ref={refs.seabirdWingL} args={[geometry.wing, materials.seabirdWing, MAX_AGENTS]} />
      <instancedMesh ref={refs.seabirdWingR} args={[geometry.wing, materials.seabirdWing, MAX_AGENTS]} />
      <instancedMesh ref={refs.seabirdTail} args={[geometry.tail, materials.seabirdWing, MAX_AGENTS]} />
      <instancedMesh ref={refs.hareBody} args={[geometry.rounded, materials.hare, MAX_AGENTS]} castShadow receiveShadow />
      <instancedMesh ref={refs.hareChest} args={[geometry.rounded, materials.hareChest, MAX_AGENTS]} castShadow />
      <instancedMesh ref={refs.hareHead} args={[geometry.head, materials.hare, MAX_AGENTS]} castShadow />
      <instancedMesh ref={refs.hareEarL} args={[geometry.ear, materials.hare, MAX_AGENTS]} castShadow />
      <instancedMesh ref={refs.hareEarR} args={[geometry.ear, materials.hare, MAX_AGENTS]} castShadow />
      <instancedMesh ref={refs.hareTail} args={[geometry.head, materials.hareTail, MAX_AGENTS]} />
      <instancedMesh ref={refs.hareEye} args={[geometry.head, materials.eye, MAX_AGENTS]} />
      <instancedMesh ref={refs.insectBody} args={[geometry.insect, materials.insect, MAX_INSECTS]} />
      <instancedMesh ref={refs.insectWingL} args={[geometry.insectWing, materials.insectWing, MAX_INSECTS]} />
      <instancedMesh ref={refs.insectWingR} args={[geometry.insectWing, materials.insectWing, MAX_INSECTS]} />
      <instancedMesh ref={refs.fireflyGlow} args={[geometry.insect, materials.glow, MAX_INSECTS]} />
      <instancedMesh ref={refs.rayBody} args={[geometry.rounded, materials.ray, MAX_AGENTS]} />
      <instancedMesh ref={refs.rayWing} args={[geometry.rayWing, materials.rayWing, MAX_AGENTS]} />
      <instancedMesh ref={refs.rayTail} args={[geometry.rayTail, materials.ray, MAX_AGENTS]} />
    </group>
  )
}
