import type { CellKey } from '../../world/spatial/types'

export const VEGETATION_LAYERS = ['grass', 'flowers', 'bushes', 'rocks', 'trees'] as const

export type VegetationLayer = (typeof VEGETATION_LAYERS)[number]

export interface VegetationTransform {
  id: string
  x: number
  y: number
  z: number
  scale: number
  yaw: number
  variant: number
}

export interface VegetationPopulation {
  seed: number
  layers: Readonly<Record<VegetationLayer, readonly VegetationTransform[]>>
}

export interface VegetationCellPopulation {
  cellId: CellKey
  near: VegetationPopulation['layers']
  horizonTrees: readonly VegetationTransform[]
}
