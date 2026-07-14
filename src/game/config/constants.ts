/** World-scale constants. One Three.js unit ≈ one meter. */
export const WORLD = {
  /** Extent of the walkable shell along the travel axis (z). */
  shellLength: 500,
  /** Extent of the walkable shell laterally (x). */
  shellWidth: 340,
  /** Sea surface height. */
  oceanLevel: 0,
  /** Height of the shell rim deck above the water. */
  rimHeight: 9,
  /** Apparent forward travel speed of the turtle, m/s. */
  travelSpeed: 2.4,
  /** Full day/night cycle length in real seconds (default 24 minutes). */
  dayLengthSec: 24 * 60,
  gravity: -16,
  /** Player falls below this → gentle respawn. */
  drownY: -2.5,
} as const

export const PLAYER = {
  walkSpeed: 3.2,
  jogSpeed: 5.0,
  accel: 16,
  airControl: 0.3,
  jumpSpeed: 5.4,
  capsuleRadius: 0.35,
  capsuleHalfHeight: 0.6, // cylinder part; full height = 2*(hh + r) = 1.9m
  eyeOffset: 0.72, // from capsule center → eye ≈ 1.67m above feet
  interactDistance: 3.1,
  interactConeDeg: 22,
  stepHeight: 0.45,
  maxSlopeDeg: 50,
  fovDefault: 72,
} as const

/** Where the player wakes up (just outside the home's front door, on its pad). */
export const HOME_SPAWN = { x: -56, y: 12.75, z: -126, yaw: 2.4 } as const

export const SAVE_KEYS = {
  settings: 'turtleback:settings',
  media: 'turtleback:media',
  journal: 'turtleback:journal',
  session: 'turtleback:session',
} as const
