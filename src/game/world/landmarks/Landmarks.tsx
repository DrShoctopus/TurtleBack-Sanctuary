import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { runtime } from '../../core/runtime'
import { useSettings } from '../../state/settingsStore'
import { buildSchedule, type LandmarkEvent, type LandmarkType } from './schedule'
import { mulberry32 } from '../../core/rng'

const VISIBLE_RANGE = 1050
const SCHEDULE_LENGTH = 400 // ~46 hours of voyage; effectively endless

/**
 * Pooled landmark spawner. One instance of each landmark type is built lazily,
 * then repositioned/reused every time its type comes up in the seeded schedule.
 */
export function Landmarks() {
  const seed = useSettings((s) => s.worldSeed)
  const schedule = useMemo(() => buildSchedule(seed, SCHEDULE_LENGTH), [seed])
  const rootRef = useRef<Group>(null)
  const pool = useMemo(() => new Map<LandmarkType, Group>(), [])
  const active = useRef<Array<{ event: LandmarkEvent; node: Group }>>([])
  const cursor = useRef(0)

  useFrame((state) => {
    const root = rootRef.current
    if (!root) return
    const travel = runtime.travel.distance
    const t = state.clock.elapsedTime

    // spawn upcoming events
    while (
      cursor.current < schedule.length &&
      schedule[cursor.current].atDistance - travel < VISIBLE_RANGE
    ) {
      const event = schedule[cursor.current]
      cursor.current++
      let node = pool.get(event.type)
      if (!node) {
        node = BUILDERS[event.type]()
        pool.set(event.type, node)
        root.add(node)
      }
      if (node.userData.activeEvent) continue // type already on stage — skip this pass
      node.userData.activeEvent = event
      node.visible = true
      active.current.push({ event, node })
    }

    // position + animate + retire
    const night = runtime.time.celest.nightFactor
    for (let i = active.current.length - 1; i >= 0; i--) {
      const { event, node } = active.current[i]
      const rel = event.atDistance - travel // >0 ahead, <0 behind
      if (rel < -VISIBLE_RANGE) {
        node.visible = false
        node.userData.activeEvent = null
        active.current.splice(i, 1)
        continue
      }
      node.position.set(event.side * event.offset, 0, -rel)
      node.scale.setScalar(event.scale * (runtime.quality.landmarkDetail === 0 ? 0.9 : 1))
      node.userData.update?.(t, night, node)
    }
  })

  return <group ref={rootRef} />
}

// ---------------------------------------------------------------------------
// materials shared across landmarks
// ---------------------------------------------------------------------------

const stoneMat = new MeshStandardMaterial({ color: '#8a93a2', roughness: 0.9 })
const darkMat = new MeshStandardMaterial({ color: '#3c4552', roughness: 0.85 })
const glowWarm = new MeshBasicMaterial({ color: '#ffd9a0' })
const glowCool = new MeshBasicMaterial({ color: '#9fe8ff' })
const glassMat = new MeshStandardMaterial({
  color: '#bcd8e2',
  roughness: 0.15,
  metalness: 0.1,
  transparent: true,
  opacity: 0.55,
})
const greenMat = new MeshStandardMaterial({ color: '#5d7a4a', roughness: 0.95 })
const jellyMat = new MeshStandardMaterial({
  color: '#cfe3f5',
  emissive: new Color('#7fb8dd'),
  emissiveIntensity: 0.3,
  transparent: true,
  opacity: 0.42,
  side: DoubleSide,
  roughness: 0.4,
})

type Builder = () => Group
type UpdateFn = (t: number, night: number, node: Group) => void

function tagged(g: Group, update?: UpdateFn): Group {
  g.userData.update = update
  g.visible = false
  return g
}

// ---------------------------------------------------------------------------
// the ten landmarks
// ---------------------------------------------------------------------------

const BUILDERS: Record<LandmarkType, Builder> = {
  /** A glowing circular gate standing in the sea. */
  moonGate: () => {
    const g = new Group()
    const ring = new Mesh(new TorusGeometry(46, 5, 20, 60), stoneMat)
    ring.position.y = 34
    g.add(ring)
    const glow = new Mesh(new TorusGeometry(46, 1.6, 12, 60), glowWarm.clone())
    glow.position.y = 34
    g.add(glow)
    const base = new Mesh(new CylinderGeometry(10, 14, 20, 12), stoneMat)
    base.position.y = 2
    g.add(base)
    return tagged(g, (t, night) => {
      const m = glow.material as MeshBasicMaterial
      m.color.setHSL(0.09, 0.7, 0.55 + night * 0.3 + Math.sin(t * 0.7) * 0.05)
    })
  },

  /** A lighthouse striding across the horizon on impossibly tall legs. */
  stiltLighthouse: () => {
    const g = new Group()
    const body = new Group()
    const tower = new Mesh(
      new CylinderGeometry(7, 9, 46, 14),
      new MeshStandardMaterial({ color: '#c9c2b4', roughness: 0.8 }),
    )
    tower.position.y = 96
    body.add(tower)
    const cap = new Mesh(new ConeGeometry(9, 12, 14), darkMat)
    cap.position.y = 125
    body.add(cap)
    const lamp = new Mesh(new SphereGeometry(4.4, 14, 12), glowWarm.clone())
    lamp.position.y = 116
    body.add(lamp)
    const legL = new Mesh(new CylinderGeometry(2.2, 3.2, 82, 8), darkMat)
    const legR = legL.clone()
    body.add(legL, legR)
    g.add(body)
    return tagged(g, (t, night) => {
      const stride = t * 0.5
      legL.position.set(-10, 34 + Math.sin(stride) * 3, Math.cos(stride) * 14)
      legL.rotation.x = Math.cos(stride) * 0.22
      legR.position.set(10, 34 + Math.sin(stride + Math.PI) * 3, Math.cos(stride + Math.PI) * 14)
      legR.rotation.x = Math.cos(stride + Math.PI) * 0.22
      body.position.y = Math.sin(t * 1.0) * 1.4
      body.rotation.z = Math.sin(stride) * 0.02
      const m = lamp.material as MeshBasicMaterial
      const sweep = 0.5 + 0.5 * Math.sin(t * 1.6)
      m.color.setRGB(1, 0.85 * (0.5 + sweep * 0.5), 0.5).multiplyScalar(0.6 + night * 1.4 * sweep)
    })
  },

  /** A distant annular island — a ring of land with a lagoon of sky. */
  ringIsland: () => {
    const g = new Group()
    const ring = new Mesh(new TorusGeometry(60, 14, 14, 42), greenMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 4
    ring.scale.y = 0.55
    g.add(ring)
    const rng = mulberry32(77)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rng() * 0.4
      const tree = new Mesh(new ConeGeometry(4 + rng() * 3, 14 + rng() * 8, 7), greenMat)
      tree.position.set(Math.cos(a) * 60, 12, Math.sin(a) * 60)
      g.add(tree)
    }
    return tagged(g)
  },

  /** Enormous translucent jellyfish drifting in slow procession. */
  jellyfishProcession: () => {
    const g = new Group()
    const bells: Mesh[] = []
    const rng = mulberry32(31)
    for (let i = 0; i < 7; i++) {
      const bell = new Mesh(
        new SphereGeometry(14 + rng() * 10, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        jellyMat.clone(),
      )
      bell.position.set((rng() - 0.5) * 220, 30 + rng() * 55, (rng() - 0.5) * 320)
      bell.userData.phase = rng() * Math.PI * 2
      bells.push(bell)
      g.add(bell)
    }
    return tagged(g, (t, night) => {
      for (const bell of bells) {
        const ph = bell.userData.phase as number
        const pulse = 1 + Math.sin(t * 0.55 + ph) * 0.12
        bell.scale.set(pulse, 1 / pulse, pulse)
        bell.position.y += Math.sin(t * 0.3 + ph) * 0.02
        const m = bell.material as MeshStandardMaterial
        m.emissiveIntensity = 0.15 + night * 1.15 + Math.sin(t * 0.8 + ph) * 0.1
      }
    })
  },

  /** A floating modern rail station, tracks long gone. */
  skyStation: () => {
    const g = new Group()
    const slab = new Mesh(
      new BoxGeometry(120, 5, 34),
      new MeshStandardMaterial({ color: '#d8d2c6', roughness: 0.7 }),
    )
    slab.position.y = 58
    g.add(slab)
    const roof = new Mesh(new BoxGeometry(112, 3, 30), darkMat)
    roof.position.y = 76
    g.add(roof)
    for (let i = -2; i <= 2; i++) {
      const col = new Mesh(new CylinderGeometry(1.4, 1.4, 16, 8), darkMat)
      col.position.set(i * 24, 67, 0)
      g.add(col)
    }
    const sign = new Mesh(new BoxGeometry(26, 5, 1), glowCool.clone())
    sign.position.set(0, 70, 15.8)
    g.add(sign)
    const clock = new Mesh(new CylinderGeometry(4, 4, 1, 20), glowWarm.clone())
    clock.rotation.x = Math.PI / 2
    clock.position.set(40, 70, 15.5)
    g.add(clock)
    return tagged(g, (t, night, node) => {
      node.position.y = Math.sin(t * 0.22) * 3
      ;(sign.material as MeshBasicMaterial).color
        .setRGB(0.6, 0.9, 1)
        .multiplyScalar(0.4 + night * 1.3)
    })
  },

  /** A whale outlined in stars, swimming through the dusk sky. */
  whaleConstellation: () => {
    const g = new Group()
    const starMat = new MeshBasicMaterial({
      color: '#dfe9ff',
      blending: AdditiveBlending,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
    const pts: Array<[number, number, number]> = [
      [-60, 150, 0],
      [-38, 162, 4],
      [-12, 168, 0],
      [16, 164, -4],
      [40, 152, 0],
      [58, 138, 4],
      [44, 128, 0],
      [18, 124, -3],
      [-10, 128, 0],
      [-36, 136, 4],
      [-52, 130, 0],
      [-70, 118, 0],
      [56, 160, 0],
      [70, 170, 0],
    ]
    const stars: Mesh[] = []
    for (const [x, y, z] of pts) {
      const s = new Mesh(new SphereGeometry(1.6, 8, 8), starMat.clone())
      s.position.set(x, y, z)
      stars.push(s)
      g.add(s)
    }
    return tagged(g, (t, night, node) => {
      const vis = Math.max(0, night * 1.4 - 0.1)
      for (let i = 0; i < stars.length; i++) {
        const m = stars[i].material as MeshBasicMaterial
        m.opacity = vis * (0.55 + 0.45 * Math.sin(t * 1.1 + i * 1.7))
      }
      node.position.y = Math.sin(t * 0.1) * 6
    })
  },

  /** Sheer glass monoliths rising from the water. */
  glassMonoliths: () => {
    const g = new Group()
    const rng = mulberry32(55)
    for (let i = 0; i < 6; i++) {
      const h = 60 + rng() * 90
      const mono = new Mesh(new BoxGeometry(10 + rng() * 8, h, 6 + rng() * 6), glassMat.clone())
      mono.position.set((rng() - 0.5) * 150, h / 2 - 6, (rng() - 0.5) * 200)
      mono.rotation.y = rng() * Math.PI
      g.add(mono)
      const edge = new Mesh(new BoxGeometry(0.8, h, 0.8), glowCool.clone())
      edge.position.copy(mono.position)
      edge.position.x += 5
      g.add(edge)
    }
    return tagged(g, (t, night, node) => {
      node.children.forEach((c, i) => {
        const mesh = c as Mesh
        const m = mesh.material as MeshBasicMaterial
        if (m === undefined || !('color' in m)) return
        if ((mesh.geometry as BoxGeometry).parameters?.width === 0.8) {
          ;(m as MeshBasicMaterial).color
            .setRGB(0.5, 0.85, 1)
            .multiplyScalar(0.25 + night * 1.2 + Math.sin(t + i) * 0.08)
        }
      })
    })
  },

  /** An island hanging upside-down, raining upward into the clouds. */
  invertedIsland: () => {
    const g = new Group()
    const rock = new Mesh(
      new IcosahedronGeometry(34, 1),
      new MeshStandardMaterial({ color: '#7a705f', roughness: 0.95, flatShading: true }),
    )
    rock.position.y = 120
    rock.scale.y = 1.25
    g.add(rock)
    const grassCap = new Mesh(new IcosahedronGeometry(30, 1), greenMat)
    grassCap.position.y = 106
    grassCap.scale.set(1.06, 0.5, 1.06)
    g.add(grassCap)
    // upward rain: a column of faint streaks
    const drops: Mesh[] = []
    const dropMat = new MeshBasicMaterial({ color: '#bcd8e8', transparent: true, opacity: 0.5 })
    const rng = mulberry32(99)
    for (let i = 0; i < 26; i++) {
      const d = new Mesh(new BoxGeometry(0.5, 6 + rng() * 5, 0.5), dropMat)
      d.position.set((rng() - 0.5) * 44, rng() * 100, (rng() - 0.5) * 44)
      d.userData.speed = 14 + rng() * 18
      drops.push(d)
      g.add(d)
    }
    return tagged(g, (t, _n, node) => {
      for (const d of drops) {
        d.position.y += (d.userData.speed as number) * 0.016
        if (d.position.y > 104) d.position.y = 4
      }
      node.rotation.y = t * 0.02
    })
  },

  /** A field of warm lanterns adrift on the water. */
  lanternField: () => {
    const g = new Group()
    const rng = mulberry32(21)
    const lanterns: Mesh[] = []
    const lanternGeometry = new SphereGeometry(1, 12, 8)
    for (let i = 0; i < 34; i++) {
      const material = new MeshBasicMaterial({
        color: '#ffc879',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      })
      const l = new Mesh(lanternGeometry, material)
      l.position.set((rng() - 0.5) * 260, 1.5, (rng() - 0.5) * 340)
      const scale = 0.8 + rng() * 0.55
      l.scale.set(scale, scale * 0.72, scale)
      l.userData.phase = rng() * Math.PI * 2
      lanterns.push(l)
      g.add(l)
    }
    return tagged(g, (t, night) => {
      for (const l of lanterns) {
        const ph = l.userData.phase as number
        l.position.y = 1.5 + Math.sin(t * 0.7 + ph) * 0.7
        l.rotation.y = Math.sin(t * 0.3 + ph) * 0.4
        const material = l.material as MeshBasicMaterial
        material.opacity = Math.max(0, (night - 0.16) / 0.84) * 0.82
        l.visible = material.opacity > 0.01
        material.color.setHSL(0.085, 0.72, 0.42 + night * 0.22 + Math.sin(t * 1.3 + ph) * 0.045)
      }
    })
  },

  /** A city skyline mirrored in the sky — its reflection has no source. */
  mirrorCity: () => {
    const g = new Group()
    const rng = mulberry32(88)
    const cityMat = new MeshStandardMaterial({
      color: '#5b6a80',
      roughness: 0.6,
      transparent: true,
      opacity: 0.8,
    })
    const winMat = new MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.75 })
    const towers: Mesh[] = []
    for (let i = 0; i < 14; i++) {
      const w = 8 + rng() * 14
      const h = 30 + rng() * 70
      const tower = new Mesh(new BoxGeometry(w, h, w), cityMat)
      // hangs from the sky, upside down
      tower.position.set((rng() - 0.5) * 240, 190 - h / 2, (rng() - 0.5) * 60)
      towers.push(tower)
      g.add(tower)
      const win = new Mesh(new BoxGeometry(w * 0.7, h * 0.8, 0.6), winMat)
      win.position.copy(tower.position)
      win.position.z += w / 2
      g.add(win)
    }
    return tagged(g, (t, night, node) => {
      winMat.opacity = 0.15 + night * 0.7
      cityMat.opacity = 0.55 + night * 0.25
      node.position.y = Math.sin(t * 0.13) * 4
    })
  },
}

// ---------------------------------------------------------------------------
// ambient sea life that shares the endless-travel treadmill
// ---------------------------------------------------------------------------

/** Distant gulls by day, faint drifting lights by night. */
export function AmbientLife() {
  const quiet = useSettings((s) => s.quietMode)
  const gullsRef = useRef<Group>(null)
  const gulls = useMemo(() => {
    const rng = mulberry32(404)
    return Array.from({ length: 9 }, () => ({
      radius: 120 + rng() * 320,
      height: 40 + rng() * 60,
      speed: 0.05 + rng() * 0.06,
      phase: rng() * Math.PI * 2,
      flap: 2 + rng() * 2,
    }))
  }, [])
  const wingGeo = useMemo(() => new BoxGeometry(3.2, 0.12, 0.9), [])
  const bodyMat = useMemo(() => new MeshStandardMaterial({ color: '#e8ecef', roughness: 0.8 }), [])

  useFrame((state) => {
    const g = gullsRef.current
    if (!g) return
    const t = state.clock.elapsedTime
    const day = 1 - runtime.time.celest.nightFactor
    g.visible = !quiet && day > 0.25 && runtime.weather.rain < 0.5
    if (!g.visible) return
    g.children.forEach((bird, i) => {
      const cfg = gulls[i]
      const a = t * cfg.speed + cfg.phase
      bird.position.set(
        Math.cos(a) * cfg.radius,
        cfg.height + Math.sin(t * 0.4 + i) * 4,
        Math.sin(a) * cfg.radius - 60,
      )
      bird.rotation.y = -a - Math.PI / 2
      const flap = Math.sin(t * cfg.flap + i)
      const l = bird.children[0] as Mesh
      const r = bird.children[1] as Mesh
      if (l && r) {
        l.rotation.z = 0.25 + flap * 0.5
        r.rotation.z = -0.25 - flap * 0.5
      }
    })
  })

  return (
    <group ref={gullsRef}>
      {gulls.map((_, i) => (
        <group key={i}>
          <mesh geometry={wingGeo} material={bodyMat} position={[-1.5, 0, 0]} />
          <mesh geometry={wingGeo} material={bodyMat} position={[1.5, 0, 0]} />
        </group>
      ))}
    </group>
  )
}
