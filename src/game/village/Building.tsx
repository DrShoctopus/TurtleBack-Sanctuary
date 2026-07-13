import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import {
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Vector3,
} from 'three'
import type { BuildingSpec } from '../config/layout'
import { runtime } from '../core/runtime'
import { events } from '../core/events'
import { useGame } from '../state/gameStore'
import { useSettings } from '../state/settingsStore'
import { registerInteraction, type InteractionDef } from '../interaction/InteractionSystem'
import { sitAt } from '../activities/sitting'
import { exteriorVillageMaterials, villageMaterials, makeWindowGlowMaterial } from './kit/materials'
import { INTERIORS, type BuiltInterior, type InteractionSpec } from './buildings/interiors'
import { registerZone } from './zones'
import { generateArtwork } from './artworks'
import { boxGeo } from './kit/geometry'
import {
  openTv,
  openMusic,
  openJournal,
  openReading,
  previewMusic,
  waterPlants,
  browseGoods,
  brewDrink,
  cycleBlinds,
  sleepUntilDawn,
  ringChime,
} from '../activities/handlers'
import { mediaPlayer } from '../media/MediaPlayer'
import type { DecorTheme } from '../state/settingsStore'

/** One placed building: merged static meshes + colliders + dynamic pieces. */
export function Building({ spec }: { spec: BuildingSpec }) {
  const built: BuiltInterior = useMemo(() => INTERIORS[spec.kind](spec), [spec])
  const merged = useMemo(() => built.plan.merge(), [built])
  const exteriorMerged = useMemo(() => built.exterior.merge(), [built])
  const glowMerged = useMemo(() => built.glow.merge(), [built])
  const mats = villageMaterials()
  const exteriorMats = exteriorVillageMaterials()
  const glowMat = useMemo(() => makeWindowGlowMaterial(), [])
  const [lampsOn, setLampsOn] = useState<boolean | null>(null) // null → follow night
  const lightRefs = useRef<Array<PointLight | null>>([])
  const groupRef = useRef<Group>(null)
  const cos = Math.cos(spec.yaw)
  const sin = Math.sin(spec.yaw)

  // world transform helper (building local → world)
  const toWorld = useMemo(
    () =>
      (l: [number, number, number]): [number, number, number] => [
        spec.x + l[0] * cos + l[2] * sin,
        spec.padH + l[1],
        spec.z - l[0] * sin + l[2] * cos,
      ],
    [spec, cos, sin],
  )

  // interactions + zone registration
  useEffect(() => {
    const unsubs: Array<() => void> = []
    const isHome = spec.id === 'home'
    for (const i of built.extras.interactions) {
      const def = interactionToDef(i, spec, toWorld, {
        isHome,
        lampsToggle: () =>
          setLampsOn((v) => (v === null ? runtime.time.celest.nightFactor < 0.4 : !v)),
      })
      if (def) unsubs.push(registerInteraction(def))
    }
    if (built.extras.interior.cy > -50) {
      unsubs.push(
        registerZone({
          id: spec.id,
          name: spec.name,
          cx: spec.x,
          cy: spec.padH + built.extras.interior.cy,
          cz: spec.z,
          halfX: built.extras.interior.halfX,
          halfY: built.extras.interior.halfY,
          halfZ: built.extras.interior.halfZ,
          rotY: spec.yaw,
          flavor: built.extras.flavor,
        }),
      )
    }
    // the home stereo anchors the "room speaker" position
    if (spec.id === 'home') {
      const stereo = built.extras.interactions.find((i) => i.kind === 'stereo')
      if (stereo) {
        const [wx, wy, wz] = toWorld(stereo.pos)
        mediaPlayer.setRoomPosition(wx, wy, wz)
      }
    }
    return () => unsubs.forEach((fn) => fn())
  }, [built, spec, toWorld])

  // apply room/personal speaker mode from settings (home only owns the stereo)
  const speakerMode = useSettings((s) => s.home.speakerMode)
  const homeBlinds = useSettings((s) => s.home.blinds)
  const homeTheme = useSettings((s) => s.home.theme)
  const teaPhase = useGame((s) => s.teaPhase)
  const brewInteraction = built.extras.interactions.find((interaction) =>
    ['tea', 'coffee'].includes(interaction.kind),
  )
  useEffect(() => {
    if (spec.id === 'home') mediaPlayer.setSpeakerMode(speakerMode)
  }, [speakerMode, spec.id])

  // per-frame: window glow + interior light react to night/lamps/daylight
  useFrame(() => {
    const night = runtime.time.celest.nightFactor
    const dusk = runtime.time.celest.duskFactor
    const day = 1 - night
    const lampsResolved = lampsOn ?? (night > 0.12 || dusk > 0.55)
    const warmth = spec.id === 'home' ? useSettings.getState().home.warmth : 0.55

    // window glow: opacity + emissive rise only at night/when lit (invisible by day)
    const glowTarget = lampsResolved ? 0.85 : 0
    glowMat.opacity += (glowTarget - glowMat.opacity) * 0.05
    const emTarget = lampsResolved ? 1.4 + night * 1.4 : 0
    glowMat.emissiveIntensity += (emTarget - glowMat.emissiveIntensity) * 0.05
    glowMat.emissive.setHSL(0.075 + warmth * 0.035, 0.72, 0.55 + warmth * 0.12)

    const p = runtime.player.pos
    const dx = p.x - spec.x
    const dz = p.z - spec.z
    const near = dx * dx + dz * dz < 40 * 40
    // daylight spills through the windows; lamps add warm light at night
    const dayFill = day * 0.55
    const lampFill = lampsResolved ? 0.4 + night * 0.7 : 0
    const total = dayFill + lampFill
    const warmMix = total > 0.001 ? lampFill / total : 0
    for (let i = 0; i < lightRefs.current.length; i++) {
      const light = lightRefs.current[i]
      if (!light) continue
      const base = built.extras.lights[i]?.intensity ?? 10
      light.visible = near && total > 0.02
      light.intensity = base * total
      light.color.setRGB(0.82 + warmMix * 0.18, 0.88 - warmMix * 0.02, 1 - warmMix * 0.32)
    }
  })

  return (
    <group ref={groupRef} position={[spec.x, spec.padH, spec.z]} rotation={[0, spec.yaw, 0]}>
      <RigidBody type="fixed" colliders={false}>
        {built.plan.colliders.map((c, i) => (
          <CuboidCollider
            key={i}
            args={[c.size[0] / 2, c.size[1] / 2, c.size[2] / 2]}
            position={c.pos}
            rotation={c.rot ?? [0, c.rotY ?? 0, 0]}
          />
        ))}
        {built.exterior.colliders.map((c, i) => (
          <CuboidCollider
            key={`exterior-${i}`}
            args={[c.size[0] / 2, c.size[1] / 2, c.size[2] / 2]}
            position={c.pos}
            rotation={c.rot ?? [0, c.rotY ?? 0, 0]}
          />
        ))}
      </RigidBody>
      {merged.map(({ mat, geometry }) => (
        <mesh
          key={`interior-${mat}`}
          geometry={geometry}
          material={(built.extras.openAir ? exteriorMats : mats).get(mat)!}
          castShadow={mat !== 'glass'}
          receiveShadow
        />
      ))}
      {exteriorMerged.map(({ mat, geometry }) => (
        <mesh
          key={`exterior-${mat}`}
          geometry={geometry}
          material={exteriorMats.get(mat)!}
          castShadow={mat !== 'glass'}
          receiveShadow
        />
      ))}
      {glowMerged.map(({ geometry }, i) => (
        <mesh key={`glow${i}`} geometry={geometry} material={glowMat} />
      ))}
      {built.extras.door && <SlidingDoor spec={spec} door={built.extras.door} />}
      {built.extras.lampShades.map((l, i) => (
        <LampShade key={i} pos={l.pos} r={l.r ?? 0.19} lampsOn={lampsOn} />
      ))}
      {built.extras.artworks.map((a, i) => (
        <Artwork key={i} pos={a.pos} rotY={a.rotY} w={a.w} h={a.h} index={i} buildingId={spec.id} />
      ))}
      {built.extras.tvScreen && <TvScreen screen={built.extras.tvScreen} />}
      {brewInteraction && (
        <BrewSteam
          pos={[brewInteraction.pos[0], brewInteraction.pos[1] + 0.22, brewInteraction.pos[2]]}
          active={teaPhase === 'brewing' || teaPhase === 'ready'}
        />
      )}
      {built.extras.interactions
        .filter((interaction) => interaction.kind === 'water' || interaction.kind === 'chime')
        .map((interaction) => (
          <InteractionBurst
            key={`effect-${interaction.id}`}
            source={`${spec.id}:${interaction.id}`}
            kind={interaction.kind as 'water' | 'chime'}
            pos={interaction.pos}
          />
        ))}
      {spec.id === 'home' && <HomeDecor blinds={homeBlinds} theme={homeTheme} />}
      {built.extras.poolWaters.map((w, i) => (
        <mesh key={`pool${i}`} position={w.pos} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w.w, w.d]} />
          <meshStandardMaterial color="#5aa3b4" transparent opacity={0.75} roughness={0.1} />
        </mesh>
      ))}
      {built.extras.lights.map((ls, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lightRefs.current[i] = el
          }}
          position={ls.pos}
          color={ls.color ?? '#ffd9ae'}
          intensity={0}
          distance={24}
          decay={1.4}
          castShadow={false}
        />
      ))}
    </group>
  )
}

const HOME_WINDOWS = [
  { pos: [0.6, 4.09] as const, axis: 'z' as const, w: 2.6, h: 1.7, sill: 0.75 },
  { pos: [3.6, 4.09] as const, axis: 'z' as const, w: 1.8, h: 1.7, sill: 0.75 },
  { pos: [2.8, -4.09] as const, axis: 'z' as const, w: 2.8, h: 1.7, sill: 0.75 },
  { pos: [-2.4, -4.09] as const, axis: 'z' as const, w: 1.6, h: 1.3, sill: 1.0 },
  { pos: [5.59, 0.5] as const, axis: 'x' as const, w: 2.6, h: 1.8, sill: 0.7 },
  { pos: [-5.59, 1.5] as const, axis: 'x' as const, w: 1.6, h: 1.3, sill: 0.95 },
]

function HomeDecor({ blinds, theme }: { blinds: number; theme: DecorTheme }) {
  const blindRefs = useRef<Array<Mesh | null>>([])
  const animatedBlinds = useRef(blinds)
  const accent = theme === 'tidepool' ? '#4f8f91' : theme === 'dune' ? '#c39b69' : '#8a7462'
  useFrame((_, dt) => {
    animatedBlinds.current +=
      (blinds - animatedBlinds.current) * Math.min(1, dt * (runtime.reducedMotion ? 12 : 4.5))
    HOME_WINDOWS.forEach((window, index) => {
      const mesh = blindRefs.current[index]
      if (!mesh) return
      const coverage = Math.max(0.07, window.h * animatedBlinds.current)
      mesh.scale.y = coverage / window.h
      mesh.position.y = 0.14 + window.sill + window.h - coverage / 2
    })
  })
  return (
    <group>
      {HOME_WINDOWS.map((window, index) => {
        const coverage = Math.max(0.07, window.h * animatedBlinds.current)
        const y = 0.14 + window.sill + window.h - coverage / 2
        const size: [number, number, number] =
          window.axis === 'z'
            ? [window.w - 0.08, window.h, 0.025]
            : [0.025, window.h, window.w - 0.08]
        return (
          <mesh
            key={index}
            ref={(mesh) => {
              blindRefs.current[index] = mesh
            }}
            position={[window.pos[0], y, window.pos[1]]}
            scale={[1, coverage / window.h, 1]}
          >
            <boxGeometry args={size} />
            <meshStandardMaterial color={accent} roughness={0.96} />
          </mesh>
        )
      })}
      <mesh position={[2.6, 0.045, 0.6]} rotation={[0, 0, 0]} scale={[1.75, 1, 1.3]}>
        <cylinderGeometry args={[1, 1, 0.018, 40]} />
        <meshStandardMaterial color={accent} roughness={0.98} />
      </mesh>
    </group>
  )
}

function TvScreen({ screen }: { screen: NonNullable<BuiltInterior['extras']['tvScreen']> }) {
  const active = useGame((state) => state.overlay === 'tv')
  const screenMat = useRef<MeshStandardMaterial>(null)
  useFrame((_, dt) => {
    const material = screenMat.current
    if (!material) return
    const target = active ? 0.9 : 0.22
    material.emissiveIntensity += (target - material.emissiveIntensity) * Math.min(1, dt * 5)
  })
  return (
    <group position={screen.pos} rotation={[0, screen.rotY, 0]}>
      <mesh position={[0, 0, -0.012]}>
        <boxGeometry args={[screen.w + 0.09, screen.h + 0.09, 0.06]} />
        <meshStandardMaterial color="#202930" metalness={0.48} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0, 0.018]}>
        <planeGeometry args={[screen.w, screen.h]} />
        <meshStandardMaterial
          ref={screenMat}
          color="#071019"
          emissive="#0a2530"
          emissiveIntensity={0.22}
          roughness={0.18}
        />
      </mesh>
      <mesh position={[0, 0, 0.026]} scale={[0.88, 0.78, 1]}>
        <ringGeometry args={[0.055, 0.075, 32]} />
        <meshBasicMaterial color="#7dc7c3" transparent opacity={0.32} />
      </mesh>
      <mesh position={[0, -0.71, -0.015]}>
        <boxGeometry args={[0.12, 0.48, 0.08]} />
        <meshStandardMaterial color="#313940" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.93, -0.015]}>
        <boxGeometry args={[0.72, 0.05, 0.3]} />
        <meshStandardMaterial color="#313940" metalness={0.55} roughness={0.4} />
      </mesh>
    </group>
  )
}

function BrewSteam({ pos, active }: { pos: [number, number, number]; active: boolean }) {
  const groupRef = useRef<Group>(null)
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#eef6f2',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  )
  const phase = useRef(0)
  useEffect(() => () => material.dispose(), [material])
  useFrame((_, dt) => {
    const group = groupRef.current
    phase.current += dt * (runtime.reducedMotion ? 0.25 : 1)
    material.opacity += ((active ? 0.24 : 0) - material.opacity) * Math.min(1, dt * 5)
    if (!group) return
    group.visible = material.opacity > 0.005
    group.children.forEach((child, index) => {
      const t = (phase.current * 0.22 + index / group.children.length) % 1
      child.position.set(Math.sin(t * 7 + index) * 0.08, t * 0.72, Math.cos(t * 5 + index) * 0.05)
      child.scale.setScalar(0.45 + t * 0.9)
    })
  })
  return (
    <group ref={groupRef} position={pos}>
      {Array.from({ length: 6 }, (_, index) => (
        <mesh key={index} material={material}>
          <sphereGeometry args={[0.06, 8, 6]} />
        </mesh>
      ))}
    </group>
  )
}

function InteractionBurst({
  source,
  kind,
  pos,
}: {
  source: string
  kind: 'water' | 'chime'
  pos: [number, number, number]
}) {
  const groupRef = useRef<Group>(null)
  const life = useRef(0)
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: kind === 'water' ? '#a8ddea' : '#f6d89b',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [kind],
  )
  useEffect(() => {
    const unsubscribe = events.on('worldEffect', (effect) => {
      if (effect.kind === kind && effect.source === source) life.current = 1
    })
    return () => {
      unsubscribe()
      material.dispose()
    }
  }, [kind, material, source])
  useFrame((_, dt) => {
    const group = groupRef.current
    life.current = Math.max(0, life.current - dt * (runtime.reducedMotion ? 1.8 : 0.85))
    material.opacity = life.current * 0.42
    if (!group) return
    group.visible = life.current > 0.005
    const progress = 1 - life.current
    group.rotation.y = progress * 0.8
    group.scale.setScalar(0.75 + progress * 1.35)
    group.position.y = pos[1] + (kind === 'water' ? progress * 0.35 : 0)
  })
  return (
    <group ref={groupRef} position={pos}>
      {kind === 'water' ? (
        Array.from({ length: 8 }, (_, index) => (
          <mesh
            key={index}
            material={material}
            position={[
              Math.cos((index / 8) * Math.PI * 2) * 0.42,
              0.22 + (index % 3) * 0.12,
              Math.sin((index / 8) * Math.PI * 2) * 0.42,
            ]}
          >
            <sphereGeometry args={[0.045, 7, 5]} />
          </mesh>
        ))
      ) : (
        <mesh material={material} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.38, 0.025, 8, 28]} />
        </mesh>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------

function interactionToDef(
  i: InteractionSpec,
  spec: BuildingSpec,
  toWorld: (l: [number, number, number]) => [number, number, number],
  ctx: { isHome: boolean; lampsToggle: () => void },
): InteractionDef | null {
  const id = `${spec.id}:${i.id}`
  const pos = toWorld(i.pos)
  const yawWorld = (localYaw: number) => localYaw + spec.yaw

  switch (i.kind) {
    case 'sit': {
      const seat = i.seat!
      const eye = toWorld(seat.eye)
      const stand = toWorld(seat.stand)
      return {
        id,
        label: i.label ?? 'Sit down',
        position: pos,
        radius: i.radius ?? 2.6,
        onUse: () =>
          sitAt({
            eye: new Vector3(...eye),
            stand: new Vector3(...stand),
            yaw: yawWorld(seat.yaw),
            listen: seat.listen,
          }),
      }
    }
    case 'lamp':
      return {
        id,
        label: i.label ?? 'Toggle the lights',
        position: pos,
        radius: i.radius,
        onUse: () => {
          ctx.lampsToggle()
          events.emit('interactSound', { kind: 'lamp' })
        },
      }
    case 'tea':
    case 'coffee':
      return {
        id,
        label: () => brewDrink.label(i.kind as 'tea' | 'coffee'),
        position: pos,
        radius: i.radius,
        onUse: () => brewDrink.use(i.kind as 'tea' | 'coffee'),
      }
    case 'tv':
      return { id, label: 'Watch the television', position: pos, radius: i.radius, onUse: openTv }
    case 'stereo':
      return {
        id,
        label: 'Open the music player',
        position: pos,
        radius: i.radius,
        onUse: openMusic,
      }
    case 'journal':
      return {
        id,
        label: i.label ?? 'Write in the journal',
        position: pos,
        radius: i.radius,
        onUse: openJournal,
      }
    case 'book':
      return { id, label: 'Browse the books', position: pos, radius: i.radius, onUse: openReading }
    case 'listen':
      return { id, label: 'Play a sample', position: pos, radius: i.radius, onUse: previewMusic }
    case 'water':
      return {
        id,
        label: i.label ?? 'Water the plants',
        position: pos,
        radius: i.radius,
        onUse: () => waterPlants(id),
      }
    case 'artLight':
      return {
        id,
        label: 'Adjust the gallery lights',
        position: pos,
        radius: i.radius,
        onUse: ctx.lampsToggle,
      }
    case 'breath':
      return {
        id,
        label: 'Begin a breathing session',
        position: pos,
        radius: i.radius,
        onUse: () => useGame.getState().setBreathing(true),
      }
    case 'telescope':
      return {
        id,
        label: 'Look through the telescope',
        position: pos,
        radius: i.radius,
        onUse: () => useGame.getState().setTelescope(true),
      }
    case 'chime':
      return {
        id,
        label: 'Brush the wind chimes',
        position: pos,
        radius: i.radius,
        onUse: () => ringChime(id),
      }
    case 'blinds':
      return {
        id,
        label: () => cycleBlinds.label(),
        position: pos,
        radius: i.radius,
        onUse: cycleBlinds.use,
      }
    case 'goods':
      return {
        id,
        label: i.label ?? 'Browse the shelves',
        position: pos,
        radius: i.radius,
        onUse: browseGoods,
      }
    case 'sleep':
      return {
        id,
        label: 'Rest until dawn',
        position: pos,
        radius: i.radius,
        onUse: sleepUntilDawn,
      }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------

function SlidingDoor({
  spec,
  door,
}: {
  spec: BuildingSpec
  door: NonNullable<BuiltInterior['extras']['door']>
}) {
  const leftRef = useRef<Mesh>(null)
  const rightRef = useRef<Mesh>(null)
  const open = useRef(0)
  const mats = villageMaterials()
  const worldPos = useMemo(() => {
    const cos = Math.cos(spec.yaw)
    const sin = Math.sin(spec.yaw)
    return new Vector3(
      spec.x + door.pos[0] * cos + door.pos[2] * sin,
      spec.padH + door.pos[1],
      spec.z - door.pos[0] * sin + door.pos[2] * cos,
    )
  }, [spec, door])

  useFrame((_, dt) => {
    const p = runtime.player.pos
    const dist = Math.hypot(p.x - worldPos.x, p.z - worldPos.z)
    const target = dist < 2.6 ? 1 : 0
    open.current += (target - open.current) * Math.min(1, dt * 5)
    const slide = (door.width / 2) * 0.96 * open.current
    if (leftRef.current) leftRef.current.position.x = door.pos[0] - door.width / 4 - slide
    if (rightRef.current) rightRef.current.position.x = door.pos[0] + door.width / 4 + slide
  })

  const panelW = door.width / 2
  // all doors sit on the front (+z) wall, so sliding is along local x
  return (
    <group>
      {/* panels are children of the building group; local x along the door wall */}
      <mesh
        ref={leftRef}
        position={[door.pos[0] - panelW / 2, door.pos[1] + door.height / 2, door.pos[2]]}
        material={mats.get('glass')!}
        geometry={boxGeo()}
        scale={[panelW, door.height, 0.05]}
      />
      <mesh
        ref={rightRef}
        position={[door.pos[0] + panelW / 2, door.pos[1] + door.height / 2, door.pos[2]]}
        material={mats.get('glass')!}
        geometry={boxGeo()}
        scale={[panelW, door.height, 0.05]}
      />
    </group>
  )
}

// ---------------------------------------------------------------------------

function LampShade({
  pos,
  r,
  lampsOn,
}: {
  pos: [number, number, number]
  r: number
  lampsOn: boolean | null
}) {
  const matRef = useRef<MeshStandardMaterial>(null)
  useFrame(() => {
    const m = matRef.current
    if (!m) return
    const night = runtime.time.celest.nightFactor
    const on = lampsOn ?? night > 0.12
    const target = on ? 1.6 : 0.05
    m.emissiveIntensity += (target - m.emissiveIntensity) * 0.05
  })
  return (
    <mesh position={pos}>
      <sphereGeometry args={[r, 14, 10]} />
      <meshStandardMaterial
        ref={matRef}
        color="#f6ead2"
        emissive={new Color('#ffd9a0')}
        emissiveIntensity={0}
        roughness={0.9}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------

function Artwork({
  pos,
  rotY,
  w,
  h,
  index,
  buildingId,
}: {
  pos: [number, number, number]
  rotY: number
  w: number
  h: number
  index: number
  buildingId: string
}) {
  const homeArt = useSettings((s) => s.home.artwork)
  const seed =
    buildingId === 'home' ? 1000 + homeArt * 7 + index : index * 131 + buildingId.length * 17
  const texture: CanvasTexture = useMemo(() => generateArtwork(seed), [seed])
  useEffect(() => () => texture.dispose(), [texture])
  const mat = useMemo(() => new MeshBasicMaterial({ map: texture }), [texture])
  useFrame(() => {
    // artworks dim softly at night unless the room lights are on
    const night = runtime.time.celest.nightFactor
    mat.color.setScalar(1 - night * 0.45)
  })
  return (
    <mesh position={pos} rotation={[0, rotY, 0]} material={mat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}
