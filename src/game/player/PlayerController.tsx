import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  CapsuleCollider,
  RigidBody,
  useBeforePhysicsStep,
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier'
import type Rapier from '@dimforge/rapier3d-compat'
import { Euler, MathUtils, Vector3 } from 'three'
import { HOME_SPAWN, PLAYER, WORLD } from '../config/constants'
import { DEG2RAD, clamp, damp } from '../core/mathUtils'
import { events } from '../core/events'
import { runtime } from '../core/runtime'
import { input } from '../input/InputManager'
import { useGame } from '../state/gameStore'
import { useSettings, reducedMotionEnabled } from '../state/settingsStore'
import { SafePositionTracker } from './safePosition'
import { isInsideShell, sampleSurfaceAt } from '../world/shell/shellShape'
import { activeSeat } from '../activities/sitting'

const CAPSULE_CENTER_Y = PLAYER.capsuleHalfHeight + PLAYER.capsuleRadius // feet → center

/**
 * Kinematic capsule character: Rapier KinematicCharacterController handles
 * slopes, stairs (autostep) and ground snapping; velocity smoothing lives here.
 */
export function PlayerController() {
  const bodyRef = useRef<RapierRigidBody>(null)
  const { world } = useRapier()
  const camera = useThree((s) => s.camera)
  const controllerRef = useRef<Rapier.KinematicCharacterController | null>(null)
  const vel = useMemo(() => new Vector3(), [])
  const vy = useRef(0)
  const grounded = useRef(false)
  const strideAcc = useRef(0)
  const bobPhase = useRef(0)
  const respawning = useRef(false)
  const tracker = useMemo(
    () =>
      new SafePositionTracker(2, 6, {
        x: HOME_SPAWN.x,
        y: HOME_SPAWN.y,
        z: HOME_SPAWN.z,
        yaw: HOME_SPAWN.yaw,
      }),
    [],
  )
  const euler = useMemo(() => new Euler(0, 0, 0, 'YXZ'), [])
  const tmp = useMemo(() => new Vector3(), [])

  useEffect(() => {
    const c = world.createCharacterController(0.08)
    c.enableAutostep(PLAYER.stepHeight, 0.22, true)
    c.enableSnapToGround(0.45)
    c.setMaxSlopeClimbAngle(PLAYER.maxSlopeDeg * DEG2RAD)
    c.setMinSlopeSlideAngle(58 * DEG2RAD)
    c.setSlideEnabled(true)
    c.setApplyImpulsesToDynamicBodies(false)
    controllerRef.current = c
    return () => {
      world.removeCharacterController(c)
      controllerRef.current = null
    }
  }, [world])

  // Teleports (Return Home, respawn, debug)
  useEffect(() => {
    return events.on('teleport', ({ x, y, z, yaw, pitch }) => {
      const body = bodyRef.current
      if (!body) return
      const groundY = y + CAPSULE_CENTER_Y + 0.05
      body.setTranslation({ x, y: groundY, z }, true)
      vel.set(0, 0, 0)
      vy.current = 0
      if (yaw !== undefined) runtime.player.yaw = yaw
      runtime.player.pitch = pitch ?? 0
    })
  }, [vel])

  useBeforePhysicsStep(() => {
    const body = bodyRef.current
    const controller = controllerRef.current
    if (!body || !controller) return
    const dt = Math.min(0.05, world.timestep)
    const g = useGame.getState()
    const captured =
      g.overlay !== null || g.phase !== 'playing' || g.sitting || g.telescope || g.breathing
    runtime.uiCaptured = captured

    // --- move ---
    const move = captured ? { x: 0, y: 0 } : input.getMove()
    const jog = !captured && input.jogHeld()
    const speedTarget = jog ? PLAYER.jogSpeed : PLAYER.walkSpeed
    const yaw = runtime.player.yaw
    const fx = -Math.sin(yaw)
    const fz = -Math.cos(yaw)
    const rx = Math.cos(yaw)
    const rz = -Math.sin(yaw)
    const wishX = (rx * move.x + fx * move.y) * speedTarget
    const wishZ = (rz * move.x + fz * move.y) * speedTarget
    const half = grounded.current ? 0.07 : 0.28
    vel.x = damp(vel.x, wishX, half, dt)
    vel.z = damp(vel.z, wishZ, half, dt)

    if (grounded.current) {
      vy.current = -2.2
      if (!captured && (input.consumeKey('jump') || input.padPressed('jump'))) {
        vy.current = PLAYER.jumpSpeed
      }
    } else {
      vy.current = Math.max(-32, vy.current + WORLD.gravity * dt)
    }

    tmp.set(vel.x * dt, vy.current * dt, vel.z * dt)
    const collider = body.collider(0)
    controller.computeColliderMovement(collider, tmp, undefined, undefined, undefined)
    const mv = controller.computedMovement()
    const cur = body.translation()
    body.setNextKinematicTranslation({ x: cur.x + mv.x, y: cur.y + mv.y, z: cur.z + mv.z })
    grounded.current = controller.computedGrounded()

    // --- bookkeeping ---
    const px = cur.x + mv.x
    const py = cur.y + mv.y
    const pz = cur.z + mv.z
    runtime.player.pos.set(px, py - CAPSULE_CENTER_Y, pz)
    runtime.player.grounded = grounded.current
    const hSpeed = Math.hypot(vel.x, vel.z)
    runtime.player.speed = hSpeed
    runtime.player.surface = sampleSurfaceAt(px, pz, runtime.player.indoors)

    // footsteps
    if (grounded.current && hSpeed > 0.6) {
      strideAcc.current += hSpeed * dt
      const stride = 0.66 + hSpeed * 0.075
      if (strideAcc.current >= stride) {
        strideAcc.current = 0
        events.emit('footstep', { surface: runtime.player.surface, jog })
      }
      bobPhase.current += hSpeed * dt * 4.4
    }

    // safe spots + fall recovery
    const feetY = py - CAPSULE_CENTER_Y
    const safe =
      grounded.current && !respawning.current && feetY > 2.5 && isInsideShell(px, pz, 0.97)
    tracker.update(dt, { x: px, y: feetY, z: pz, yaw: runtime.player.yaw }, safe)

    if (feetY < WORLD.drownY && !respawning.current) {
      respawning.current = true
      events.emit('respawnSplash', undefined)
      useGame.getState().setFade(true)
      const target = tracker.respawnTarget() ?? { ...HOME_SPAWN }
      window.setTimeout(() => {
        events.emit('teleport', { ...target, reason: 'respawn' })
        useGame.getState().notify('The sea set you gently back ashore')
        window.setTimeout(() => {
          useGame.getState().setFade(false)
          respawning.current = false
        }, 500)
      }, 700)
    }
  })

  // Camera follows the body every render frame; look is applied here so mouse
  // input reaches the view with zero frames of latency.
  useFrame((_, dtRaw) => {
    const body = bodyRef.current
    if (!body) return
    const dt = Math.min(0.05, dtRaw)
    const s = useSettings.getState()
    const reduced = reducedMotionEnabled(s)
    runtime.reducedMotion = reduced
    const g = useGame.getState()
    const captured =
      g.overlay !== null || g.phase !== 'playing' || g.sitting || g.telescope || g.breathing
    if (!captured && (g.pointerLocked || g.device === 'pad')) {
      const look = input.getLook(dt)
      runtime.player.yaw -= look.dx
      runtime.player.pitch = clamp(runtime.player.pitch - look.dy, -1.5, 1.5)
    } else {
      input.getLook(dt) // drain deltas so re-locking doesn't jerk the view
    }
    const p = body.translation()
    let bobY = 0
    let bobX = 0
    if (!reduced && s.comfort.headBob && grounded.current) {
      const amp = Math.min(1, runtime.player.speed / PLAYER.walkSpeed)
      bobY = Math.sin(bobPhase.current * 2) * 0.018 * amp
      bobX = Math.cos(bobPhase.current) * 0.011 * amp
    }
    let sway = 0
    if (!reduced && s.comfort.turtleBob) {
      // the turtle's slow swimming sway, camera-relative only
      const t = performance.now() / 1000
      sway = Math.sin(t * 0.32) * 0.045 + Math.sin(t * 0.13) * 0.03
    }
    let idleSway = 0
    if (!reduced && s.comfort.cameraSway && runtime.player.speed < 0.2 && !g.sitting) {
      const t = performance.now() / 1000
      idleSway = Math.sin(t * 0.42) * 0.008
    }
    const seat = activeSeat()
    if (seat && g.sitting) {
      const target = seat.eye
      if (reduced) camera.position.set(target.x, target.y + sway * 0.4, target.z)
      else {
        camera.position.x = MathUtils.damp(camera.position.x, target.x, 5, dt)
        camera.position.y = MathUtils.damp(camera.position.y, target.y + sway * 0.4, 5, dt)
        camera.position.z = MathUtils.damp(camera.position.z, target.z, 5, dt)
      }
    } else {
      camera.position.set(
        p.x + bobX * Math.cos(runtime.player.yaw),
        p.y + PLAYER.eyeOffset + bobY + sway + idleSway,
        p.z + bobX * -Math.sin(runtime.player.yaw),
      )
    }
    euler.set(runtime.player.pitch, runtime.player.yaw, 0)
    camera.quaternion.setFromEuler(euler)
    const fovTarget = g.telescope ? 26 : s.graphics.fov
    const persp = camera as { fov?: number; updateProjectionMatrix?: () => void }
    if (persp.fov !== undefined && Math.abs(persp.fov - fovTarget) > 0.01) {
      persp.fov = reduced && g.telescope ? fovTarget : MathUtils.damp(persp.fov, fovTarget, 6, dt)
      persp.updateProjectionMatrix?.()
    }
  })

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[HOME_SPAWN.x, HOME_SPAWN.y + CAPSULE_CENTER_Y + 0.1, HOME_SPAWN.z]}
      enabledRotations={[false, false, false]}
      userData={{ player: true }}
      ccd
    >
      <CapsuleCollider args={[PLAYER.capsuleHalfHeight, PLAYER.capsuleRadius]} />
    </RigidBody>
  )
}
