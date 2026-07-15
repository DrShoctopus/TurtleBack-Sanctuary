import { useEffect, useMemo } from 'react'
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  type BufferGeometry,
  type Material,
} from 'three'
import { useSettings } from '../../state/settingsStore'
import { useQualityProfile } from '../../core/useQualityProfile'
import { createPainterlyMaterial } from '../../rendering/painterlyMaterials'
import { registerProbeSection } from '../../debug/probes'
import { mergeGeometries } from '../../village/kit/merge'
import {
  BIOME_DEFINITIONS,
  BIOME_LAYERS,
  biomeDefinition,
  buildBiomeMosaicPlan,
  type BiomeDefinition,
  type BiomeLayer,
  type BiomeMosaicPlan,
  type BiomeTransform,
  type SanctuaryBiome,
} from './layout'

interface OwnedBiomeGroup {
  readonly group: Group
  readonly geometries: readonly BufferGeometry[]
  readonly materials: readonly Material[]
}

const layerGeometry = (layer: Exclude<BiomeLayer, 'canopy'>): BufferGeometry => {
  if (layer === 'midstory') {
    const geometry = new IcosahedronGeometry(0.68, 1)
    geometry.scale(1.2, 0.72, 1)
    geometry.translate(0, 0.48, 0)
    return geometry
  }
  if (layer === 'understory') {
    const geometry = new ConeGeometry(0.42, 1.15, 7, 2)
    geometry.scale(1.15, 1, 0.42)
    geometry.translate(0, 0.56, 0)
    return geometry
  }
  if (layer === 'ground-cover') {
    const geometry = new ConeGeometry(0.16, 0.52, 5, 1)
    geometry.scale(1, 1, 0.52)
    geometry.translate(0, 0.25, 0)
    return geometry
  }
  if (layer === 'geology') {
    const geometry = new IcosahedronGeometry(0.72, 0)
    geometry.scale(1.3, 0.68, 0.94)
    geometry.translate(0, 0.4, 0)
    return geometry
  }
  return new IcosahedronGeometry(0.075, 0)
}

function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false)
  for (const part of parts) part.dispose()
  if (!merged) throw new Error('biome geometry merge failed')
  merged.computeVertexNormals()
  return merged
}

function lobe(
  radius: number,
  x: number,
  y: number,
  z: number,
  scaleY = 0.7,
): BufferGeometry {
  const geometry = new IcosahedronGeometry(radius, 1)
  geometry.scale(1, scaleY, 0.94)
  geometry.translate(x, y, z)
  return geometry
}

function canopyGeometryForBiome(id: SanctuaryBiome): BufferGeometry {
  if (id === 'galecrest') {
    return mergeParts(
      [
        [2.45, 1.9, 3.8],
        [2.08, 1.75, 5.05],
        [1.66, 1.58, 6.15],
        [1.2, 1.34, 7.08],
      ].map(([radius, height, y], index) => {
        const tier = new ConeGeometry(radius, height, 9, 2)
        tier.translate(0.36 + index * 0.14, y, 0)
        return tier
      }),
    )
  }
  if (id === 'lumenfen') {
    return mergeParts([
      lobe(2.05, 0, 7.2, 0, 0.54),
      lobe(1.55, -1.35, 6.55, 0.2, 0.9),
      lobe(1.48, 1.3, 6.38, -0.18, 0.95),
      lobe(1.3, -0.5, 5.55, 0.92, 1.1),
      lobe(1.24, 0.58, 5.38, -0.9, 1.14),
    ])
  }
  if (id === 'fernfall') {
    return mergeParts([
      lobe(1.9, 0, 8.2, 0, 0.62),
      lobe(1.55, -1.35, 7.25, 0.15, 0.66),
      lobe(1.62, 1.26, 7.12, -0.24, 0.62),
      lobe(1.38, -0.55, 6.4, 1.05, 0.72),
      lobe(1.32, 0.65, 6.28, -1.02, 0.74),
    ])
  }
  if (id === 'blossomshade') {
    return mergeParts([
      lobe(2.18, 0, 6.7, 0, 0.68),
      lobe(1.62, -1.62, 6.25, 0.15, 0.72),
      lobe(1.55, 1.55, 6.2, -0.1, 0.74),
      lobe(1.42, -0.55, 7.55, 0.85, 0.78),
      lobe(1.38, 0.62, 7.46, -0.82, 0.76),
      lobe(1.2, 0.1, 5.9, 1.4, 0.8),
    ])
  }
  return mergeParts([
    lobe(2.35, 0, 6.55, 0, 0.58),
    lobe(1.7, -1.6, 6.15, 0.08, 0.62),
    lobe(1.62, 1.52, 6.12, -0.12, 0.64),
    lobe(1.42, 0, 7.36, 0.62, 0.7),
  ])
}

function trunkGeometryForBiome(id: SanctuaryBiome): BufferGeometry {
  const height = id === 'fernfall' ? 7.8 : id === 'galecrest' ? 7 : 6.4
  const main = new CylinderGeometry(0.3, id === 'fernfall' ? 0.68 : 0.54, height, 8, 2)
  main.translate(0, height / 2, 0)
  if (id === 'galecrest') {
    main.rotateZ(-0.1)
    return main
  }
  const left = new CylinderGeometry(0.12, 0.22, 3.3, 7, 1)
  left.rotateZ(-0.78)
  left.translate(0.75, height * 0.7, 0)
  const right = new CylinderGeometry(0.1, 0.19, 2.8, 7, 1)
  right.rotateZ(0.86)
  right.rotateY(0.72)
  right.translate(-0.68, height * 0.72, 0.2)
  return mergeParts([main, left, right])
}

function scaleFor(transform: BiomeTransform): readonly [number, number, number] {
  const base = transform.scale
  if (transform.layer === 'canopy') {
    if (transform.biome === 'galecrest') return [base * 0.82, base * 1.15, base * 0.76]
    if (transform.biome === 'blossomshade') return [base * 1.08, base * 0.92, base * 1.08]
    return [base, base, base]
  }
  if (transform.layer === 'understory' && transform.biome === 'lumenfen') {
    return [base * 0.58, base * 1.45, base * 0.58]
  }
  if (transform.layer === 'geology' && transform.biome === 'fernfall') {
    return [base * 1.45, base * 1.12, base]
  }
  return [base, base, base]
}

function instanceMatrix(transform: BiomeTransform, yOffset = 0): Matrix4 {
  const helper = new Object3D()
  const scale = scaleFor(transform)
  helper.position.set(
    transform.x,
    transform.y + yOffset,
    transform.z,
  )
  helper.rotation.y = transform.yaw
  helper.scale.set(...scale)
  helper.updateMatrix()
  return helper.matrix.clone()
}

function makeInstances(input: {
  name: string
  transforms: readonly BiomeTransform[]
  geometry: BufferGeometry
  material: Material
  colors: readonly [string, string, string]
  yOffset?: (transform: BiomeTransform) => number
  shadows?: boolean
}): InstancedMesh {
  const mesh = new InstancedMesh(input.geometry, input.material, input.transforms.length)
  mesh.name = input.name
  mesh.castShadow = input.shadows ?? false
  mesh.receiveShadow = input.shadows ?? false
  for (let index = 0; index < input.transforms.length; index++) {
    const transform = input.transforms[index]
    mesh.setMatrixAt(index, instanceMatrix(transform, input.yOffset?.(transform) ?? 0))
    mesh.setColorAt(index, new Color(input.colors[transform.variant]))
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
  return mesh
}

function buildBiomeGroup(plan: BiomeMosaicPlan, shadows: boolean): OwnedBiomeGroup {
  const group = new Group()
  group.name = 'biomes:mosaic'
  const geometries: BufferGeometry[] = []
  const materials: Material[] = []

  for (const definition of BIOME_DEFINITIONS) {
    const biomeTransforms = plan.transforms.filter((transform) => transform.biome === definition.id)
    for (const layer of BIOME_LAYERS) {
      const transforms = biomeTransforms.filter((transform) => transform.layer === layer)
      if (transforms.length === 0) continue
      if (layer === 'canopy') {
        const trunkGeometry = trunkGeometryForBiome(definition.id)
        const crownGeometry = canopyGeometryForBiome(definition.id)
        const trunkMaterial = createPainterlyMaterial('bark', {
          color: '#ffffff',
          vertexColors: true,
        })
        const crownMaterial = createPainterlyMaterial('foliage', {
          color: '#ffffff',
          vertexColors: true,
        })
        geometries.push(trunkGeometry, crownGeometry)
        materials.push(trunkMaterial, crownMaterial)
        group.add(
          makeInstances({
            name: `biome:${definition.id}:trunks`,
            transforms,
            geometry: trunkGeometry,
            material: trunkMaterial,
            colors: definition.colors.trunk,
            shadows,
          }),
          makeInstances({
            name: `biome:${definition.id}:canopy`,
            transforms,
            geometry: crownGeometry,
            material: crownMaterial,
            colors: definition.colors.canopy,
            shadows,
          }),
        )
        continue
      }

      const geometry = layerGeometry(layer)
      const atmosphere = layer === 'atmosphere'
      const material = atmosphere
        ? new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.58, depthWrite: false })
        : createPainterlyMaterial(layer === 'geology' ? 'rock' : 'foliage', {
            color: '#ffffff',
            vertexColors: true,
          })
      geometries.push(geometry)
      materials.push(material)
      group.add(
        makeInstances({
          name: `biome:${definition.id}:${layer}`,
          transforms,
          geometry,
          material,
          colors: definition.colors[layer],
          yOffset: atmosphere
            ? (transform) => 0.8 + transform.variant * 0.74 + transform.scale * 0.42
            : undefined,
          shadows: shadows && (layer === 'midstory' || layer === 'geology'),
        }),
      )
    }
  }
  return { group, geometries, materials }
}

/** Five overlapping signature biomes rendered as a compact instanced kit. */
export function BiomeMosaic() {
  const seed = useSettings((state) => state.worldSeed)
  const quality = useQualityProfile()
  const density = Math.max(0.35, quality.vegetationDensity)
  const plan = useMemo(() => buildBiomeMosaicPlan(seed, density), [density, seed])
  const owned = useMemo(
    () => buildBiomeGroup(plan, quality.shadowsEnabled),
    [plan, quality.shadowsEnabled],
  )

  useEffect(() => {
    const unregister = registerProbeSection('world', 'biome-mosaic', () => ({
      biomeCount: BIOME_DEFINITIONS.length,
      biomeInstances: plan.transforms.length,
      biomeLayers: Object.fromEntries(
        BIOME_DEFINITIONS.map(({ id }) => [id, { ...plan.layerCounts[id] }]),
      ),
      biomeClusterFamilies: Object.fromEntries(
        BIOME_DEFINITIONS.map(({ id }) => [id, [...plan.clusterFamilies[id]]]),
      ),
    }))
    return () => unregister()
  }, [plan])

  useEffect(
    () => () => {
      for (const material of owned.materials) material.dispose()
      for (const geometry of owned.geometries) geometry.dispose()
    },
    [owned],
  )

  return <primitive object={owned.group} />
}

export function biomePalette(id: SanctuaryBiome): BiomeDefinition['colors'] {
  return biomeDefinition(id).colors
}
