import type { TurtleClipName } from './modelContract'

export type TurtleScaleEventKind = 'deep-breath' | 'front-stroke' | 'head-turn' | 'eye-contact'

export interface TurtleScaleEvent {
  id: number
  kind: TurtleScaleEventKind
  startedAt: number
  duration: number
  intensity: number
}

export interface TurtleAnimationInput {
  dt: number
  comfortTime: number
  reducedMotion: boolean
  player: readonly [number, number, number]
  rain: number
  blink: number
  event: TurtleScaleEvent | null
}

export interface TurtleAnimationPlan {
  clipWeights: Readonly<Record<TurtleClipName, number>>
  gazeTarget: readonly [number, number, number]
  wetness: number
  wakeStrength: number
  foliageImpulse: number
  resonanceStrength: number
  sprayStrength: number
}
