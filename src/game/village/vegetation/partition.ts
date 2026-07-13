import type { SpatialGridConfig } from '../../world/spatial/types'
import { cellId, worldToCell } from '../../world/spatial/cells'
import {
  VEGETATION_LAYERS,
  type VegetationCellPopulation,
  type VegetationLayer,
  type VegetationPopulation,
  type VegetationTransform,
} from './types'

export const MAX_HORIZON_TREES_PER_CELL = 4

type MutableLayers = Record<VegetationLayer, VegetationTransform[]>

function emptyLayers(): MutableLayers {
  return { grass: [], flowers: [], bushes: [], rocks: [], trees: [] }
}

function compareCellIds(left: string, right: string): number {
  const [leftX, leftZ] = left.split(':').map(Number)
  const [rightX, rightZ] = right.split(':').map(Number)
  return leftZ - rightZ || leftX - rightX
}

function selectHorizonTrees(trees: readonly VegetationTransform[]): readonly VegetationTransform[] {
  if (trees.length <= MAX_HORIZON_TREES_PER_CELL) return trees
  return Array.from({ length: MAX_HORIZON_TREES_PER_CELL }, (_, index) => {
    const treeIndex = Math.floor((index * (trees.length - 1)) / (MAX_HORIZON_TREES_PER_CELL - 1))
    return trees[treeIndex]
  })
}

/** Partition every render transform once, preserving deterministic IDs and order. */
export function partitionVegetationByCell(
  population: VegetationPopulation,
  config: SpatialGridConfig,
): ReadonlyMap<VegetationCellPopulation['cellId'], VegetationCellPopulation> {
  const mutable = new Map<VegetationCellPopulation['cellId'], MutableLayers>()

  for (const layer of VEGETATION_LAYERS) {
    for (const transform of population.layers[layer]) {
      const key = cellId(worldToCell(transform.x, transform.z, config))
      let layers = mutable.get(key)
      if (!layers) {
        layers = emptyLayers()
        mutable.set(key, layers)
      }
      layers[layer].push(transform)
    }
  }

  return new Map(
    [...mutable.entries()]
      .sort(([left], [right]) => compareCellIds(left, right))
      .map(([key, layers]) => {
        for (const layer of VEGETATION_LAYERS) {
          layers[layer].sort((left, right) => left.id.localeCompare(right.id))
        }
        return [
          key,
          {
            cellId: key,
            near: layers,
            horizonTrees: selectHorizonTrees(layers.trees),
          },
        ] as const
      }),
  )
}
