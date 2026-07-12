import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  IcosahedronGeometry,
  CylinderGeometry,
} from 'three'
import { mergeGeometries } from './kit/merge'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { mulberry32, type Rng } from '../core/rng'
import {
  distanceToPath,
  isInsideShell,
  splatWeights,
  terrainHeight,
} from '../world/shell/shellShape'
import { BUILDINGS, EXTRA_PADS, WATER_FEATURES } from '../config/layout'
import { runtime } from '../core/runtime'
import { useSettings } from '../state/settingsStore'

/** true when (x,z) is clear of buildings, pads, paths and water features */
function clearOfStructures(x: number, z: number, margin = 2): boolean {
  if (distanceToPath(x, z) < margin) return false
  for (const b of BUILDINGS) {
    const dx = x - b.x
    const dz = z - b.z
    if (dx * dx + dz * dz < (b.padR - 2) * (b.padR - 2)) return false
  }
  for (const pad of EXTRA_PADS) {
    const dx = x - pad.x
    const dz = z - pad.z
    if (dx * dx + dz * dz < pad.r * pad.r) return false
  }
  for (const w of WATER_FEATURES) {
    const dx = x - w.x
    const dz = z - w.z
    if (dx * dx + dz * dz < (w.r + 1.5) * (w.r + 1.5)) return false
  }
  return true
}

function scatter(
  rng: Rng,
  count: number,
  accept: (x: number, z: number) => boolean,
): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let attempts = count * 6
  while (out.length < count && attempts-- > 0) {
    const x = (rng() * 2 - 1) * 168
    const z = (rng() * 2 - 1) * 248
    if (!isInsideShell(x, z, 0.93)) continue
    if (!accept(x, z)) continue
    out.push([x, z])
  }
  return out
}

let windUniform: { value: number } | null = null

function makeSwayMaterial(base: MeshStandardMaterial, strength: number): MeshStandardMaterial {
  base.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    shader.uniforms.uWind = windUniform ?? (windUniform = { value: 0.5 })
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWind;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.47;
          #else
            float ph = 0.0;
          #endif
          float sway = sin(uTime * 1.4 + ph) * ${strength.toFixed(3)} * uWind * max(0.0, transformed.y);
          transformed.x += sway;
          transformed.z += sway * 0.6;
        }`,
      )
    swayShaders.push(shader.uniforms as { uTime: { value: number } })
  }
  return base
}

const swayShaders: Array<{ uTime: { value: number } }> = []

export function Vegetation() {
  const density = useSettings((s) => s.graphics.particleDensity)
  const veg = runtime.quality.vegetationDensity * Math.max(0.4, density)

  const data = useMemo(() => {
    const rng = mulberry32(useSettings.getState().worldSeed ^ 0x7e61)
    return buildVegetation(rng, veg)
  }, [veg])

  useFrame((state) => {
    for (const s of swayShaders) s.uTime.value = state.clock.elapsedTime
    if (windUniform) windUniform.value = 0.35 + runtime.weather.wind * 0.8
  })

  return (
    <>
      <Instanced set={data.grass} />
      <Instanced set={data.flowers} />
      <Instanced set={data.bushes} />
      <Instanced set={data.rocks} />
      <Trees trees={data.trees} />
    </>
  )
}

interface InstSet {
  geometry: BufferGeometry
  material: MeshStandardMaterial
  transforms: Array<{ x: number; y: number; z: number; s: number; ry: number }>
  colors?: Color[]
  shadow?: boolean
}

function Instanced({ set }: { set: InstSet }) {
  const dummy = useMemo(() => new Object3D(), [])
  const ref = useMemo(() => ({ current: null as InstancedMesh | null }), [])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    set.transforms.forEach((t, i) => {
      dummy.position.set(t.x, t.y, t.z)
      dummy.rotation.set(0, t.ry, 0)
      dummy.scale.setScalar(t.s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      if (set.colors) mesh.setColorAt(i, set.colors[i % set.colors.length])
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [set, dummy, ref])

  if (set.transforms.length === 0 || !set.geometry) return null
  return (
    <instancedMesh
      ref={(el) => {
        ref.current = el
      }}
      args={[set.geometry, set.material, set.transforms.length]}
      castShadow={set.shadow ?? false}
      receiveShadow
      frustumCulled={false}
    />
  )
}

function buildVegetation(rng: Rng, density: number) {
  // grass: three crossed blades with a dark→light vertical gradient (baked into
  // vertex colors) so tips catch light and clumps read soft rather than flat.
  const grassGeo = (() => {
    const blade = () => makeTaperedBlade()
    const p1 = blade()
    const p2 = blade()
    p2.rotateY(Math.PI / 3)
    const p3 = blade()
    p3.rotateY((Math.PI * 2) / 3)
    const merged = mergeGeometries([p1, p2, p3], false)!
    p1.dispose()
    p2.dispose()
    p3.dispose()
    // vertex-color gradient: darker near root, brighter at tip
    const posAttr = merged.getAttribute('position')
    const cols = new Float32Array(posAttr.count * 3)
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i)
      const t = Math.min(1, y / 0.28)
      const shade = 0.72 + t * 0.5
      cols[i * 3] = shade
      cols[i * 3 + 1] = shade
      cols[i * 3 + 2] = shade
    }
    merged.setAttribute('color', new BufferAttribute(cols, 3))
    return merged
  })()
  // brighter base greens; vertexColors gradient + instanceColor variation
  const grassMat = makeSwayMaterial(
    new MeshStandardMaterial({
      color: '#ffffff',
      side: DoubleSide,
      roughness: 1,
      vertexColors: true,
    }),
    0.05,
  )
  const grassSpots = scatter(rng, Math.floor(7000 * density), (x, z) => {
    if (!clearOfStructures(x, z, 1.6)) return false
    return splatWeights(x, z).grass > 0.35 + rng() * 0.3
  })
  const grass: InstSet = {
    geometry: grassGeo,
    material: grassMat,
    transforms: grassSpots.map(([x, z]) => ({
      x,
      y: terrainHeight(x, z) - 0.02,
      z,
      s: 0.7 + rng() * 0.8,
      ry: rng() * Math.PI,
    })),
    colors: [
      new Color('#9cbf6f'),
      new Color('#a8c97b'),
      new Color('#8fb266'),
      new Color('#b6d488'),
    ],
  }

  // flowers: crossed stem-and-petal silhouettes. Unlike an opaque rectangular
  // card, the actual geometry follows the sprig outline from every angle.
  const flowerGeo = makeFlowerSprig()
  const flowerMat = makeSwayMaterial(
    new MeshStandardMaterial({
      color: '#ffffff',
      side: DoubleSide,
      roughness: 0.9,
      vertexColors: true,
    }),
    0.09,
  )
  const flowerSpots = scatter(rng, Math.floor(1400 * density), (x, z) => {
    if (!clearOfStructures(x, z, 1.8)) return false
    const gardenPull = Math.hypot(x + 58, z - 74) < 45 ? 0.25 : 0.62
    return splatWeights(x, z).grass > 0.3 && rng() > gardenPull
  })
  const flowers: InstSet = {
    geometry: flowerGeo,
    material: flowerMat,
    transforms: flowerSpots.map(([x, z]) => ({
      x,
      y: terrainHeight(x, z),
      z,
      s: 0.8 + rng() * 0.7,
      ry: rng() * Math.PI,
    })),
    colors: [
      new Color('#e8a1b4'),
      new Color('#f2c894'),
      new Color('#c4d4f2'),
      new Color('#e8e2f0'),
      new Color('#f2917f'),
    ],
  }

  // bushes — rounder (detail 2), softer greens, kept to shrub scale
  const bushGeo = new IcosahedronGeometry(0.5, 2)
  const bushMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 1 })
  const bushSpots = scatter(rng, Math.floor(300 * density), (x, z) => {
    return clearOfStructures(x, z, 2.4) && splatWeights(x, z).grass > 0.4
  })
  const bushes: InstSet = {
    geometry: bushGeo,
    material: bushMat,
    transforms: bushSpots.map(([x, z]) => {
      const s = 0.5 + rng() * 0.7
      return {
        x,
        y: terrainHeight(x, z) + s * 0.28,
        z,
        s,
        ry: rng() * Math.PI,
      }
    }),
    colors: [
      new Color('#6f9155'),
      new Color('#7d9c62'),
      new Color('#5f8049'),
      new Color('#88a86a'),
    ],
    shadow: true,
  }

  // rocks near ridges and rim
  const rockGeo = new IcosahedronGeometry(0.5, 0)
  const rockMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true })
  const rockSpots = scatter(rng, Math.floor(240 * density), (x, z) => {
    return clearOfStructures(x, z, 2.2) && splatWeights(x, z).rock > 0.32
  })
  const rocks: InstSet = {
    geometry: rockGeo,
    material: rockMat,
    transforms: rockSpots.map(([x, z]) => {
      const s = 0.4 + rng() * 1.0
      return { x, y: terrainHeight(x, z) + s * 0.12, z, s, ry: rng() * Math.PI }
    }),
    colors: [new Color('#8a8072'), new Color('#9a8f7f'), new Color('#786e60')],
    shadow: true,
  }

  // trees: three silhouettes
  const treeSpots = scatter(rng, Math.floor(150 * Math.max(0.55, density)), (x, z) => {
    if (!clearOfStructures(x, z, 3.4)) return false
    const w = splatWeights(x, z)
    return w.grass > 0.25 && w.rock < 0.4
  })
  const trees = treeSpots.map(([x, z]) => ({
    x,
    y: terrainHeight(x, z),
    z,
    kind: Math.floor(rng() * 3),
    s: 0.8 + rng() * 0.6,
    ry: rng() * Math.PI * 2,
  }))

  return { grass, flowers, bushes, rocks, trees }
}

/** A five-point blade silhouette, wide at the root and tapered to a soft tip. */
function makeTaperedBlade(): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute(
    'position',
    new BufferAttribute(
      new Float32Array([-0.055, 0, 0, 0.055, 0, 0, 0.034, 0.2, 0, 0, 0.34, 0, -0.034, 0.2, 0]),
      3,
    ),
  )
  g.setIndex([0, 1, 2, 0, 2, 4, 4, 2, 3])
  g.computeVertexNormals()
  return g
}

/** Crossed low-poly flower with a narrow green stem and distinct petals. */
function makeFlowerSprig(): BufferGeometry {
  const makeFace = () => {
    const g = new BufferGeometry()
    const positions: number[] = []
    const colors: number[] = []
    const addTri = (
      a: [number, number, number],
      b: [number, number, number],
      c: [number, number, number],
      color: [number, number, number],
    ) => {
      positions.push(...a, ...b, ...c)
      colors.push(...color, ...color, ...color)
    }
    const green: [number, number, number] = [0.34, 0.58, 0.27]
    const petal: [number, number, number] = [1, 1, 1]
    addTri([-0.016, 0, 0], [0.016, 0, 0], [0.012, 0.31, 0], green)
    addTri([-0.016, 0, 0], [0.012, 0.31, 0], [-0.012, 0.31, 0], green)
    const center: [number, number, number] = [0, 0.33, 0]
    addTri(center, [-0.075, 0.35, 0], [-0.018, 0.38, 0], petal)
    addTri(center, [0.018, 0.38, 0], [0.075, 0.35, 0], petal)
    addTri(center, [-0.035, 0.4, 0], [0, 0.46, 0], petal)
    addTri(center, [0, 0.3, 0], [0.04, 0.27, 0], petal)
    g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
    g.computeVertexNormals()
    return g
  }
  const front = makeFace()
  const side = makeFace()
  side.rotateY(Math.PI / 2)
  const merged = mergeGeometries([front, side], false)!
  front.dispose()
  side.dispose()
  return merged
}

// ---------------------------------------------------------------------------

function Trees({
  trees,
}: {
  trees: Array<{ x: number; y: number; z: number; kind: number; s: number; ry: number }>
}) {
  const { geos, mats } = useMemo(() => {
    // kind 0: broadleaf — trunk + 3 canopy blobs
    const trunk = new CylinderGeometry(0.09, 0.16, 1.6, 7)
    trunk.translate(0, 0.8, 0)
    const blob = new IcosahedronGeometry(0.9, 1)
    const c1 = blob.clone()
    c1.translate(0, 2.1, 0)
    const c2 = blob.clone()
    c2.scale(0.75, 0.7, 0.75)
    c2.translate(0.55, 1.75, 0.2)
    const c3 = blob.clone()
    c3.scale(0.65, 0.6, 0.65)
    c3.translate(-0.5, 1.85, -0.25)
    const broadCanopy = mergeGeometries([c1, c2, c3], false)!
    // kind 1: coastal pine — trunk + stacked cones
    const pTrunk = new CylinderGeometry(0.07, 0.13, 2.0, 7)
    pTrunk.translate(0, 1, 0)
    const cone = (r: number, h: number, y: number) => {
      const c = new CylinderGeometry(0.03, r, h, 8)
      c.translate(0, y, 0)
      return c
    }
    const pineCanopy = mergeGeometries(
      [cone(0.85, 1.1, 2.0), cone(0.62, 0.9, 2.7), cone(0.4, 0.7, 3.3)],
      false,
    )!
    // kind 2: dracaena-ish — slim trunk + tufts
    const dTrunk = new CylinderGeometry(0.06, 0.1, 2.4, 6)
    dTrunk.translate(0, 1.2, 0)
    const tuft = new IcosahedronGeometry(0.55, 1)
    const t1 = tuft.clone()
    t1.scale(1, 0.5, 1)
    t1.translate(0, 2.55, 0)
    const t2 = tuft.clone()
    t2.scale(0.7, 0.4, 0.7)
    t2.translate(0.35, 2.3, 0.2)
    const dracCanopy = mergeGeometries([t1, t2], false)!

    const trunkMat = new MeshStandardMaterial({ color: '#6a4e38', roughness: 0.95 })
    const leafMat = new MeshStandardMaterial({ color: '#55793f', roughness: 1, flatShading: true })
    const pineMat = new MeshStandardMaterial({ color: '#3f6247', roughness: 1, flatShading: true })
    const dracMat = new MeshStandardMaterial({ color: '#5d8a5a', roughness: 1, flatShading: true })
    return {
      geos: [
        { trunk, canopy: broadCanopy },
        { trunk: pTrunk, canopy: pineCanopy },
        { trunk: dTrunk, canopy: dracCanopy },
      ],
      mats: { trunkMat, canopy: [leafMat, pineMat, dracMat] },
    }
  }, [])

  const dummy = useMemo(() => new Object3D(), [])
  const byKind = useMemo(
    () => [
      trees.filter((t) => t.kind === 0),
      trees.filter((t) => t.kind === 1),
      trees.filter((t) => t.kind === 2),
    ],
    [trees],
  )

  return (
    <>
      {byKind.map((list, kind) => (
        <group key={kind}>
          <KindInstances
            list={list}
            geometry={geos[kind].trunk}
            material={mats.trunkMat}
            dummy={dummy}
            shadow
          />
          <KindInstances
            list={list}
            geometry={geos[kind].canopy!}
            material={mats.canopy[kind]}
            dummy={dummy}
            shadow
          />
        </group>
      ))}
      {/* simplified collision: one cylinder per tree */}
      <RigidBody type="fixed" colliders={false}>
        {trees.map((t, i) => (
          <CylinderCollider key={i} args={[1.4, 0.22 * t.s]} position={[t.x, t.y + 1.4, t.z]} />
        ))}
      </RigidBody>
    </>
  )
}

function KindInstances({
  list,
  geometry,
  material,
  dummy,
  shadow,
}: {
  list: Array<{ x: number; y: number; z: number; s: number; ry: number }>
  geometry: NonNullable<ReturnType<typeof mergeGeometries>> | CylinderGeometry
  material: MeshStandardMaterial
  dummy: Object3D
  shadow?: boolean
}) {
  const ref = useMemo(() => ({ current: null as InstancedMesh | null }), [])
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    list.forEach((t, i) => {
      dummy.position.set(t.x, t.y, t.z)
      dummy.rotation.set(0, t.ry, 0)
      dummy.scale.setScalar(t.s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [list, dummy, ref])
  if (list.length === 0) return null
  return (
    <instancedMesh
      ref={(el) => {
        ref.current = el
      }}
      args={[geometry as CylinderGeometry, material, list.length]}
      castShadow={shadow}
      receiveShadow
      frustumCulled={false}
    />
  )
}
