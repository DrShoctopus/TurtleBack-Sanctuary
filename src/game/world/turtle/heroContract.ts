import {
  TURTLE_REQUIRED_CLIPS,
  TURTLE_REQUIRED_NODES,
  TURTLE_SHELL_ANCHOR,
  type TurtleModelContract,
} from './modelContract'

/** Runtime-authored hero metadata. Bounds are deliberately identical across LODs. */
export const MONUMENTAL_TURTLE_CONTRACT: TurtleModelContract = Object.freeze({
  metreScale: 1,
  bowAxis: '-z',
  nodes: Object.freeze([...TURTLE_REQUIRED_NODES]),
  clips: Object.freeze([...TURTLE_REQUIRED_CLIPS]),
  lods: Object.freeze([
    Object.freeze({
      level: 0 as const,
      triangleCount: 31_680,
      bounds: Object.freeze([-232, -58, -350, 232, 32, 282] as const),
    }),
    Object.freeze({
      level: 1 as const,
      triangleCount: 13_920,
      bounds: Object.freeze([-232, -58, -350, 232, 32, 282] as const),
    }),
    Object.freeze({
      level: 2 as const,
      triangleCount: 4_880,
      bounds: Object.freeze([-232, -58, -350, 232, 32, 282] as const),
    }),
  ]),
  shellAnchor: TURTLE_SHELL_ANCHOR,
  collision: Object.freeze({ animated: false, overlapsTraversal: false }),
})
