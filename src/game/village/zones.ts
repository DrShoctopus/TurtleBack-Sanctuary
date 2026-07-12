/** Interior zone registry + player zone/district tracking (drives audio + HUD). */
import { DISTRICTS } from '../config/layout'
import { runtime } from '../core/runtime'
import { useGame } from '../state/gameStore'

export interface ZoneBox {
  id: string
  name: string
  cx: number
  cy: number
  cz: number
  halfX: number
  halfY: number
  halfZ: number
  rotY: number
  /** ambience flavor for the audio engine */
  flavor: 'home' | 'cafe' | 'greenhouse' | 'bath' | 'observatory' | 'room'
}

const zones: ZoneBox[] = []

export function registerZone(z: ZoneBox): () => void {
  zones.push(z)
  return () => {
    const i = zones.indexOf(z)
    if (i >= 0) zones.splice(i, 1)
  }
}

export function zoneAt(x: number, y: number, z: number): ZoneBox | null {
  for (const zone of zones) {
    const dx = x - zone.cx
    const dz = z - zone.cz
    const cos = Math.cos(zone.rotY)
    const sin = Math.sin(zone.rotY)
    const lx = dx * cos - dz * sin
    const lz = dx * sin + dz * cos
    if (
      Math.abs(lx) <= zone.halfX &&
      Math.abs(lz) <= zone.halfZ &&
      y >= zone.cy - zone.halfY &&
      y <= zone.cy + zone.halfY
    ) {
      return zone
    }
  }
  return null
}

let lastDistrict = ''

/** Called ~4×/sec from the frame driver. */
export function updatePlayerZone(): void {
  const p = runtime.player.pos
  const zone = zoneAt(p.x, p.y + 1.2, p.z)
  runtime.player.zone = zone?.id ?? 'outdoor'
  runtime.player.indoors = zone !== null
  if (zone) {
    if (lastDistrict !== zone.id) {
      lastDistrict = zone.id
      useGame.getState().setLocation(zone.name)
    }
    return
  }
  let best: string | null = null
  let bestName = ''
  for (const d of DISTRICTS) {
    const dx = p.x - d.x
    const dz = p.z - d.z
    if (dx * dx + dz * dz < d.r * d.r) {
      best = d.id
      bestName = d.name
      break
    }
  }
  if (best && lastDistrict !== best) {
    lastDistrict = best
    useGame.getState().setLocation(bestName)
  }
}
