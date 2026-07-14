/** Seat state: camera glides to the seat, player body stays parked until standing. */
import { Vector3 } from 'three'
import { useGame } from '../state/gameStore'
import { events } from '../core/events'
import { runtime } from '../core/runtime'

export interface ActiveSeat {
  eye: Vector3
  yaw: number
  stand: Vector3
  /** boosts ocean/wind ambience while seated (overlook benches) */
  listen?: boolean
}

let current: ActiveSeat | null = null

export function sitAt(seat: ActiveSeat): void {
  current = seat
  const g = useGame.getState()
  g.setSitting(true)
  runtime.player.yaw = seat.yaw
  runtime.player.pitch = -0.04
  events.emit('interactSound', { kind: 'sit' })
}

export function standUp(): void {
  if (!current) return
  const seat = current
  current = null
  const g = useGame.getState()
  g.setSitting(false)
  events.emit('teleport', {
    x: seat.stand.x,
    y: seat.stand.y,
    z: seat.stand.z,
    reason: 'debug',
  })
}

export function activeSeat(): ActiveSeat | null {
  return current
}
