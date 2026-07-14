import { Box2, Vector2 } from 'three'
import {
  DEFAULT_SPATIAL_GRID,
  type CellCoord,
  type CellKey,
  type CellTransition,
  type SpatialGridConfig,
} from './types'

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`)
}

function assertCellCoord(coord: CellCoord): void {
  if (!Number.isSafeInteger(coord.ix) || !Number.isSafeInteger(coord.iz)) {
    throw new RangeError('cell coordinates must be safe integers')
  }
}

function validateGrid(config: SpatialGridConfig): SpatialGridConfig {
  assertFinite(config.cellSize, 'cellSize')
  assertFinite(config.originX, 'originX')
  assertFinite(config.originZ, 'originZ')
  assertFinite(config.boundaryHysteresis, 'boundaryHysteresis')
  if (config.cellSize <= 0) throw new RangeError('cellSize must be positive')
  if (config.boundaryHysteresis < 0) {
    throw new RangeError('boundaryHysteresis must not be negative')
  }
  if (!Number.isSafeInteger(config.loadRadius) || config.loadRadius < 0) {
    throw new RangeError('loadRadius must be a non-negative safe integer')
  }
  if (!Number.isSafeInteger(config.retainRadius) || config.retainRadius < config.loadRadius) {
    throw new RangeError('retainRadius must be a safe integer at least as large as loadRadius')
  }
  return { ...config }
}

function gridsEqual(a: SpatialGridConfig, b: SpatialGridConfig): boolean {
  return (
    a.cellSize === b.cellSize &&
    a.originX === b.originX &&
    a.originZ === b.originZ &&
    a.loadRadius === b.loadRadius &&
    a.retainRadius === b.retainRadius &&
    a.boundaryHysteresis === b.boundaryHysteresis
  )
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function frozenCoord(coord: CellCoord): Readonly<CellCoord> {
  return Object.freeze({ ix: coord.ix, iz: coord.iz })
}

function frozenKeys(keys: readonly CellKey[]): readonly CellKey[] {
  return Object.freeze([...keys])
}

function makeTransition(
  center: CellCoord,
  active: readonly CellKey[],
  retained: readonly CellKey[],
  entered: readonly CellKey[],
  exited: readonly CellKey[],
): CellTransition {
  return Object.freeze({
    center: frozenCoord(center),
    active: frozenKeys(active),
    retained: frozenKeys(retained),
    entered: frozenKeys(entered),
    exited: frozenKeys(exited),
  })
}

export function cellId(coord: CellCoord): CellKey {
  assertCellCoord(coord)
  return `${coord.ix}:${coord.iz}`
}

export function worldToCell(
  x: number,
  z: number,
  config: SpatialGridConfig = DEFAULT_SPATIAL_GRID,
): CellCoord {
  assertFinite(x, 'x')
  assertFinite(z, 'z')
  const grid = validateGrid(config)
  const halfCell = grid.cellSize / 2
  return {
    ix: Math.floor((x - grid.originX + halfCell) / grid.cellSize),
    iz: Math.floor((z - grid.originZ + halfCell) / grid.cellSize),
  }
}

export function cellBounds(
  coord: CellCoord,
  config: SpatialGridConfig = DEFAULT_SPATIAL_GRID,
): Box2 {
  assertCellCoord(coord)
  const grid = validateGrid(config)
  const halfCell = grid.cellSize / 2
  const centerX = grid.originX + coord.ix * grid.cellSize
  const centerZ = grid.originZ + coord.iz * grid.cellSize
  return new Box2(
    new Vector2(centerX - halfCell, centerZ - halfCell),
    new Vector2(centerX + halfCell, centerZ + halfCell),
  )
}

/** Row-major by Z, then X. This ordering is part of the residency contract. */
export function cellNeighborhood(center: CellCoord, radius: number): readonly CellKey[] {
  assertCellCoord(center)
  if (!Number.isSafeInteger(radius) || radius < 0) {
    throw new RangeError('cell radius must be a non-negative safe integer')
  }
  const keys: CellKey[] = []
  for (let iz = center.iz - radius; iz <= center.iz + radius; iz++) {
    for (let ix = center.ix - radius; ix <= center.ix + radius; ix++) {
      keys.push(cellId({ ix, iz }))
    }
  }
  return keys
}

function retainedDelta(
  previous: readonly CellKey[],
  next: readonly CellKey[],
): { entered: CellKey[]; exited: CellKey[] } {
  const previousSet = new Set(previous)
  const nextSet = new Set(next)
  return {
    entered: next.filter((key) => !previousSet.has(key)),
    exited: previous.filter((key) => !nextSet.has(key)),
  }
}

function hystereticAxis(
  value: number,
  currentIndex: number,
  origin: number,
  config: SpatialGridConfig,
): number {
  const halfCell = config.cellSize / 2
  const center = origin + currentIndex * config.cellSize
  const min = center - halfCell - config.boundaryHysteresis
  const max = center + halfCell + config.boundaryHysteresis
  if (value >= min && value <= max) return currentIndex
  return Math.floor((value - origin + halfCell) / config.cellSize)
}

export class SpatialCellTracker {
  private config: SpatialGridConfig
  private sampled = false
  private lastX = 0
  private lastZ = 0
  private current: CellTransition

  constructor(config: SpatialGridConfig = DEFAULT_SPATIAL_GRID) {
    this.config = validateGrid(config)
    const center = worldToCell(this.config.originX, this.config.originZ, this.config)
    const active = cellNeighborhood(center, this.config.loadRadius)
    const retained = cellNeighborhood(center, this.config.retainRadius)
    this.current = makeTransition(center, active, retained, retained, [])
  }

  update(x: number, z: number): CellTransition | null {
    assertFinite(x, 'x')
    assertFinite(z, 'z')
    this.lastX = x
    this.lastZ = z

    let center: CellCoord
    if (!this.sampled) {
      center = worldToCell(x, z, this.config)
    } else {
      center = {
        ix: hystereticAxis(x, this.current.center.ix, this.config.originX, this.config),
        iz: hystereticAxis(z, this.current.center.iz, this.config.originZ, this.config),
      }
    }

    if (
      this.sampled &&
      center.ix === this.current.center.ix &&
      center.iz === this.current.center.iz
    ) {
      return null
    }

    const active = cellNeighborhood(center, this.config.loadRadius)
    const retained = cellNeighborhood(center, this.config.retainRadius)
    const previousRetained = this.sampled ? this.current.retained : []
    const { entered, exited } = retainedDelta(previousRetained, retained)
    this.sampled = true
    this.current = makeTransition(center, active, retained, entered, exited)
    return this.current
  }

  reconfigure(config: SpatialGridConfig): CellTransition | null {
    const nextConfig = validateGrid(config)
    if (gridsEqual(this.config, nextConfig)) return null

    const gridGeometryChanged =
      this.config.cellSize !== nextConfig.cellSize ||
      this.config.originX !== nextConfig.originX ||
      this.config.originZ !== nextConfig.originZ
    this.config = nextConfig

    if (!this.sampled) {
      const center = worldToCell(nextConfig.originX, nextConfig.originZ, nextConfig)
      const active = cellNeighborhood(center, nextConfig.loadRadius)
      const retained = cellNeighborhood(center, nextConfig.retainRadius)
      this.current = makeTransition(center, active, retained, retained, [])
      return null
    }

    const center = gridGeometryChanged
      ? worldToCell(this.lastX, this.lastZ, nextConfig)
      : { ix: this.current.center.ix, iz: this.current.center.iz }
    const active = cellNeighborhood(center, nextConfig.loadRadius)
    const retained = cellNeighborhood(center, nextConfig.retainRadius)

    if (
      center.ix === this.current.center.ix &&
      center.iz === this.current.center.iz &&
      arraysEqual(active, this.current.active) &&
      arraysEqual(retained, this.current.retained)
    ) {
      return null
    }

    const { entered, exited } = retainedDelta(this.current.retained, retained)
    this.current = makeTransition(center, active, retained, entered, exited)
    return this.current
  }

  snapshot(): CellTransition {
    return this.current
  }
}
