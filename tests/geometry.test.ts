import { BoxGeometry, InstancedMesh, MeshBasicMaterial } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { BuildPlan } from '../src/game/village/kit/geometry'
import { PLAYER } from '../src/game/config/constants'
import { QUALITY_PROFILES } from '../src/game/core/quality'
import { VegetationResourceOwner } from '../src/game/village/Vegetation'
import {
  applyVegetationTransforms,
  buildTreeColliderDescriptors,
} from '../src/game/village/vegetation/VegetationCell'
import { DEFAULT_SPATIAL_GRID } from '../src/game/world/spatial/types'

describe('BuildPlan colliders', () => {
  it('preserves the complete visual rotation for inclined solid parts', () => {
    const plan = new BuildPlan()
    const rotation: [number, number, number] = [-0.18, 0.72, 0.04]

    plan.solid('woodDeck', {
      pos: [4, 2, -3],
      size: [2.4, 0.18, 8],
      rot: rotation,
    })

    expect(plan.colliders).toEqual([
      {
        pos: [4, 2, -3],
        size: [2.4, 0.18, 8],
        rot: rotation,
      },
    ])
  })
})

describe('vegetation geometry', () => {
  it('computes aggregate instance bounds and enables true frustum culling', () => {
    const geometry = new BoxGeometry(1, 1, 1)
    const material = new MeshBasicMaterial()
    const mesh = new InstancedMesh(geometry, material, 2)

    applyVegetationTransforms(mesh, [
      { id: 'tree:a', x: 10, y: 2, z: -3, scale: 2, yaw: 0, variant: 0 },
      { id: 'tree:b', x: -4, y: 1, z: 5, scale: 1, yaw: 0, variant: 0 },
    ])

    expect(mesh.frustumCulled).toBe(true)
    expect(mesh.boundingBox).not.toBeNull()
    expect(mesh.boundingSphere).not.toBeNull()
    expect(mesh.boundingBox?.min.x).toBeCloseTo(-4.5)
    expect(mesh.boundingBox?.max.x).toBeCloseTo(11)
    expect(mesh.boundingSphere?.radius).toBeGreaterThan(0)

    geometry.dispose()
    material.dispose()
  })

  it('derives stable collider topology directly from canonical trees', () => {
    const trees = [
      { id: 'trees:000001', x: 2, y: 5, z: -8, scale: 1.25, yaw: 0.2, variant: 1 },
    ] as const
    expect(buildTreeColliderDescriptors(trees)).toEqual([
      {
        id: 'trees:000001',
        halfHeight: 1.4,
        radius: 0.275,
        position: [2, 6.4, -8],
      },
    ])
  })

  it('disposes every shared material and geometry exactly once', () => {
    const owner = new VegetationResourceOwner()
    const resources = owner.resources
    const geometries = new Set([
      resources.grass.geometry,
      resources.flowers.geometry,
      resources.bushes.geometry,
      resources.rocks.geometry,
      ...resources.treeTrunks,
      ...resources.trees.map((tree) => tree.geometry),
      resources.horizonTrees.geometry,
    ])
    const materials = new Set([
      resources.grass.material,
      resources.flowers.material,
      resources.bushes.material,
      resources.rocks.material,
      resources.treeTrunkMaterial,
      ...resources.trees.map((tree) => tree.material),
      resources.horizonTrees.material,
    ])
    const onDispose = vi.fn()
    for (const resource of [...geometries, ...materials]) {
      resource.addEventListener('dispose', onDispose)
    }

    owner.dispose()
    owner.dispose()

    expect(onDispose).toHaveBeenCalledTimes(geometries.size + materials.size)
  })

  it('keeps the active neighborhood wider than one ten-hertz player step', () => {
    const maximumStep = PLAYER.jogSpeed / 10
    for (const quality of Object.values(QUALITY_PROFILES)) {
      expect(quality.cellLoadRadius * DEFAULT_SPATIAL_GRID.cellSize).toBeGreaterThan(maximumStep)
    }
  })
})
