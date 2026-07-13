/**
 * Bespoke interior + envelope layouts per building kind. Everything is in
 * building-local coordinates (door usually faces +z); Building.tsx applies the
 * world transform, wires interactions to real handlers, and adds dynamics.
 */
import type { BuildingSpec } from '../../config/layout'
import { BuildPlan } from '../kit/geometry'
import { buildShell, type DoorSpec } from './shellKit'
import * as p from '../kit/props'

export interface InteractionSpec {
  id: string
  kind:
    | 'sit'
    | 'lamp'
    | 'tea'
    | 'coffee'
    | 'tv'
    | 'stereo'
    | 'journal'
    | 'book'
    | 'listen'
    | 'water'
    | 'artLight'
    | 'breath'
    | 'telescope'
    | 'chime'
    | 'blinds'
    | 'goods'
    | 'sleep'
  pos: [number, number, number]
  radius?: number
  /** for sit: eye + stand data */
  seat?: {
    eye: [number, number, number]
    stand: [number, number, number]
    yaw: number
    listen?: boolean
  }
  label?: string
}

export interface BuildingExtras {
  interactions: InteractionSpec[]
  lights: Array<{ pos: [number, number, number]; color?: string; intensity?: number }>
  lampShades: Array<{ pos: [number, number, number]; r?: number }>
  artworks: Array<{ pos: [number, number, number]; rotY: number; w: number; h: number }>
  tvScreen?: { pos: [number, number, number]; rotY: number; w: number; h: number }
  poolWaters: Array<{ pos: [number, number, number]; w: number; d: number }>
  interior: { halfX: number; halfZ: number; halfY: number; cy: number }
  flavor: 'home' | 'cafe' | 'greenhouse' | 'bath' | 'observatory' | 'room'
  door: DoorSpec | null
}

export interface BuiltInterior {
  plan: BuildPlan
  glow: BuildPlan
  extras: BuildingExtras
}

function fresh(flavor: BuildingExtras['flavor']): {
  plan: BuildPlan
  glow: BuildPlan
  extras: BuildingExtras
} {
  return {
    plan: new BuildPlan(),
    glow: new BuildPlan(),
    extras: {
      interactions: [],
      lights: [],
      lampShades: [],
      artworks: [],
      poolWaters: [],
      interior: { halfX: 4, halfZ: 4, halfY: 1.8, cy: 1.8 },
      flavor,
      door: null,
    },
  }
}

const seatSpec = (
  id: string,
  x: number,
  z: number,
  yaw: number,
  opts?: { label?: string; eyeH?: number; listen?: boolean },
): InteractionSpec => ({
  id,
  kind: 'sit',
  pos: [x, 0.6, z],
  label: opts?.label,
  seat: {
    eye: [x, opts?.eyeH ?? 1.25, z],
    stand: [x - Math.sin(yaw) * 0.7, 0.2, z - Math.cos(yaw) * 0.7 + 0.5],
    yaw,
    listen: opts?.listen,
  },
})

type InteriorFn = (spec: BuildingSpec) => BuiltInterior

// ---------------------------------------------------------------------------

const home: InteriorFn = () => {
  const { plan, glow, extras } = fresh('home')
  const W = 11.5
  const D = 8.5
  const H = 3.0
  extras.door = buildShell(plan, glow, {
    w: W,
    d: D,
    h: H,
    wallMat: 'plasterWarm',
    trimMat: 'woodDark',
    floorMat: 'woodDeck',
    roof: 'flat',
    porch: true,
    identity: 'home',
    accentMat: 'woodPale',
    door: { wall: 0, x: -3.2 },
    windows: [
      { wall: 0, x: 0.6, w: 2.6, h: 1.7, sill: 0.75 },
      { wall: 0, x: 3.6, w: 1.8, h: 1.7, sill: 0.75 },
      { wall: 1, x: -2.8, w: 2.8, h: 1.7, sill: 0.75 },
      { wall: 1, x: 2.4, w: 1.6, h: 1.3, sill: 1.0 },
      { wall: 2, x: 0.5, w: 2.6, h: 1.8, sill: 0.7 },
      { wall: 3, x: -1.5, w: 1.6, h: 1.3, sill: 0.95 },
    ],
  })
  extras.interior = { halfX: W / 2, halfZ: D / 2, halfY: H / 2 + 0.2, cy: H / 2 }

  // living area (east half, window view)
  p.rug(plan, 2.6, 0.6, 0.2, 3.4, 2.5)
  p.sofa(plan, 2.6, 1.7, Math.PI, 'fabricSand')
  p.armchair(plan, 4.4, 0.4, -Math.PI / 2 - 0.3, 'fabricTeal')
  p.coffeeTable(plan, 2.6, 0.35, 0.1)
  p.tvUnit(plan, 2.6, -3.6, 0)
  extras.tvScreen = { pos: [2.6, 1.45, -3.75], rotY: 0, w: 1.62, h: 0.95 }
  p.stereoCabinet(plan, 5.05, -2.2, -Math.PI / 2)
  p.plantPot(plan, 5.0, 3.3, 'l', 21)
  p.floorLampBase(plan, 0.9, -3.4)
  extras.lampShades.push({ pos: [0.9, 1.62, -3.4] })

  // kitchen + dining (west half)
  p.kitchenette(plan, -3.4, -3.85, Math.PI, 3.4)
  p.kettleSet(plan, -2.6, 0.97, -3.8)
  p.diningTable(plan, -3.1, -0.9, Math.PI / 2, 4)
  p.pendantCord(plan, -3.1, H, -0.9, 0.9)
  extras.lampShades.push({ pos: [-3.1, H - 1.05, -0.9], r: 0.22 })

  // bedroom nook (behind a partition, west front)
  plan.solid('plasterWarm', { pos: [-1.15, H / 2 + 0.14, 2.2], size: [0.18, H, 4.2] })
  p.bed(plan, -3.6, 2.6, Math.PI / 2)
  p.nightstand(plan, -2.5, 3.7, 0)
  p.wardrobe(plan, -5.2, 2.0, Math.PI / 2)
  extras.lampShades.push({ pos: [-2.5, 0.86, 3.7], r: 0.13 })

  // study corner (east front)
  p.desk(plan, 4.6, 3.5, Math.PI)
  p.chair(plan, 4.6, 2.7, Math.PI)
  p.shelfUnit(plan, 5.45, 1.8, -Math.PI / 2, 1.6, 1.9, true, 31)

  // bathroom nook (back west corner): partition with open doorway, sink, shower
  plan.solid('plasterCool', { pos: [-4.6, H / 2 + 0.14, -2.9], size: [0.16, H, 1.7] })
  plan.solid('ceramicWhite', { pos: [-5.25, 0.5, -2.5], size: [0.6, 0.85, 0.55] })
  plan.box('metalBrushed', { pos: [-5.25, 1.35, -2.5], size: [0.5, 0.65, 0.04] })
  plan.box('glass', { pos: [-4.95, 1.1, -3.6], size: [1.4, 2.0, 0.04], rot: [0, Math.PI / 2, 0] })
  p.towelStack(plan, -5.3, 1.0, -3.4)

  // wall art (dynamic canvases)
  p.paintingFrame(plan, 0.5, 1.7, -4.11, 0, 1.5, 1.0)
  extras.artworks.push({ pos: [0.5, 1.7, -4.06], rotY: 0, w: 1.4, h: 0.9 })
  p.paintingFrame(plan, -5.6, 1.6, 0.4, Math.PI / 2, 1.0, 0.75)
  extras.artworks.push({ pos: [-5.55, 1.6, 0.4], rotY: Math.PI / 2, w: 0.9, h: 0.65 })

  // interactions
  extras.interactions.push(
    { id: 'tv', kind: 'tv', pos: [2.6, 1.4, -3.7], radius: 3.4 },
    { id: 'stereo', kind: 'stereo', pos: [5.05, 1.0, -2.2], radius: 2.6 },
    { id: 'kettle', kind: 'tea', pos: [-2.6, 1.1, -3.8], radius: 2.4 },
    { id: 'journal', kind: 'journal', pos: [4.6, 0.9, 3.5], radius: 2.4 },
    { id: 'lamp', kind: 'lamp', pos: [0.9, 1.5, -3.4], radius: 2.4 },
    { id: 'blinds', kind: 'blinds', pos: [4.85, 1.5, 0.5], radius: 2.2 },
    { id: 'sleep', kind: 'sleep', pos: [-3.6, 0.7, 2.6], radius: 2.2 },
    seatSpec('sofa', 2.6, 1.55, Math.PI, { label: 'Sit on the sofa' }),
    seatSpec('armchair', 4.4, 0.4, -Math.PI / 2 - 0.3, { label: 'Sink into the armchair' }),
  )
  extras.lights.push(
    { pos: [1.6, 2.5, -1], intensity: 14 },
    { pos: [-3.4, 2.5, 1.6], intensity: 9 },
  )
  return { plan, glow, extras }
}

// ---------------------------------------------------------------------------

const cafe: InteriorFn = () => {
  const { plan, glow, extras } = fresh('cafe')
  const W = 9.5
  const D = 7.5
  const H = 3.2
  extras.door = buildShell(plan, glow, {
    w: W,
    d: D,
    h: H,
    wallMat: 'paint.coral',
    trimMat: 'woodDark',
    floorMat: 'woodDeck',
    roof: 'butterfly',
    porch: true,
    identity: 'cafe',
    accentMat: 'fabricRust',
    door: { wall: 0, x: 0 },
    windows: [
      { wall: 0, x: -3.0, w: 2.4, h: 1.9, sill: 0.6 },
      { wall: 0, x: 3.0, w: 2.4, h: 1.9, sill: 0.6 },
      { wall: 2, x: -0.5, w: 3.2, h: 1.6, sill: 0.8 },
      { wall: 3, x: 0.5, w: 2.4, h: 1.6, sill: 0.8 },
    ],
  })
  extras.interior = { halfX: W / 2, halfZ: D / 2, halfY: H / 2 + 0.2, cy: H / 2 }

  p.cafeCounter(plan, -0.4, -2.6, 0, 4.2)
  p.mugCluster(plan, -1.8, 1.16, -2.5, 4, 17)
  // menu board
  plan.box('paint.night', { pos: [-0.4, 2.2, -3.62], size: [2.6, 1.0, 0.06] })
  // tables
  const tables: Array<[number, number]> = [
    [-2.9, 0.9],
    [-0.4, 1.6],
    [2.4, 0.6],
    [3.2, -1.6],
  ]
  tables.forEach(([tx, tz], i) => {
    p.stool(plan, tx - 0.62, tz, 0)
    p.stool(plan, tx + 0.62, tz, 0)
    plan.cyl('woodWarm', { pos: [tx, 0.74, tz], size: [0.85, 0.05, 0.85] }, 16)
    plan.cyl('metalDark', { pos: [tx, 0.37, tz], size: [0.09, 0.74, 0.09] }, 10)
    plan.collider({ pos: [tx, 0.4, tz], size: [0.8, 0.8, 0.8] })
    extras.interactions.push(
      seatSpec(`seat${i}a`, tx - 0.62, tz, -Math.PI / 2, { label: 'Sit with a view', eyeH: 1.3 }),
    )
  })
  p.plantPot(plan, 4.2, 2.9, 'l', 8)
  p.plantPot(plan, -4.2, 2.8, 'm', 9)
  for (const lx of [-2.4, 0, 2.4]) {
    p.pendantCord(plan, lx, H, -0.5, 1.1)
    extras.lampShades.push({ pos: [lx, H - 1.25, -0.5], r: 0.24 })
  }
  extras.interactions.push({ id: 'brew', kind: 'coffee', pos: [-1.5, 1.35, -2.6], radius: 2.6 })
  extras.lights.push({ pos: [0, 2.4, -0.5], intensity: 16, color: '#ffd2a0' })
  return { plan, glow, extras }
}

// ---------------------------------------------------------------------------

const bookshop: InteriorFn = () => {
  const { plan, glow, extras } = fresh('room')
  const W = 8.5
  const D = 7
  const H = 3.4
  extras.door = buildShell(plan, glow, {
    w: W,
    d: D,
    h: H,
    wallMat: 'plasterSage',
    trimMat: 'woodDark',
    floorMat: 'woodDeck',
    roof: 'shed',
    identity: 'bookshop',
    accentMat: 'fabricSand',
    door: { wall: 0, x: 1.8 },
    windows: [
      { wall: 0, x: -1.6, w: 2.6, h: 2.0, sill: 0.55 },
      { wall: 2, x: 0, w: 2.0, h: 1.5, sill: 0.9 },
      { wall: 1, x: 0, w: 2.2, h: 1.4, sill: 1.1 },
    ],
  })
  extras.interior = { halfX: W / 2, halfZ: D / 2, halfY: H / 2 + 0.2, cy: H / 2 }

  p.shelfUnit(plan, -3.95, -1.0, Math.PI / 2, 4.4, 2.6, true, 41)
  p.shelfUnit(plan, 0, -3.25, 0, 6.6, 2.6, true, 42)
  p.shelfUnit(plan, 4.0, -0.6, -Math.PI / 2, 3.6, 2.2, true, 43)
  // center display table
  plan.box('woodWarm', { pos: [0.2, 0.5, -0.4], size: [2.2, 0.08, 1.0] })
  plan.box('woodDark', { pos: [0.2, 0.24, -0.4], size: [1.9, 0.44, 0.8] })
  plan.collider({ pos: [0.2, 0.5, -0.4], size: [2.2, 1, 1] })
  const rngBooks: Array<[number, number, number]> = [
    [-0.6, 0.58, -0.5],
    [0.1, 0.58, -0.2],
    [0.8, 0.58, -0.55],
  ]
  for (const [bx, by, bz] of rngBooks) {
    plan.box('paint.coral', { pos: [bx, by, bz], size: [0.24, 0.04, 0.32], rot: [0, bx, 0] })
  }
  // reading corner
  p.rug(plan, 2.6, 2.2, 0.4, 2.2, 1.8)
  p.armchair(plan, 2.9, 2.3, -2.4, 'fabricRust')
  p.floorLampBase(plan, 3.7, 1.6)
  extras.lampShades.push({ pos: [3.7, 1.62, 1.6] })
  p.plantPot(plan, -3.9, 2.6, 'm', 12)

  extras.interactions.push(
    { id: 'browse', kind: 'book', pos: [0.2, 0.8, -0.4], radius: 2.4 },
    { id: 'browse2', kind: 'book', pos: [0, 1.4, -3.1], radius: 2.2 },
    { id: 'lamp', kind: 'lamp', pos: [3.7, 1.5, 1.6], radius: 2.2 },
    seatSpec('chair', 2.9, 2.3, -2.4, { label: 'Read a while' }),
  )
  extras.lights.push({ pos: [0.5, 2.6, -0.5], intensity: 11, color: '#ffdcb0' })
  return { plan, glow, extras }
}

// ---------------------------------------------------------------------------

const records: InteriorFn = () => {
  const { plan, glow, extras } = fresh('room')
  const W = 8
  const D = 6.5
  const H = 3.0
  extras.door = buildShell(plan, glow, {
    w: W,
    d: D,
    h: H,
    wallMat: 'paint.night',
    trimMat: 'metalDark',
    floorMat: 'concrete',
    roof: 'flat',
    identity: 'records',
    accentMat: 'paint.coral',
    door: { wall: 0, x: -2.2 },
    windows: [
      { wall: 0, x: 1.4, w: 3.2, h: 1.9, sill: 0.6 },
      { wall: 2, x: 0.4, w: 2.0, h: 1.4, sill: 0.9 },
    ],
  })
  extras.interior = { halfX: W / 2, halfZ: D / 2, halfY: H / 2 + 0.2, cy: H / 2 }

  p.recordBin(plan, -1.6, -0.4, 0)
  p.recordBin(plan, 0.4, -0.4, 0)
  p.recordBin(plan, -0.6, 1.4, 0)
  p.shelfUnit(plan, -3.7, -1.2, Math.PI / 2, 3.2, 2.2, false, 51)
  // record wall display
  const covers = [
    'paint.coral',
    'fabricTeal',
    'ceramicTerracotta',
    'fabricRust',
    'ceramicWhite',
    'fabricSand',
  ] as const
  covers.forEach((c, i) => {
    plan.box(c, { pos: [-2.4 + i * 1.0, 2.1, -3.13], size: [0.62, 0.62, 0.04] })
  })
  // listening station: counter, tape deck, headphone hook, stool
  plan.solid('woodWarm', { pos: [2.9, 0.5, -2.35], size: [1.5, 1.0, 0.6] })
  plan.box('stoneCounter', { pos: [2.9, 1.03, -2.35], size: [1.6, 0.06, 0.68] })
  plan.box('metalDark', { pos: [2.7, 1.16, -2.4], size: [0.55, 0.2, 0.3] })
  plan.cyl('metalDark', { pos: [3.45, 1.28, -2.35], size: [0.2, 0.06, 0.2] }, 10)
  p.stool(plan, 2.9, -1.2, 0)
  extras.interactions.push(
    { id: 'listen', kind: 'listen', pos: [2.9, 1.1, -2.35], radius: 2.4 },
    {
      id: 'browse',
      kind: 'goods',
      pos: [-0.6, 1.0, 0.5],
      radius: 2.6,
      label: 'Flip through records',
    },
    seatSpec('stool', 2.9, -1.2, 0, { label: 'Listen a while', eyeH: 1.3 }),
  )
  extras.lights.push({ pos: [0, 2.3, -0.4], intensity: 10, color: '#ffc9a8' })
  return { plan, glow, extras }
}

// ---------------------------------------------------------------------------

const plants: InteriorFn = () => {
  const { plan, glow, extras } = fresh('greenhouse')
  const W = 8.5
  const D = 9.5
  const H = 3.2
  extras.door = buildShell(plan, glow, {
    w: W,
    d: D,
    h: H,
    wallMat: 'plasterSage',
    trimMat: 'metalDark',
    floorMat: 'concrete',
    roof: 'glassGable',
    identity: 'plants',
    accentMat: 'plasterSage',
    door: { wall: 0, x: 0 },
    windows: [
      { wall: 0, x: -2.8, w: 2.2, h: 2.2, sill: 0.4 },
      { wall: 0, x: 2.8, w: 2.2, h: 2.2, sill: 0.4 },
      { wall: 2, x: -1.5, w: 3.4, h: 2.3, sill: 0.4 },
      { wall: 2, x: 2.4, w: 1.6, h: 2.3, sill: 0.4 },
      { wall: 3, x: 1.5, w: 3.4, h: 2.3, sill: 0.4 },
      { wall: 1, x: 0, w: 3.4, h: 2.2, sill: 0.5 },
    ],
  })
  extras.interior = { halfX: W / 2, halfZ: D / 2, halfY: H / 2 + 0.6, cy: H / 2 }

  // plant tables in rows
  for (const rowZ of [-2.6, 0.2]) {
    plan.box('woodDeck', { pos: [0, 0.78, rowZ], size: [6.4, 0.07, 1.15] })
    for (const lx of [-2.8, -0.9, 1, 2.9]) {
      plan.box('metalDark', { pos: [lx, 0.39, rowZ], size: [0.08, 0.78, 1.0] })
    }
    plan.collider({ pos: [0, 0.6, rowZ], size: [6.4, 1.2, 1.15] })
    for (let i = 0; i < 7; i++) {
      const px = -2.7 + i * 0.9
      plan.cyl('ceramicTerracotta', { pos: [px, 0.92, rowZ], size: [0.24, 0.2, 0.24] }, 10)
      plan.sphere(
        i % 2 ? 'leafGreen' : 'leafDeep',
        { pos: [px, 1.14, rowZ], size: [0.36, 0.32, 0.36] },
        8,
      )
    }
  }
  // floor specimens
  p.plantPot(plan, -3.5, 3.6, 'l', 61)
  p.plantPot(plan, 3.5, 3.4, 'l', 62)
  p.plantPot(plan, 3.6, -3.9, 'm', 63)
  // potting bench + watering can
  p.kitchenette(plan, -2.4, -4.35, Math.PI, 2.6)
  plan.box('metalBrushed', { pos: [-1.4, 1.05, -4.3], size: [0.3, 0.25, 0.2] })

  extras.interactions.push(
    { id: 'water1', kind: 'water', pos: [0, 1.0, -2.6], radius: 2.8 },
    { id: 'water2', kind: 'water', pos: [0, 1.0, 0.2], radius: 2.8 },
    { id: 'mist', kind: 'water', pos: [-3.5, 1.2, 3.6], radius: 2.2, label: 'Mist the big fern' },
    seatSpec('stool', 2.6, 2.9, -2.6, { label: 'Sit among the leaves', eyeH: 1.3 }),
  )
  p.stool(plan, 2.6, 2.9, 0)
  extras.lights.push({ pos: [0, 2.5, -1], intensity: 10, color: '#e8f5d8' })
  return { plan, glow, extras }
}

// ---------------------------------------------------------------------------

const gallery: InteriorFn = () => {
  const { plan, glow, extras } = fresh('room')
  const W = 10.5
  const D = 8
  const H = 3.8
  extras.door = buildShell(plan, glow, {
    w: W,
    d: D,
    h: H,
    wallMat: 'plasterCool',
    trimMat: 'metalDark',
    floorMat: 'concrete',
    roof: 'flat',
    identity: 'gallery',
    accentMat: 'ceramicWhite',
    door: { wall: 0, x: 0, w: 1.8 },
    windows: [
      { wall: 0, x: -3.6, w: 1.4, h: 2.6, sill: 0.4 },
      { wall: 0, x: 3.6, w: 1.4, h: 2.6, sill: 0.4 },
    ],
  })
  extras.interior = { halfX: W / 2, halfZ: D / 2, halfY: H / 2 + 0.2, cy: H / 2 }

  // canvases on three walls
  const walls: Array<{ x: number; z: number; rotY: number }> = [
    { x: -2.8, z: -3.86, rotY: 0 },
    { x: 0.4, z: -3.86, rotY: 0 },
    { x: 3.4, z: -3.86, rotY: 0 },
    { x: -5.11, z: -1, rotY: Math.PI / 2 },
    { x: -5.11, z: 1.8, rotY: Math.PI / 2 },
    { x: 5.11, z: 0.2, rotY: -Math.PI / 2 },
  ]
  walls.forEach((wSpec, i) => {
    p.paintingFrame(plan, wSpec.x, 1.85, wSpec.z, wSpec.rotY, i % 2 ? 1.2 : 1.7, i % 2 ? 1.5 : 1.15)
    extras.artworks.push({
      pos: [
        wSpec.x + (wSpec.rotY === 0 ? 0 : wSpec.rotY > 0 ? 0.04 : -0.04),
        1.85,
        wSpec.z + (wSpec.rotY === 0 ? 0.04 : 0),
      ],
      rotY: wSpec.rotY,
      w: i % 2 ? 1.1 : 1.6,
      h: i % 2 ? 1.4 : 1.05,
    })
  })
  p.plinth(plan, -2.2, 0.6, 71)
  p.plinth(plan, 1.4, -0.8, 72)
  p.plinth(plan, 3.4, 1.6, 73)
  p.benchOutdoor(plan, 0, 1.8, Math.PI)
  // studio corner
  p.easel(plan, 4.2, 2.9, -0.6)
  p.easel(plan, 3.2, 3.2, 0.3)
  extras.interactions.push(
    { id: 'lighting', kind: 'artLight', pos: [0.4, 1.8, -3.7], radius: 3.2 },
    seatSpec('bench', 0, 1.9, Math.PI, { label: 'Sit with the art' }),
  )
  extras.lights.push({ pos: [0, 3.1, -1.4], intensity: 18, color: '#fff4e2' })
  return { plan, glow, extras }
}

// ---------------------------------------------------------------------------

const bathhouse: InteriorFn = () => {
  const { plan, glow, extras } = fresh('bath')
  const W = 11
  const D = 9
  const H = 3.4
  extras.door = buildShell(plan, glow, {
    w: W,
    d: D,
    h: H,
    wallMat: 'plasterCool',
    trimMat: 'woodDark',
    floorMat: 'concrete',
    roof: 'flat',
    identity: 'bathhouse',
    accentMat: 'stoneCounter',
    door: { wall: 0, x: 3.6 },
    windows: [
      { wall: 0, x: -1.4, w: 3.2, h: 1.2, sill: 1.5 },
      { wall: 1, x: 0, w: 4.2, h: 1.2, sill: 1.5 },
      { wall: 3, x: 0, w: 2.6, h: 1.1, sill: 1.6 },
    ],
  })
  extras.interior = { halfX: W / 2, halfZ: D / 2, halfY: H / 2 + 0.2, cy: H / 2 }

  // two sunken pools
  p.bathPool(plan, -2.2, -1.4, 4.4, 3.2)
  extras.poolWaters.push({ pos: [-2.2, 0.32, -1.4], w: 4.4, d: 3.2 })
  p.bathPool(plan, 2.8, 1.8, 3.0, 2.4)
  extras.poolWaters.push({ pos: [2.8, 0.32, 1.8], w: 3.0, d: 2.4 })
  // benches + towels + lockers
  p.benchOutdoor(plan, -3.4, 2.9, 0)
  p.benchOutdoor(plan, 0.8, -3.6, Math.PI)
  p.towelStack(plan, 4.6, 1.0, -3.3)
  plan.solid('woodWarm', { pos: [4.75, 0.9, -3.3], size: [0.9, 1.8, 0.5] })
  p.plantPot(plan, -4.6, 3.4, 'l', 81)
  p.plantPot(plan, 4.6, 3.6, 'm', 82)
  // candles along the pool edge (emissive dots via lampShades, always soft)
  extras.lampShades.push(
    { pos: [-4.5, 0.55, -1.4], r: 0.06 },
    { pos: [0.1, 0.55, -3.0], r: 0.06 },
    { pos: [1.2, 0.55, 1.8], r: 0.06 },
  )

  extras.interactions.push(
    { id: 'breath', kind: 'breath', pos: [-2.2, 0.6, -1.4], radius: 3.4 },
    seatSpec('bench1', -3.4, 2.9, 0, { label: 'Rest by the water' }),
    seatSpec('bench2', 0.8, -3.6, Math.PI, { label: 'Rest by the water' }),
  )
  extras.lights.push({ pos: [0, 2.4, 0], intensity: 9, color: '#ffd9b8' })
  return { plan, glow, extras }
}

// ---------------------------------------------------------------------------

const observatory: InteriorFn = () => {
  const { plan, glow, extras } = fresh('observatory')
  const W = 8
  const D = 8
  const H = 3.0
  extras.door = buildShell(plan, glow, {
    w: W,
    d: D,
    h: H,
    wallMat: 'concrete',
    trimMat: 'metalDark',
    floorMat: 'concrete',
    roof: 'flat',
    identity: 'observatory',
    accentMat: 'paint.night',
    door: { wall: 0, x: 0 },
    windows: [
      { wall: 2, x: 0, w: 1.8, h: 1.2, sill: 1.1 },
      { wall: 3, x: 0, w: 1.8, h: 1.2, sill: 1.1 },
    ],
  })
  // dome (visual only, above roof)
  plan.cyl('concrete', { pos: [0, H + 0.38, 0], size: [7.7, 0.72, 7.7] }, 32)
  plan.sphere('metalBrushed', { pos: [0, H + 0.7, 0], size: [7.4, 5.2, 7.4] }, 24)
  plan.cyl('metalDark', { pos: [0, H + 1.04, 0], size: [7.58, 0.14, 7.58] }, 32)
  plan.box('paint.night', { pos: [0, H + 2.4, 0], size: [1.1, 3.0, 7.6], rot: [0, 0, 0] })
  extras.interior = { halfX: W / 2, halfZ: D / 2, halfY: H / 2 + 0.2, cy: H / 2 }

  p.telescopeProp(plan, 0, -0.6, 0.4)
  p.desk(plan, -3.1, -2.6, Math.PI / 2)
  p.chair(plan, -2.3, -2.6, Math.PI / 2)
  p.shelfUnit(plan, 3.6, -1.4, -Math.PI / 2, 2.6, 1.8, true, 91)
  // star chart wall
  plan.box('paint.night', { pos: [0, 1.9, -3.86], size: [4.4, 1.9, 0.05] })
  p.armchair(plan, 2.4, 2.4, -2.6, 'fabricTeal')

  extras.interactions.push(
    { id: 'scope', kind: 'telescope', pos: [0, 1.5, -0.6], radius: 2.8 },
    {
      id: 'journal',
      kind: 'journal',
      pos: [-3.1, 0.9, -2.6],
      radius: 2.2,
      label: 'Log an observation',
    },
    seatSpec('chair', 2.4, 2.4, -2.6, { label: 'Watch the dome' }),
  )
  extras.lights.push({ pos: [0, 2.2, 0], intensity: 7, color: '#c9576a' })
  return { plan, glow, extras }
}

// ---------------------------------------------------------------------------

const store: InteriorFn = () => {
  const { plan, glow, extras } = fresh('room')
  const W = 8.5
  const D = 6.5
  const H = 3.0
  extras.door = buildShell(plan, glow, {
    w: W,
    d: D,
    h: H,
    wallMat: 'plasterWarm',
    trimMat: 'woodDark',
    floorMat: 'woodDeck',
    roof: 'shed',
    porch: true,
    identity: 'store',
    accentMat: 'fabricSand',
    door: { wall: 0, x: -2.4 },
    windows: [
      { wall: 0, x: 1.6, w: 3.4, h: 1.9, sill: 0.55 },
      { wall: 2, x: 0, w: 2.2, h: 1.5, sill: 0.85 },
    ],
  })
  extras.interior = { halfX: W / 2, halfZ: D / 2, halfY: H / 2 + 0.2, cy: H / 2 }

  p.storeShelf(plan, -1.5, -0.3, 0, 101)
  p.storeShelf(plan, 1.5, 1.0, Math.PI, 102)
  p.storeShelf(plan, -2.9, -2.9, 0, 103)
  p.cafeCounter(plan, 2.6, -2.5, Math.PI, 2.8)
  p.plantPot(plan, 3.8, 2.6, 'm', 104)
  extras.interactions.push(
    { id: 'goods1', kind: 'goods', pos: [-1.5, 1.2, 0.1], radius: 2.4 },
    { id: 'goods2', kind: 'goods', pos: [1.5, 1.2, 0.6], radius: 2.4 },
    { id: 'lamp', kind: 'lamp', pos: [2.6, 1.4, -2.5], radius: 2.6, label: 'Dim the lights' },
  )
  extras.lights.push({ pos: [0, 2.3, -0.5], intensity: 11, color: '#ffd9ae' })
  return { plan, glow, extras }
}

// ---------------------------------------------------------------------------

const pavilion: InteriorFn = () => {
  const { plan, glow, extras } = fresh('room')
  const W = 10
  const D = 8
  // open structure: slab, columns, roof — no walls
  plan.solid('concrete', { pos: [0, -0.06, 0], size: [W, 0.32, D] })
  plan.solid('woodDeck', { pos: [0, 0.13, 0], size: [W - 0.4, 0.06, D - 0.4] })
  for (const [cx, cz] of [
    [-4.4, -3.4],
    [4.4, -3.4],
    [-4.4, 3.4],
    [4.4, 3.4],
    [0, -3.4],
    [0, 3.4],
  ] as Array<[number, number]>) {
    plan.solid('woodDark', { pos: [cx, 1.75, cz], size: [0.24, 3.0, 0.24] })
  }
  // Two light overlapping roof wings create an open-sail silhouette instead
  // of the same heavy flat lid used by enclosed village buildings.
  plan.box('woodDark', {
    pos: [-2.45, 3.4, 0],
    size: [W / 2 + 1.1, 0.16, D + 0.8],
    rot: [0, 0, 0.1],
  })
  plan.box('woodDark', {
    pos: [2.45, 3.4, 0],
    size: [W / 2 + 1.1, 0.16, D + 0.8],
    rot: [0, 0, -0.1],
  })
  plan.box('woodDeck', {
    pos: [-2.35, 3.52, 0],
    size: [W / 2 + 0.8, 0.12, D + 0.35],
    rot: [0, 0, 0.1],
  })
  plan.box('woodDeck', {
    pos: [2.35, 3.52, 0],
    size: [W / 2 + 0.8, 0.12, D + 0.35],
    rot: [0, 0, -0.1],
  })
  plan.box('metalDark', { pos: [0, 3.68, 0], size: [0.16, 0.18, D + 0.7] })
  // long communal table + benches
  plan.solid('woodWarm', { pos: [0, 0.92, 0], size: [3.8, 0.08, 1.1] })
  plan.box('woodDark', { pos: [-1.5, 0.55, 0], size: [0.14, 0.75, 0.9] })
  plan.box('woodDark', { pos: [1.5, 0.55, 0], size: [0.14, 0.75, 0.9] })
  p.benchOutdoor(plan, 0, 1.35, 0)
  p.benchOutdoor(plan, 0, -1.35, Math.PI)
  p.benchOutdoor(plan, -3.6, 0, Math.PI / 2)
  p.plantPot(plan, 4.2, -2.8, 'l', 111)
  p.plantPot(plan, -4.2, 2.8, 'm', 112)
  p.windChime(plan, 3.2, 3.2, -3.0)
  p.windChime(plan, -3.4, 3.2, 3.1)

  extras.interior = { halfX: 0.1, halfZ: 0.1, halfY: 0.1, cy: -99 } // open air — never counts as indoors
  extras.interactions.push(
    { id: 'chime1', kind: 'chime', pos: [3.2, 2.6, -3.0], radius: 2.6 },
    { id: 'chime2', kind: 'chime', pos: [-3.4, 2.6, 3.1], radius: 2.6 },
    seatSpec('bench1', 0, 1.5, Math.PI, { label: 'Sit at the long table' }),
    seatSpec('bench2', -3.6, 0, Math.PI / 2, { label: 'Sit and watch the plaza' }),
  )
  extras.lampShades.push({ pos: [0, 2.9, 0], r: 0.3 })
  extras.lights.push({ pos: [0, 2.6, 0], intensity: 10, color: '#ffd9a8' })
  return { plan, glow, extras }
}

// ---------------------------------------------------------------------------

const cottage: InteriorFn = (spec) => {
  const { plan, glow, extras } = fresh('home')
  const W = 6.2
  const D = 5.2
  const H = 2.7
  const variant = spec.id.charCodeAt(spec.id.length - 1) % 3
  extras.door = buildShell(plan, glow, {
    w: W,
    d: D,
    h: H,
    wallMat: variant === 0 ? 'plasterWarm' : variant === 1 ? 'plasterSage' : 'plasterCool',
    trimMat: 'woodDark',
    floorMat: 'woodDeck',
    roof: variant === 1 ? 'shed' : 'flat',
    porch: variant !== 2,
    identity: 'cottage',
    accentMat: variant === 0 ? 'fabricRust' : variant === 1 ? 'fabricTeal' : 'fabricSand',
    door: { wall: 0, x: 1.4 },
    windows: [
      { wall: 0, x: -1.2, w: 1.8, h: 1.5, sill: 0.75 },
      { wall: 2, x: 0, w: 1.6, h: 1.3, sill: 0.9 },
    ],
  })
  extras.interior = { halfX: W / 2, halfZ: D / 2, halfY: H / 2 + 0.2, cy: H / 2 }
  p.bed(plan, -1.9, -1.2, Math.PI / 2, false)
  p.kitchenette(plan, 1.6, -2.2, Math.PI, 2.2)
  plan.cyl('woodWarm', { pos: [1.2, 0.72, 0.9], size: [0.8, 0.05, 0.8] }, 14)
  plan.cyl('metalDark', { pos: [1.2, 0.36, 0.9], size: [0.08, 0.72, 0.08] }, 10)
  p.chair(plan, 1.2, 1.7, Math.PI)
  p.shelfUnit(plan, -2.6, 1.6, Math.PI / 2, 1.6, 1.6, true, 121 + variant)
  p.plantPot(plan, 2.5, 1.9, 's', 5)
  extras.interactions.push({ id: 'lamp', kind: 'lamp', pos: [1.6, 1.2, -2.2], radius: 2.4 })
  extras.lights.push({ pos: [0, 2.1, 0], intensity: 7 })
  return { plan, glow, extras }
}

// ---------------------------------------------------------------------------

export const INTERIORS: Record<BuildingSpec['kind'], InteriorFn> = {
  home,
  cafe,
  bookshop,
  records,
  plants,
  gallery,
  bathhouse,
  observatory,
  store,
  pavilion,
  cottage,
}
