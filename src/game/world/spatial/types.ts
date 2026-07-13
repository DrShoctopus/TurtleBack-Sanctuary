export interface SpatialGridConfig {
  cellSize: number
  /** World-space centre of cell index zero on the X axis. */
  originX: number
  /** World-space centre of cell index zero on the Z axis. */
  originZ: number
  loadRadius: number
  retainRadius: number
  boundaryHysteresis: number
}

export interface CellCoord {
  ix: number
  iz: number
}

export type CellKey = `${number}:${number}`

export interface CellTransition {
  center: Readonly<CellCoord>
  active: readonly CellKey[]
  retained: readonly CellKey[]
  /** Retained cells newly resident since the previous transition. */
  entered: readonly CellKey[]
  /** Previously retained cells that are no longer resident. */
  exited: readonly CellKey[]
}

export interface SpatialRuntimeState {
  center: Readonly<CellCoord>
  active: readonly CellKey[]
  retained: readonly CellKey[]
}

export const DEFAULT_SPATIAL_GRID: Readonly<SpatialGridConfig> = Object.freeze({
  cellSize: 50,
  originX: 0,
  originZ: 0,
  loadRadius: 1,
  retainRadius: 2,
  boundaryHysteresis: 6,
})
