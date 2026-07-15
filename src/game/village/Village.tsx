import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import {
  Color,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  SphereGeometry,
  Vector3,
} from 'three'
import { BUILDINGS, PATHS, PLAZA, WATER_FEATURES } from '../config/layout'
import { runtime } from '../core/runtime'
import { terrainHeight } from '../world/shell/shellShape'
import { registerSurfaceBox } from '../world/shell/shellShape'
import { Building } from './Building'
import { BuildPlan } from './kit/geometry'
import { exteriorVillageMaterials } from './kit/materials'
import * as p from './kit/props'
import { registerInteraction } from '../interaction/InteractionSystem'
import { sitAt } from '../activities/sitting'
import { ringChime } from '../activities/handlers'
import { mulberry32 } from '../core/rng'
import { buildTraversalArchitecture, type TraversalSurface } from './traversal'
import { useQualityProfile } from '../core/useQualityProfile'
import { registerProbeSection } from '../debug/probes'
import { buildVillageStoryClusters } from './dressing/buildStoryClusters'
import { VILLAGE_ANCHORS } from './dressing/layout'

export function Village() {
  return (
    <>
      {BUILDINGS.map((b) => (
        <Building key={b.id} spec={b} />
      ))}
      <OutdoorProps />
      <LampGlows />
      <FeatureWater />
    </>
  )
}

// ---------------------------------------------------------------------------

interface OutdoorSeat {
  x: number
  y: number
  z: number
  yaw: number
  label: string
  listen?: boolean
}

const DECKS: Array<{ x: number; z: number; h: number }> = [
  { x: -146, z: -24, h: 10.1 },
  { x: 148, z: 58, h: 9.8 },
  { x: 0, z: -224, h: 10.0 },
  { x: 2, z: 236, h: 10.6 },
]

const lampSpots: Array<[number, number]> = []
const traversalLampSpots: Array<[number, number]> = [
  [-55, 73],
  [-55, 87],
  [-2.8, 155],
  [-2.8, 177],
  [7.4, 220],
  [6, 228],
  [-132, -32],
  [126, 63],
  [2.8, -205],
]

function collectLampSpots(): Array<[number, number]> {
  if (lampSpots.length) return lampSpots
  const rng = mulberry32(808)
  for (const line of PATHS) {
    let acc = 12
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i]
      const b = line[i + 1]
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      let t = acc
      while (t < len) {
        const f = t / len
        const side = rng() < 0.5 ? 1 : -1
        const nx = -(b.z - a.z) / len
        const nz = (b.x - a.x) / len
        const x = a.x + (b.x - a.x) * f + nx * side * 2.4
        const z = a.z + (b.z - a.z) * f + nz * side * 2.4
        const insideBuildingPad = BUILDINGS.some((building) => {
          const dx = x - building.x
          const dz = z - building.z
          return dx * dx + dz * dz < (building.padR - 1.2) ** 2
        })
        if (!insideBuildingPad) lampSpots.push([x, z])
        t += 26 + rng() * 10
      }
      acc = t - len
    }
  }
  lampSpots.push(...traversalLampSpots)
  return lampSpots
}

function OutdoorProps() {
  const { merged, colliders, seats, surfaces, storyStats } = useMemo(() => buildOutdoor(), [])
  const mats = exteriorVillageMaterials()

  // outdoor seat interactions
  useEffect(() => {
    const unsubs = seats.map((s, i) => {
      const y = s.y
      return registerInteraction({
        id: `bench:${i}`,
        label: s.label,
        position: [s.x, y + 0.7, s.z],
        radius: 2.7,
        onUse: () =>
          sitAt({
            eye: new Vector3(s.x, y + 1.28, s.z),
            stand: new Vector3(s.x - Math.sin(s.yaw) * 0.9, y + 0.2, s.z - Math.cos(s.yaw) * 0.9),
            yaw: s.yaw,
            listen: s.listen,
          }),
      })
    })
    // garden chime
    const gy = terrainHeight(-58, 56)
    unsubs.push(
      registerInteraction({
        id: 'chime:garden',
        label: 'Brush the wind chimes',
        position: [-58, gy + 2.4, 56],
        radius: 2.6,
        onUse: ringChime,
      }),
    )
    for (const surface of surfaces) unsubs.push(registerSurfaceBox(surface))
    unsubs.push(
      registerProbeSection('world', 'village-dressing', () => ({
        villageAnchors: VILLAGE_ANCHORS.length,
        villageStoryClusters: storyStats.clusters,
        villageDistricts: storyStats.districts,
        villagePropFamilies: storyStats.propFamilies,
      })),
    )
    return () => unsubs.forEach((fn) => fn())
  }, [seats, storyStats, surfaces])

  return (
    <group name="village:outdoor-props">
      <RigidBody type="fixed" colliders={false}>
        {colliders.map((c, i) => (
          <CuboidCollider
            key={i}
            args={[c.size[0] / 2, c.size[1] / 2, c.size[2] / 2]}
            position={c.pos}
            rotation={c.rot ?? [0, c.rotY ?? 0, 0]}
          />
        ))}
      </RigidBody>
      {merged.map(({ mat, geometry }) => (
        <mesh key={mat} geometry={geometry} material={mats.get(mat)!} castShadow receiveShadow />
      ))}
    </group>
  )
}

function buildOutdoor() {
  const plan = new BuildPlan()
  const seats: OutdoorSeat[] = []
  const surfaces: TraversalSurface[] = []
  const H = terrainHeight

  // --- plaza ---
  const py = PLAZA.h
  // fountain
  plan.cyl('concrete', { pos: [0, py + 0.25, -40], size: [4.6, 0.5, 4.6] }, 26)
  plan.cyl('stoneCounter', { pos: [0, py + 0.55, -40], size: [3.6, 0.16, 3.6] }, 26)
  plan.cyl('concrete', { pos: [0, py + 0.8, -40], size: [1.1, 0.7, 1.1] }, 18)
  plan.cyl('stoneCounter', { pos: [0, py + 1.2, -40], size: [1.9, 0.12, 1.9] }, 20)
  plan.collider({ pos: [0, py + 0.5, -40], size: [4.8, 1.4, 4.8] })
  // plaza benches + planters facing the fountain
  const benchRing: Array<[number, number, number]> = [
    [-8, -46, 0.9],
    [8, -46, -0.9],
    [-8, -33, 2.3],
    [8, -33, -2.3],
  ]
  for (const [bx, bz, yaw] of benchRing) {
    p.benchOutdoor(plan, bx, bz, yaw, py)
    seats.push({ x: bx, y: py, z: bz, yaw, label: 'Sit by the fountain' })
  }
  p.planterBox(plan, -14, -40, 0.5, 1.6, py)
  p.planterBox(plan, 14, -40, -0.5, 1.6, py)

  // --- shell-edge decks ---
  for (const d of DECKS) {
    const outward = Math.atan2(d.x / (170 * 170), d.z / (250 * 250))
    const yaw = Math.atan2(Math.sin(outward), Math.cos(outward))
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)
    plan.solid('woodDeck', { pos: [d.x, d.h + 0.12, d.z], size: [9, 0.24, 7], rot: [0, -yaw, 0] })
    // railings on the three outer sides
    const rail = (dx: number, dz: number, len: number, ry: number) => {
      const wx = d.x + dx * cos + dz * sin
      const wz = d.z - dx * sin + dz * cos
      plan.box('woodDark', {
        pos: [wx, d.h + 1.14, wz],
        size: [len, 0.08, 0.08],
        rot: [0, -yaw + ry, 0],
      })
      plan.box('woodDark', {
        pos: [wx, d.h + 0.7, wz],
        size: [len, 0.05, 0.05],
        rot: [0, -yaw + ry, 0],
      })
      plan.collider({
        pos: [wx, d.h + 0.8, wz],
        size: [ry === 0 ? len : 0.15, 1.35, ry === 0 ? 0.15 : len],
        rotY: -yaw,
      })
      const posts = Math.floor(len / 1.4)
      for (let i = 0; i <= posts; i++) {
        const off = -len / 2 + (i * len) / posts
        const px = wx + (ry === 0 ? off * cos : off * sin)
        const pz = wz - (ry === 0 ? off * sin : -off * cos)
        plan.box('woodDark', { pos: [px, d.h + 0.62, pz], size: [0.07, 1.1, 0.07] })
      }
    }
    rail(0, 3.4, 9, 0) // outer edge
    rail(-4.4, 0.2, 6.6, Math.PI / 2)
    rail(4.4, 0.2, 6.6, Math.PI / 2)
    // bench facing the sea
    const bx = d.x + 0 * cos + 1.4 * sin
    const bz = d.z - 0 * sin + 1.4 * cos
    p.benchOutdoor(plan, bx, bz, -yaw + Math.PI, d.h + 0.24)
    seats.push({ x: bx, y: d.h + 0.24, z: bz, yaw: yaw, label: 'Listen to the sea', listen: true })
    surfaces.push({
      minX: d.x - 5,
      maxX: d.x + 5,
      minZ: d.z - 5,
      maxZ: d.z + 5,
      surface: 'wood',
    })
  }

  // --- garden pond rim + chime post ---
  // Individual merged stones leave the animated water disc visible; the old
  // solid cylinder covered the entire pond.
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * Math.PI * 2
    plan.box('concrete', {
      pos: [
        -52 + Math.cos(angle) * 5.65,
        13.12 + Math.sin(i * 2.1) * 0.018,
        80 + Math.sin(angle) * 5.65,
      ],
      size: [1.12, 0.2, 0.54],
      rot: [0, -angle, ((i % 3) - 1) * 0.018],
    })
  }
  p.lampPostBase(plan, -58, 56 - 0.4)
  plan.box('woodDark', { pos: [-58, 2.9 + H(-58, 56), 56], size: [0.6, 0.06, 0.06] })
  p.windChime(plan, -58, 2.72 + H(-58, 56), 56.35)

  surfaces.push(...buildTraversalArchitecture(plan, H))

  // --- benches along scenic path spots ---
  const scenic: Array<[number, number, number, string]> = [
    [-4, -160, 0.15, 'Rest on the walk'],
    [-70, 44, 2.4, 'Sit near the gardens'],
    [4, 152, 3.0, 'Rest below the ridge'],
  ]
  for (const [sx, sz, yaw, label] of scenic) {
    const sy = H(sx, sz)
    p.benchOutdoor(plan, sx, sz, yaw, sy)
    seats.push({ x: sx, y: sy, z: sz, yaw, label })
  }

  buildDistrictDressing(plan, H, seats)
  const storyStats = buildVillageStoryClusters(plan, H)

  // --- lamp posts along all paths ---
  for (const [lx, lz] of collectLampSpots()) {
    p.lampPostBase(plan, lx, lz, H(lx, lz))
  }

  return { merged: plan.merge(), colliders: plan.colliders, seats, surfaces, storyStats }
}

function buildDistrictDressing(
  plan: BuildPlan,
  heightAt: (x: number, z: number) => number,
  seats: OutdoorSeat[],
): void {
  // Plaza — paired thresholds and a deeper planted perimeter turn the fountain
  // into a room rather than an object stranded on an open pad.
  p.thresholdFrame(plan, 0, -62, 0, heightAt(0, -62), 'fabricSand')
  p.thresholdFrame(plan, 0, -18, 0, heightAt(0, -18), 'fabricTeal')
  for (const [x, z, r, w] of [
    [-18, -48, 0.18, 2.4],
    [18, -48, -0.18, 2.4],
    [-18, -30, -0.18, 2.2],
    [18, -30, 0.18, 2.2],
  ] as const) {
    p.planterBox(plan, x, z, r, w, heightAt(x, z))
  }

  // Market Lane — two small covered counters establish a social silhouette
  // between the café and store without competing with their interiors.
  p.planterBox(plan, 24, -27, 0.25, 1.5, heightAt(24, -27))
  p.planterBox(plan, 54, -3, -0.4, 1.45, heightAt(54, -3))

  // Greenhouse Gardens — an arrival frame, productive raised beds, and a low
  // fence create foreground/midground layers around the pond and greenhouse.
  p.thresholdFrame(plan, -44, 53, 0.38, heightAt(-44, 53), 'fabricTeal')
  p.raisedGardenBed(plan, -76, 72, 0.18, heightAt(-76, 72), 4.2, 1.4, 71)
  p.raisedGardenBed(plan, -72, 84, -0.12, heightAt(-72, 84), 3.6, 1.35, 72)
  p.raisedGardenBed(plan, -64, 96, 0.32, heightAt(-64, 96), 3.4, 1.3, 73)
  p.fenceRun(plan, -82, 84, Math.PI / 2 - 0.08, 20, heightAt(-82, 84))
  const gardenSeatY = heightAt(-79, 94)
  p.benchOutdoor(plan, -79, 94, 2.72, gardenSeatY)
  seats.push({ x: -79, y: gardenSeatY, z: 94, yaw: 2.72, label: 'Sit among the garden beds' })

  // Quiet Path — pale residential fences, porch planting and a tucked reading
  // bench distinguish this lane from the commercial and garden districts.
  p.thresholdFrame(plan, -78, -42, 1.28, heightAt(-78, -42), 'fabricSand')
  p.fenceRun(plan, -108, -31, 0.14, 10, heightAt(-108, -31))
  p.fenceRun(plan, -112, 1, Math.PI / 2, 13, heightAt(-112, 1))
  p.fenceRun(plan, -104, 31, 0.2, 10, heightAt(-104, 31))
  for (const [x, z, r] of [
    [-106, -18, 1.45],
    [-110, 15, 1.58],
    [-98, 38, 1.3],
  ] as const) {
    p.planterBox(plan, x, z, r, 1.5, heightAt(x, z))
  }
  const quietSeatY = heightAt(-108, 12)
  p.benchOutdoor(plan, -108, 12, -1.5, quietSeatY)
  seats.push({ x: -108, y: quietSeatY, z: 12, yaw: -1.5, label: 'Read along the quiet path' })

  // Arts District — a procession of abstract verticals provides recognizable
  // navigation anchors from the plaza, gallery and east deck.
  p.thresholdFrame(plan, 57, 25, -0.95, heightAt(57, 25), 'fabricRust')
  p.outdoorSculpture(plan, 84, 50, 0.3, heightAt(84, 50), 'paint.coral', 91)
  p.outdoorSculpture(plan, 101, 38, 1.2, heightAt(101, 38), 'fabricTeal', 92)
  p.outdoorSculpture(plan, 116, 51, -0.5, heightAt(116, 51), 'paint.night', 93)
  const artsSeatY = heightAt(78, 62)
  p.benchOutdoor(plan, 78, 62, -2.15, artsSeatY)
  seats.push({ x: 78, y: artsSeatY, z: 62, yaw: -2.15, label: 'Sit among the sculptures' })

  // Wellness and observatory approaches receive restrained ceremonial frames
  // so their elevation changes read as intentional transitions.
  p.thresholdFrame(plan, -30, 103, -0.35, heightAt(-30, 103), 'fabricTeal')
  p.planterBox(plan, -24, 112, -0.2, 2.1, heightAt(-24, 112))
  p.thresholdFrame(plan, 2, 159, 0, heightAt(2, 159), 'paint.night')
}

// ---------------------------------------------------------------------------

/** Instanced lamp heads that glow at night + pooled real lights near the player. */
function LampGlows() {
  const quality = useQualityProfile()
  const spots = useMemo(() => {
    const all = collectLampSpots().map(([x, z]) => [x, terrainHeight(x, z) + 3.05, z] as const)
    // plus plaza + deck lamps
    return all
  }, [])
  const meshRef = useRef<InstancedMesh>(null)
  const matRef = useRef<MeshStandardMaterial>(null)
  const lightsRef = useRef<Array<PointLight | null>>([])
  const dummy = useMemo(() => new Object3D(), [])
  const geo = useMemo(() => new SphereGeometry(0.16, 10, 8), [])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    spots.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [spots, dummy])

  useFrame(() => {
    const night = runtime.time.celest.nightFactor
    const dusk = runtime.time.celest.duskFactor
    const on = Math.min(1, night * 1.4 + dusk * 0.5)
    if (matRef.current) matRef.current.emissiveIntensity = on * 2.2
    // pooled point lights: nearest N lamps
    const maxLights = quality.maxDynamicLights
    const pp = runtime.player.pos
    const nearest = spots
      .map((s, i) => ({ i, d: (s[0] - pp.x) ** 2 + (s[2] - pp.z) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, maxLights)
    lightsRef.current.forEach((light, li) => {
      if (!light) return
      const pick = nearest[li]
      if (!pick || on < 0.1 || pick.d > 45 * 45) {
        light.visible = false
        return
      }
      const s = spots[pick.i]
      light.visible = true
      light.position.set(s[0], s[1] - 0.15, s[2])
      light.intensity = 6.5 * on
    })
  })

  return (
    <>
      <instancedMesh ref={meshRef} args={[geo, undefined, spots.length]} frustumCulled={false}>
        <meshStandardMaterial
          ref={matRef}
          color="#3a3630"
          emissive={new Color('#ffd9a0')}
          emissiveIntensity={0}
        />
      </instancedMesh>
      {Array.from({ length: quality.maxDynamicLights }, (_, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lightsRef.current[i] = el
          }}
          visible={false}
          color="#ffcf96"
          distance={13}
          decay={1.7}
        />
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------

/** Pond + fountain water discs with a soft animated shimmer. */
function FeatureWater() {
  const matRef = useRef<MeshStandardMaterial>(null)
  useFrame((state) => {
    if (matRef.current) {
      matRef.current.opacity = 0.72 + Math.sin(state.clock.elapsedTime * 0.8) * 0.05
    }
  })
  return (
    <>
      {WATER_FEATURES.map((w) => (
        <mesh key={w.id} position={[w.x, w.y, w.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[w.r, 26]} />
          <meshStandardMaterial
            ref={w.id === 'pond' ? matRef : undefined}
            color="#4e93a8"
            transparent
            opacity={0.75}
            roughness={0.12}
          />
        </mesh>
      ))}
    </>
  )
}
