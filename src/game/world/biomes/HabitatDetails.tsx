import { useEffect, useMemo } from 'react'
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
} from 'three'
import { useSettings } from '../../state/settingsStore'
import { useQualityProfile } from '../../core/useQualityProfile'
import { createPainterlyMaterial } from '../../rendering/painterlyMaterials'
import { mergeGeometries } from '../../village/kit/merge'
import { registerProbeSection } from '../../debug/probes'
import {
  buildHabitatSignaturePlan,
  type HabitatFeatureKind,
  type HabitatFeatureTransform,
  type HabitatSignaturePlan,
} from './signatureClusters'

const FEATURE_KINDS: readonly HabitatFeatureKind[] = [
  'reed',
  'lily',
  'glow-bulb',
  'root-arch',
  'fall-stone',
  'blossom-sprig',
  'coastal-scrub',
  'saltstone',
  'lantern',
  'civic-planter',
]

const COLORS: Readonly<Record<HabitatFeatureKind, readonly [string, string, string]>> = {
  reed: ['#5f8260', '#79956b', '#4d7058'],
  lily: ['#789b67', '#94aa73', '#5d835e'],
  'glow-bulb': ['#72d9bd', '#b4efc8', '#e6c985'],
  'root-arch': ['#584235', '#6e503b', '#45372f'],
  'fall-stone': ['#71807a', '#92a092', '#5e6d6a'],
  'blossom-sprig': ['#d48e9f', '#f1bbc1', '#b66f8b'],
  'coastal-scrub': ['#61765f', '#81906c', '#4d6658'],
  saltstone: ['#a49c89', '#c0b69b', '#817f75'],
  lantern: ['#d88b55', '#f2bb72', '#bb6d4c'],
  'civic-planter': ['#9a7352', '#b38760', '#776044'],
}

function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  const normalized = parts.map((part) => {
    const geometry = part.index ? part.toNonIndexed() : part.clone()
    for (const attribute of Object.keys(geometry.attributes)) {
      if (attribute !== 'position' && attribute !== 'normal') geometry.deleteAttribute(attribute)
    }
    part.dispose()
    return geometry
  })
  const merged = mergeGeometries(normalized, false)
  for (const geometry of normalized) geometry.dispose()
  if (!merged) throw new Error('habitat detail geometry merge failed')
  merged.computeVertexNormals()
  return merged
}

function geometryFor(kind: HabitatFeatureKind): BufferGeometry {
  if (kind === 'reed') {
    const parts: BufferGeometry[] = []
    for (let index = 0; index < 4; index++) {
      const angle = (index / 4) * Math.PI * 2
      const stem = new CylinderGeometry(0.025, 0.04, 1.45 + index * 0.11, 5)
      stem.translate(Math.cos(angle) * 0.18, 0.72 + index * 0.055, Math.sin(angle) * 0.18)
      parts.push(stem)
      const head = new ConeGeometry(0.09, 0.32, 6)
      head.translate(Math.cos(angle) * 0.18, 1.52 + index * 0.11, Math.sin(angle) * 0.18)
      parts.push(head)
    }
    return mergeParts(parts)
  }
  if (kind === 'lily') {
    const pad = new CylinderGeometry(0.62, 0.68, 0.055, 14)
    pad.translate(0, 0.025, 0)
    return pad
  }
  if (kind === 'glow-bulb') return new SphereGeometry(0.105, 8, 6)
  if (kind === 'root-arch') return new TorusGeometry(1.8, 0.17, 7, 24, Math.PI)
  if (kind === 'fall-stone') {
    const stone = new IcosahedronGeometry(0.9, 1)
    stone.scale(1.45, 0.7, 0.92)
    stone.translate(0, 0.55, 0)
    return stone
  }
  if (kind === 'blossom-sprig') {
    const stem = new CylinderGeometry(0.035, 0.055, 0.9, 6)
    stem.translate(0, 0.45, 0)
    const petals = Array.from({ length: 5 }, (_, index) => {
      const angle = (index / 5) * Math.PI * 2
      const petal = new IcosahedronGeometry(0.18, 1)
      petal.scale(1, 0.46, 0.7)
      petal.translate(Math.cos(angle) * 0.18, 0.96, Math.sin(angle) * 0.18)
      return petal
    })
    return mergeParts([stem, ...petals])
  }
  if (kind === 'coastal-scrub') {
    const parts = Array.from({ length: 5 }, (_, index) => {
      const angle = index * 2.31
      const lobe = new IcosahedronGeometry(0.46, 1)
      lobe.scale(1, 0.62, 0.88)
      lobe.translate(Math.cos(angle) * 0.34, 0.32 + (index % 2) * 0.12, Math.sin(angle) * 0.3)
      return lobe
    })
    return mergeParts(parts)
  }
  if (kind === 'saltstone') {
    const stone = new ConeGeometry(0.72, 2.3, 6, 2)
    stone.scale(0.78, 1, 1)
    stone.translate(0, 1.15, 0)
    return stone
  }
  if (kind === 'lantern') {
    const post = new CylinderGeometry(0.06, 0.09, 2.1, 7)
    post.translate(0, 1.05, 0)
    const lamp = new IcosahedronGeometry(0.24, 1)
    lamp.scale(0.82, 1.18, 0.82)
    lamp.translate(0, 2.03, 0)
    return mergeParts([post, lamp])
  }
  const box = new BoxGeometry(1.2, 0.5, 0.72)
  box.translate(0, 0.25, 0)
  const plant = new IcosahedronGeometry(0.52, 1)
  plant.scale(1.04, 0.62, 0.72)
  plant.translate(0, 0.68, 0)
  return mergeParts([box, plant])
}

function matrixFor(feature: HabitatFeatureTransform): Matrix4 {
  const helper = new Object3D()
  const lift = feature.kind === 'glow-bulb' ? 0.55 + feature.variant * 0.36 : 0
  helper.position.set(feature.x, feature.y + lift, feature.z)
  helper.rotation.y = feature.yaw
  const scale = feature.scale * (feature.kind === 'lily' ? 0.72 : 1)
  helper.scale.set(scale, scale, scale)
  helper.updateMatrix()
  return helper.matrix.clone()
}

interface OwnedDetails {
  readonly group: Group
  readonly geometries: readonly BufferGeometry[]
  readonly materials: readonly Material[]
}

function buildDetails(plan: HabitatSignaturePlan, shadows: boolean): OwnedDetails {
  const group = new Group()
  group.name = 'biomes:signature-details'
  const geometries: BufferGeometry[] = []
  const materials: Material[] = []
  for (const kind of FEATURE_KINDS) {
    const features = plan.features.filter((feature) => feature.kind === kind)
    const geometry = geometryFor(kind)
    const material =
      kind === 'glow-bulb'
        ? new MeshBasicMaterial({
            color: '#ffffff',
            transparent: true,
            opacity: 0.78,
            depthWrite: false,
            toneMapped: false,
          })
        : createPainterlyMaterial(
            kind === 'fall-stone' || kind === 'saltstone'
              ? 'rock'
              : kind === 'root-arch'
                ? 'bark'
                : 'foliage',
            {
              color: '#ffffff',
            },
          )
    const mesh = new InstancedMesh(geometry, material, features.length)
    mesh.name = `habitat-detail:${kind}`
    mesh.castShadow = shadows && kind !== 'glow-bulb' && kind !== 'lily' && kind !== 'reed'
    mesh.receiveShadow =
      shadows && (kind === 'fall-stone' || kind === 'saltstone' || kind === 'civic-planter')
    for (let index = 0; index < features.length; index++) {
      const feature = features[index]
      mesh.setMatrixAt(index, matrixFor(feature))
      mesh.setColorAt(index, new Color(COLORS[kind][feature.variant]))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    group.add(mesh)
    geometries.push(geometry)
    materials.push(material)
  }
  return { group, geometries, materials }
}

export function HabitatDetails() {
  const seed = useSettings((state) => state.worldSeed)
  const quality = useQualityProfile()
  const density = Math.max(0.4, quality.vegetationDensity)
  const plan = useMemo(() => buildHabitatSignaturePlan(seed, density), [density, seed])
  const owned = useMemo(
    () => buildDetails(plan, quality.shadowsEnabled),
    [plan, quality.shadowsEnabled],
  )

  useEffect(() => {
    const unregister = registerProbeSection('world', 'habitat-signatures', () => ({
      habitatSignatureClusters: plan.clusterCount,
      habitatSignatureFeatures: plan.features.length,
      habitatClusterFamilies: Object.fromEntries(
        Object.entries(plan.familiesByBiome).map(([biome, families]) => [biome, [...families]]),
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
