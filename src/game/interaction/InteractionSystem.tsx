import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { Ray } from '@dimforge/rapier3d-compat'
import { Vector3 } from 'three'
import { PLAYER } from '../config/constants'
import { input } from '../input/InputManager'
import { useGame } from '../state/gameStore'
import { useSettings } from '../state/settingsStore'
import { standUp } from '../activities/sitting'

export interface InteractionDef {
  id: string
  label: string | (() => string)
  position: [number, number, number]
  /** max use distance */
  radius?: number
  onUse: () => void
  enabled?: () => boolean
}

const registry = new Map<string, InteractionDef>()

export function registerInteraction(def: InteractionDef): () => void {
  registry.set(def.id, def)
  return () => {
    registry.delete(def.id)
  }
}

const CONE_COS = Math.cos((PLAYER.interactConeDeg * Math.PI) / 180)

/**
 * Picks the interactable the player is looking at (distance + view cone +
 * physics occlusion), surfaces the prompt, and dispatches use actions.
 */
export function InteractionSystem() {
  const camera = useThree((s) => s.camera)
  const { world } = useRapier()
  const toTarget = useMemo(() => new Vector3(), [])
  const forward = useMemo(() => new Vector3(), [])
  const holdTime = useRef(0)
  const currentTarget = useRef<InteractionDef | null>(null)

  // clear prompt on unmount
  useEffect(() => () => useGame.getState().setPrompt(null), [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.1, dtRaw)
    const g = useGame.getState()
    if (g.phase !== 'playing' || g.overlay !== null) {
      if (g.prompt) g.setPrompt(null)
      return
    }

    // seated: single prompt — stand
    if (g.sitting) {
      g.setPrompt({ label: 'Stand up', action: 'stand' })
      if (input.consumeKey('interact') || input.padPressed('interact') || input.padPressed('back') || input.consumeKey('jump')) {
        standUp()
      }
      return
    }
    if (g.telescope) {
      g.setPrompt({ label: 'Lower telescope', action: 'stand' })
      if (input.consumeKey('interact') || input.padPressed('interact') || input.padPressed('back')) {
        g.setTelescope(false)
      }
      return
    }

    // find best target
    let best: InteractionDef | null = null
    let bestScore = Infinity
    camera.getWorldDirection(forward)
    for (const def of registry.values()) {
      if (def.enabled && !def.enabled()) continue
      toTarget.set(def.position[0], def.position[1], def.position[2]).sub(camera.position)
      const dist = toTarget.length()
      const maxDist = def.radius ?? 2.9
      if (dist > maxDist) continue
      toTarget.divideScalar(dist || 1)
      const dot = toTarget.dot(forward)
      if (dist > 1.1 && dot < CONE_COS) continue
      const score = (1 - dot) * 3 + dist * 0.12
      if (score < bestScore) {
        bestScore = score
        best = def
      }
    }

    // occlusion: a wall between camera and target cancels the prompt
    if (best) {
      toTarget.set(best.position[0], best.position[1], best.position[2]).sub(camera.position)
      const dist = toTarget.length()
      if (dist > 0.6) {
        toTarget.divideScalar(dist)
        const ray = new Ray(
          { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          { x: toTarget.x, y: toTarget.y, z: toTarget.z },
        )
        const hit = world.castRay(ray, dist - 0.35, true, undefined, undefined, undefined, undefined, (c) => {
          const rb = c.parent()
          return !(rb && (rb.userData as { player?: boolean } | undefined)?.player)
        })
        if (hit) best = null
      }
    }

    if (currentTarget.current !== best) {
      currentTarget.current = best
      holdTime.current = 0
      g.setPrompt(
        best ? { label: typeof best.label === 'function' ? best.label() : best.label, action: 'interact' } : null,
      )
    } else if (best && typeof best.label === 'function') {
      // dynamic labels (e.g. "Brewing…") refresh in place
      g.setPrompt({ label: best.label(), action: 'interact' })
    }

    if (!best) return
    const hold = useSettings.getState().comfort.holdToInteract
    if (hold) {
      const heldNow = input.padHeld('interact') || input.keyHeld('interact')
      input.consumeKey('interact')
      if (heldNow) {
        holdTime.current += dt
        if (holdTime.current >= 0.35) {
          holdTime.current = -999 // fire once per hold
          best.onUse()
        }
      } else {
        holdTime.current = 0
      }
    } else if (input.consumeKey('interact') || input.padPressed('interact') || input.padPressed('interactAlt')) {
      best.onUse()
    }
  })

  return null
}
