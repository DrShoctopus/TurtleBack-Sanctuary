import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  IcosahedronGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
} from 'three'
import { ComfortMotionClock } from '../core/comfortMotion'
import { runtime } from '../core/runtime'
import { useQualityProfile } from '../core/useQualityProfile'
import { useSettings } from '../state/settingsStore'
import { useSpatialCellSnapshot } from '../world/spatial/SpatialCellProvider'
import { DEFAULT_SPATIAL_GRID } from '../world/spatial/types'
import { mergeGeometries } from './kit/merge'
import { buildCellVegetationPopulation } from './vegetation/placement'
import { partitionVegetationByCell } from './vegetation/partition'
import { VegetationCell, type VegetationRenderResources } from './vegetation/VegetationCell'

interface MutableUniform {
  value: number
}

/** Explicit owner for all shared vegetation GPU resources and sway uniforms. */
export class VegetationResourceOwner {
  readonly resources: VegetationRenderResources
  private readonly windUniform: MutableUniform = { value: 0.5 }
  private readonly swayTimeUniforms = new Set<MutableUniform>()
  private readonly geometries: readonly BufferGeometry[]
  private readonly materials: readonly MeshStandardMaterial[]
  private disposed = false

  constructor() {
    const grassGeometry = makeGrassTuft()
    const grassPosition = grassGeometry.getAttribute('position')
    const grassColors = new Float32Array(grassPosition.count * 3)
    for (let index = 0; index < grassPosition.count; index++) {
      const height = grassPosition.getY(index)
      const shade = 0.68 + Math.min(1, height / 0.42) * 0.48
      grassColors[index * 3] = shade
      grassColors[index * 3 + 1] = shade
      grassColors[index * 3 + 2] = shade
    }
    grassGeometry.setAttribute('color', new BufferAttribute(grassColors, 3))

    const grassMaterial = this.makeSwayMaterial(
      new MeshStandardMaterial({
        color: '#ffffff',
        side: DoubleSide,
        roughness: 1,
        vertexColors: true,
      }),
      0.05,
    )
    const flowerGeometry = makeFlowerSprig()
    const flowerMaterial = this.makeSwayMaterial(
      new MeshStandardMaterial({
        color: '#ffffff',
        side: DoubleSide,
        roughness: 0.9,
        vertexColors: true,
      }),
      0.09,
    )
    const bushGeometry = makeBushCluster()
    const bushMaterial = new MeshStandardMaterial({ color: '#ffffff', roughness: 1 })
    const rockGeometry = new IcosahedronGeometry(0.5, 0)
    const rockMaterial = new MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.95,
      flatShading: true,
    })

    const treeGeometry = makeTreeGeometry()
    const treeTrunkMaterial = new MeshStandardMaterial({ color: '#6a4e38', roughness: 0.95 })
    const treeCanopyMaterials = [
      new MeshStandardMaterial({ color: '#567d42', roughness: 0.96 }),
      new MeshStandardMaterial({ color: '#3f6949', roughness: 0.98 }),
      new MeshStandardMaterial({ color: '#628e59', roughness: 0.96 }),
    ] as const

    const horizonGeometry = new IcosahedronGeometry(0.85, 0)
    horizonGeometry.scale(1, 0.74, 1)
    horizonGeometry.translate(0, 2.15, 0)
    const horizonMaterial = new MeshStandardMaterial({ color: '#ffffff', roughness: 1 })

    this.resources = {
      grass: {
        geometry: grassGeometry,
        material: grassMaterial,
        colors: [
          new Color('#799e57'),
          new Color('#89ad62'),
          new Color('#6e914f'),
          new Color('#9ab86d'),
        ],
        boundsPadding: 0.08,
      },
      flowers: {
        geometry: flowerGeometry,
        material: flowerMaterial,
        colors: [
          new Color('#e8a1b4'),
          new Color('#f2c894'),
          new Color('#c4d4f2'),
          new Color('#e8e2f0'),
          new Color('#f2917f'),
        ],
        boundsPadding: 0.14,
      },
      bushes: {
        geometry: bushGeometry,
        material: bushMaterial,
        colors: [
          new Color('#6f9155'),
          new Color('#7d9c62'),
          new Color('#5f8049'),
          new Color('#88a86a'),
        ],
        castShadow: true,
      },
      rocks: {
        geometry: rockGeometry,
        material: rockMaterial,
        colors: [new Color('#8a8072'), new Color('#9a8f7f'), new Color('#786e60')],
        castShadow: true,
      },
      trees: [
        { geometry: treeGeometry.canopies[0], material: treeCanopyMaterials[0], castShadow: true },
        { geometry: treeGeometry.canopies[1], material: treeCanopyMaterials[1], castShadow: true },
        { geometry: treeGeometry.canopies[2], material: treeCanopyMaterials[2], castShadow: true },
      ],
      treeTrunkMaterial,
      treeTrunks: treeGeometry.trunks,
      horizonTrees: {
        geometry: horizonGeometry,
        material: horizonMaterial,
        colors: [new Color('#567d42'), new Color('#3f6949'), new Color('#628e59')],
      },
    }

    this.geometries = [
      grassGeometry,
      flowerGeometry,
      bushGeometry,
      rockGeometry,
      ...treeGeometry.trunks,
      ...treeGeometry.canopies,
      horizonGeometry,
    ]
    this.materials = [
      grassMaterial,
      flowerMaterial,
      bushMaterial,
      rockMaterial,
      treeTrunkMaterial,
      ...treeCanopyMaterials,
      horizonMaterial,
    ]
  }

  update(motionTime: number, wind: number): void {
    if (this.disposed) return
    for (const uniform of this.swayTimeUniforms) uniform.value = motionTime
    this.windUniform.value = 0.35 + wind * 0.8
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.swayTimeUniforms.clear()
    for (const material of this.materials) material.dispose()
    for (const geometry of this.geometries) geometry.dispose()
  }

  private makeSwayMaterial(material: MeshStandardMaterial, strength: number): MeshStandardMaterial {
    let compiledTimeUniform: MutableUniform | null = null
    material.onBeforeCompile = (shader) => {
      if (compiledTimeUniform) this.swayTimeUniforms.delete(compiledTimeUniform)
      compiledTimeUniform = { value: 0 }
      this.swayTimeUniforms.add(compiledTimeUniform)
      shader.uniforms.uTime = compiledTimeUniform
      shader.uniforms.uWind = this.windUniform
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
    }
    material.customProgramCacheKey = () => `turtleback-sway:${strength.toFixed(3)}`
    return material
  }
}

export function Vegetation() {
  const motionClock = useRef(new ComfortMotionClock())
  const quality = useQualityProfile()
  const particleDensity = useSettings((state) => state.graphics.particleDensity)
  const seed = useSettings((state) => state.worldSeed)
  const spatial = useSpatialCellSnapshot()
  const density = quality.vegetationDensity * Math.max(0.4, particleDensity)
  const owner = useMemo(() => new VegetationResourceOwner(), [])

  useEffect(() => () => owner.dispose(), [owner])

  const population = useMemo(
    () => buildCellVegetationPopulation({ seed, density }),
    [density, seed],
  )
  const cells = useMemo(
    () => partitionVegetationByCell(population, DEFAULT_SPATIAL_GRID),
    [population],
  )
  const active = useMemo(() => new Set(spatial.active), [spatial.active])

  useFrame((_, delta) => {
    const motionTime = motionClock.current.advance(delta, runtime.reducedMotion)
    owner.update(motionTime, runtime.weather.wind)
  })

  return spatial.retained.map((key) => {
    const cell = cells.get(key)
    return cell ? (
      <VegetationCell key={key} cell={cell} active={active.has(key)} resources={owner.resources} />
    ) : null
  })
}

function mergeAndDispose(geometries: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(geometries, false)
  for (const geometry of geometries) geometry.dispose()
  if (!merged) throw new Error('vegetation geometry merge failed')
  return merged
}

function makeGrassTuft(): BufferGeometry {
  const specs = [
    { angle: 0.15, radius: 0.02, height: 0.39, width: 0.052, bend: 0.035 },
    { angle: 0.98, radius: 0.12, height: 0.31, width: 0.046, bend: -0.045 },
    { angle: 1.92, radius: 0.09, height: 0.35, width: 0.05, bend: 0.055 },
    { angle: 2.8, radius: 0.14, height: 0.27, width: 0.043, bend: -0.03 },
    { angle: 3.72, radius: 0.1, height: 0.33, width: 0.048, bend: 0.04 },
    { angle: 4.65, radius: 0.13, height: 0.29, width: 0.044, bend: -0.052 },
    { angle: 5.58, radius: 0.07, height: 0.37, width: 0.05, bend: 0.025 },
  ]
  return mergeAndDispose(
    specs.map((spec) => {
      const blade = makeTaperedBlade(spec.height, spec.width, spec.bend)
      blade.rotateY(spec.angle)
      blade.translate(Math.cos(spec.angle) * spec.radius, 0, Math.sin(spec.angle) * spec.radius)
      return blade
    }),
  )
}

function makeTaperedBlade(height: number, width: number, bend: number): BufferGeometry {
  const geometry = new BufferGeometry()
  const shoulder = height * 0.58
  geometry.setAttribute(
    'position',
    new BufferAttribute(
      new Float32Array([
        -width,
        0,
        0,
        width,
        0,
        0,
        width * 0.62 + bend * 0.32,
        shoulder,
        0,
        bend,
        height,
        0,
        -width * 0.62 + bend * 0.32,
        shoulder,
        0,
      ]),
      3,
    ),
  )
  geometry.setIndex([0, 1, 2, 0, 2, 4, 4, 2, 3])
  geometry.computeVertexNormals()
  return geometry
}

function makeBushCluster(): BufferGeometry {
  const specs = [
    [0, 0.34, 0, 1, 0.8, 0.95],
    [0.36, 0.28, 0.08, 0.7, 0.62, 0.74],
    [-0.34, 0.26, -0.04, 0.74, 0.58, 0.7],
    [0.08, 0.32, 0.34, 0.66, 0.62, 0.7],
    [-0.08, 0.29, -0.31, 0.62, 0.56, 0.68],
  ] as const
  const geometry = mergeAndDispose(
    specs.map(([x, y, z, scaleX, scaleY, scaleZ]) => {
      const lobe = new IcosahedronGeometry(0.52, 1)
      lobe.scale(scaleX, scaleY, scaleZ)
      lobe.translate(x, y, z)
      return lobe
    }),
  )
  geometry.computeVertexNormals()
  return geometry
}

function makeFlowerSprig(): BufferGeometry {
  const makeFace = () => {
    const geometry = new BufferGeometry()
    const positions: number[] = []
    const colors: number[] = []
    const addTriangle = (
      a: readonly [number, number, number],
      b: readonly [number, number, number],
      c: readonly [number, number, number],
      color: readonly [number, number, number],
    ) => {
      positions.push(...a, ...b, ...c)
      colors.push(...color, ...color, ...color)
    }
    const green = [0.34, 0.58, 0.27] as const
    const petal = [1, 1, 1] as const
    addTriangle([-0.016, 0, 0], [0.016, 0, 0], [0.012, 0.31, 0], green)
    addTriangle([-0.016, 0, 0], [0.012, 0.31, 0], [-0.012, 0.31, 0], green)
    const center = [0, 0.33, 0] as const
    addTriangle(center, [-0.075, 0.35, 0], [-0.018, 0.38, 0], petal)
    addTriangle(center, [0.018, 0.38, 0], [0.075, 0.35, 0], petal)
    addTriangle(center, [-0.035, 0.4, 0], [0, 0.46, 0], petal)
    addTriangle(center, [0, 0.3, 0], [0.04, 0.27, 0], petal)
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
    geometry.computeVertexNormals()
    return geometry
  }
  const front = makeFace()
  const side = makeFace()
  side.rotateY(Math.PI / 2)
  return mergeAndDispose([front, side])
}

function makeTreeGeometry(): {
  trunks: readonly [BufferGeometry, BufferGeometry, BufferGeometry]
  canopies: readonly [BufferGeometry, BufferGeometry, BufferGeometry]
} {
  const trunk = new CylinderGeometry(0.09, 0.16, 1.6, 7)
  trunk.translate(0, 0.8, 0)
  const branchA = new CylinderGeometry(0.045, 0.075, 0.9, 6)
  branchA.rotateZ(-0.55)
  branchA.translate(0.23, 1.38, 0)
  const branchB = new CylinderGeometry(0.04, 0.07, 0.78, 6)
  branchB.rotateZ(0.62)
  branchB.rotateY(1.2)
  branchB.translate(-0.2, 1.42, 0.12)
  const broadTrunk = mergeAndDispose([trunk, branchA, branchB])

  const broadTemplate = new IcosahedronGeometry(0.82, 2)
  const broadSpecs = [
    [1.05, 0.88, 1, 0, 2.12, 0],
    [0.78, 0.68, 0.78, 0.62, 1.92, 0.16],
    [0.72, 0.64, 0.76, -0.58, 1.95, -0.22],
    [0.65, 0.58, 0.68, 0.15, 2.48, 0.1],
    [0.62, 0.54, 0.64, -0.08, 1.88, 0.58],
    [0.58, 0.52, 0.62, 0.24, 1.86, -0.56],
  ] as const
  const broadCanopy = mergeAndDispose(
    broadSpecs.map(([scaleX, scaleY, scaleZ, x, y, z]) => {
      const crown = broadTemplate.clone()
      crown.scale(scaleX, scaleY, scaleZ)
      crown.translate(x, y, z)
      return crown
    }),
  )
  broadTemplate.dispose()

  const pineTrunk = new CylinderGeometry(0.07, 0.13, 2, 7)
  pineTrunk.translate(0, 1, 0)
  const pineCanopy = mergeAndDispose(
    [
      [0.92, 0.92, 1.72],
      [0.8, 0.9, 2.18],
      [0.66, 0.82, 2.62],
      [0.5, 0.72, 3.02],
      [0.32, 0.58, 3.36],
    ].map(([radius, height, y]) => {
      const crown = new CylinderGeometry(0.025, radius, height, 12)
      crown.translate(0, y, 0)
      return crown
    }),
  )

  const dracTrunk = new CylinderGeometry(0.06, 0.1, 2.4, 6)
  dracTrunk.translate(0, 1.2, 0)
  const dracTemplate = new IcosahedronGeometry(0.55, 1)
  const dracCanopy = mergeAndDispose(
    [
      [1, 0.5, 1, 0, 2.55, 0],
      [0.7, 0.4, 0.7, 0.35, 2.3, 0.2],
    ].map(([scaleX, scaleY, scaleZ, x, y, z]) => {
      const tuft = dracTemplate.clone()
      tuft.scale(scaleX, scaleY, scaleZ)
      tuft.translate(x, y, z)
      return tuft
    }),
  )
  dracTemplate.dispose()

  return {
    trunks: [broadTrunk, pineTrunk, dracTrunk],
    canopies: [broadCanopy, pineCanopy, dracCanopy],
  }
}
