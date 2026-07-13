import { describe, expect, it } from 'vitest'
import {
  SpatialCellTracker,
  cellBounds,
  cellId,
  cellNeighborhood,
  worldToCell,
} from '../src/game/world/spatial/cells'
import {
  DEFAULT_SPATIAL_GRID,
  type CellTransition,
  type SpatialGridConfig,
} from '../src/game/world/spatial/types'

const profileGrid = (loadRadius: number, retainRadius: number): SpatialGridConfig => ({
  ...DEFAULT_SPATIAL_GRID,
  loadRadius,
  retainRadius,
})

function expectFrozenTransition(transition: CellTransition): void {
  expect(Object.isFrozen(transition)).toBe(true)
  expect(Object.isFrozen(transition.center)).toBe(true)
  expect(Object.isFrozen(transition.active)).toBe(true)
  expect(Object.isFrozen(transition.retained)).toBe(true)
  expect(Object.isFrozen(transition.entered)).toBe(true)
  expect(Object.isFrozen(transition.exited)).toBe(true)
}

describe('centred spatial cells', () => {
  it('maps exact positive and negative boundaries consistently', () => {
    expect(worldToCell(-75, -75)).toEqual({ ix: -1, iz: -1 })
    expect(worldToCell(-25.000_001, -25.000_001)).toEqual({ ix: -1, iz: -1 })
    expect(worldToCell(-25, -25)).toEqual({ ix: 0, iz: 0 })
    expect(worldToCell(24.999_999, 24.999_999)).toEqual({ ix: 0, iz: 0 })
    expect(worldToCell(25, 25)).toEqual({ ix: 1, iz: 1 })
    expect(worldToCell(75, 75)).toEqual({ ix: 2, iz: 2 })
  })

  it('uses the configured origin as the centre of cell zero', () => {
    const config = { ...DEFAULT_SPATIAL_GRID, originX: 100, originZ: -100 }
    expect(worldToCell(75, -125, config)).toEqual({ ix: 0, iz: 0 })
    expect(worldToCell(125, -75, config)).toEqual({ ix: 1, iz: 1 })

    const bounds = cellBounds({ ix: 0, iz: 0 }, config)
    expect(bounds.min.toArray()).toEqual([75, -125])
    expect(bounds.max.toArray()).toEqual([125, -75])
  })

  it('formats IDs and neighborhoods in stable row-major order', () => {
    expect(cellId({ ix: -2, iz: 3 })).toBe('-2:3')
    expect(cellNeighborhood({ ix: 0, iz: 0 }, 1)).toEqual([
      '-1:-1',
      '0:-1',
      '1:-1',
      '-1:0',
      '0:0',
      '1:0',
      '-1:1',
      '0:1',
      '1:1',
    ])
  })

  it('rejects invalid coordinates, radii, and grid dimensions', () => {
    expect(() => worldToCell(Number.NaN, 0)).toThrow(RangeError)
    expect(() => cellId({ ix: 0.5, iz: 0 })).toThrow(RangeError)
    expect(() => cellNeighborhood({ ix: 0, iz: 0 }, -1)).toThrow(RangeError)
    expect(() => new SpatialCellTracker({ ...DEFAULT_SPATIAL_GRID, cellSize: 0 })).toThrow(
      RangeError,
    )
    expect(
      () => new SpatialCellTracker({ ...DEFAULT_SPATIAL_GRID, loadRadius: 3, retainRadius: 2 }),
    ).toThrow(RangeError)
  })
})

describe('SpatialCellTracker', () => {
  it('builds the active and retained windows on the first sample', () => {
    const tracker = new SpatialCellTracker()
    const transition = tracker.update(-56, -126)

    expect(transition?.center).toEqual({ ix: -1, iz: -3 })
    expect(transition?.active).toHaveLength(9)
    expect(transition?.retained).toHaveLength(25)
    expect(transition?.entered).toEqual(transition?.retained)
    expect(transition?.exited).toEqual([])
    expectFrozenTransition(transition!)
    expect(tracker.snapshot()).toBe(transition)
  })

  it('retains each prior axis until its hysteresis boundary is crossed', () => {
    const tracker = new SpatialCellTracker()
    expect(tracker.update(24, 0)?.center).toEqual({ ix: 0, iz: 0 })
    expect(tracker.update(26, 0)).toBeNull()
    expect(tracker.update(31, 0)).toBeNull()
    expect(tracker.update(32, 0)?.center).toEqual({ ix: 1, iz: 0 })
    expect(tracker.update(26, 32)?.center).toEqual({ ix: 1, iz: 1 })
    expect(tracker.update(18, 32)?.center).toEqual({ ix: 0, iz: 1 })
  })

  it('applies the same hysteresis to negative boundaries', () => {
    const tracker = new SpatialCellTracker()
    expect(tracker.update(0, 0)?.center).toEqual({ ix: 0, iz: 0 })
    expect(tracker.update(-31, -31)).toBeNull()
    expect(tracker.update(-32, -32)?.center).toEqual({ ix: -1, iz: -1 })
    expect(tracker.update(-19, -19)).toBeNull()
    expect(tracker.update(-18, -18)?.center).toEqual({ ix: 0, iz: 0 })
  })

  it('emits retained-set deltas in deterministic order and no stationary churn', () => {
    const tracker = new SpatialCellTracker(profileGrid(1, 2))
    tracker.update(0, 0)
    const transition = tracker.update(32, 0)

    expect(transition?.entered).toEqual(['3:-2', '3:-1', '3:0', '3:1', '3:2'])
    expect(transition?.exited).toEqual(['-2:-2', '-2:-1', '-2:0', '-2:1', '-2:2'])
    expect(tracker.update(40, 4)).toBeNull()
    expect(tracker.snapshot()).toBe(transition)
  })

  it('reconfigures all quality radii while stationary', () => {
    const tracker = new SpatialCellTracker(profileGrid(1, 2))
    tracker.update(-56, -126)

    const medium = tracker.reconfigure(profileGrid(2, 3))
    expect(medium?.center).toEqual({ ix: -1, iz: -3 })
    expect(medium?.active).toHaveLength(25)
    expect(medium?.retained).toHaveLength(49)
    expect(medium?.entered).toHaveLength(24)
    expect(medium?.exited).toHaveLength(0)

    const high = tracker.reconfigure(profileGrid(3, 4))
    expect(high?.active).toHaveLength(49)
    expect(high?.retained).toHaveLength(81)

    const ultra = tracker.reconfigure(profileGrid(4, 5))
    expect(ultra?.active).toHaveLength(81)
    expect(ultra?.retained).toHaveLength(121)

    const low = tracker.reconfigure(profileGrid(1, 2))
    expect(low?.active).toHaveLength(9)
    expect(low?.retained).toHaveLength(25)
    expect(low?.entered).toHaveLength(0)
    expect(low?.exited).toHaveLength(96)
    expect(tracker.reconfigure(profileGrid(1, 2))).toBeNull()
  })

  it('recomputes the centre if the grid itself is reconfigured', () => {
    const tracker = new SpatialCellTracker()
    tracker.update(20, 20)
    const transition = tracker.reconfigure({
      ...DEFAULT_SPATIAL_GRID,
      originX: -50,
      originZ: -50,
    })
    expect(transition?.center).toEqual({ ix: 1, iz: 1 })
  })
})
