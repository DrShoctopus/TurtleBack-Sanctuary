import { PATHS, TRAVERSAL_SPANS } from '../../config/layout'

export const SHOWCASE_DISTRICT_IDS = [
  'plaza',
  'market',
  'gardens',
  'residential',
  'arts',
  'wellness',
  'observatory',
] as const

export type ShowcaseDistrictId = (typeof SHOWCASE_DISTRICT_IDS)[number]

export type StoryClusterKind =
  | 'welcome-board'
  | 'fountain-care'
  | 'commons-gathering'
  | 'produce-stall'
  | 'delivery-cart'
  | 'tea-drying'
  | 'potting-bench'
  | 'seed-cache'
  | 'garden-shrine'
  | 'laundry-line'
  | 'firewood-rack'
  | 'reading-nook'
  | 'sculptor-yard'
  | 'gallery-install'
  | 'chime-garden'
  | 'herb-drying'
  | 'bath-baskets'
  | 'tea-cart'
  | 'survey-cart'
  | 'star-shrine'
  | 'lantern-watch'

export interface VillageStoryCluster {
  readonly id: string
  readonly district: ShowcaseDistrictId
  readonly kind: StoryClusterKind
  readonly x: number
  readonly z: number
  readonly yaw: number
  /** Conservative horizontal footprint used by vegetation and route masks. */
  readonly radius: number
  readonly purpose: string
}

export interface VillageAnchor {
  readonly id: string
  readonly district: ShowcaseDistrictId
  readonly label: string
  readonly x: number
  readonly z: number
  readonly role: 'threshold' | 'destination' | 'landmark'
}

/**
 * Authored anchors describe the three-beat read of each district. They refer
 * to visible structures or story clusters rather than invisible map labels.
 */
export const VILLAGE_ANCHORS: readonly VillageAnchor[] = Object.freeze([
  {
    id: 'plaza.south-gate',
    district: 'plaza',
    label: 'Cedar welcome gate',
    x: 0,
    z: -62,
    role: 'threshold',
  },
  {
    id: 'plaza.fountain',
    district: 'plaza',
    label: 'Spring fountain court',
    x: 0,
    z: -40,
    role: 'landmark',
  },
  {
    id: 'plaza.commons',
    district: 'plaza',
    label: 'Commons gathering edge',
    x: -9,
    z: -18,
    role: 'destination',
  },
  {
    id: 'market.cafe',
    district: 'market',
    label: 'Driftwood cafe awning',
    x: 31,
    z: -45,
    role: 'destination',
  },
  {
    id: 'market.cart',
    district: 'market',
    label: 'Shorelight delivery cart',
    x: 58,
    z: 4,
    role: 'landmark',
  },
  {
    id: 'market.north-sign',
    district: 'market',
    label: 'Market lane signpost',
    x: 59,
    z: -1,
    role: 'threshold',
  },
  {
    id: 'gardens.threshold',
    district: 'gardens',
    label: 'Greenhouse garden gate',
    x: -44,
    z: 53,
    role: 'threshold',
  },
  {
    id: 'gardens.pond',
    district: 'gardens',
    label: 'Chime pond bridge',
    x: -52,
    z: 80,
    role: 'landmark',
  },
  {
    id: 'gardens.potting',
    district: 'gardens',
    label: 'Community potting yard',
    x: -72,
    z: 84,
    role: 'destination',
  },
  {
    id: 'residential.gate',
    district: 'residential',
    label: 'Quiet Path gate',
    x: -78,
    z: -42,
    role: 'threshold',
  },
  {
    id: 'residential.hearth',
    district: 'residential',
    label: 'Shared wood shelter',
    x: -110,
    z: -18,
    role: 'landmark',
  },
  {
    id: 'residential.reading',
    district: 'residential',
    label: 'Cottage reading nook',
    x: -108,
    z: 12,
    role: 'destination',
  },
  {
    id: 'arts.threshold',
    district: 'arts',
    label: 'Arts walk gate',
    x: 57,
    z: 25,
    role: 'threshold',
  },
  {
    id: 'arts.sculpture',
    district: 'arts',
    label: 'Three-spire sculpture',
    x: 84,
    z: 50,
    role: 'landmark',
  },
  {
    id: 'arts.gallery',
    district: 'arts',
    label: 'Meridian install yard',
    x: 104,
    z: 49,
    role: 'destination',
  },
  {
    id: 'wellness.threshold',
    district: 'wellness',
    label: 'Warm Springs gate',
    x: -30,
    z: 103,
    role: 'threshold',
  },
  {
    id: 'wellness.herbs',
    district: 'wellness',
    label: 'Bathhouse herb arbor',
    x: -26,
    z: 120,
    role: 'landmark',
  },
  {
    id: 'wellness.tea',
    district: 'wellness',
    label: 'Quiet tea cart',
    x: -49,
    z: 132,
    role: 'destination',
  },
  {
    id: 'observatory.threshold',
    district: 'observatory',
    label: 'Stargazer ascent gate',
    x: 2,
    z: 159,
    role: 'threshold',
  },
  {
    id: 'observatory.survey',
    district: 'observatory',
    label: 'Survey supply cart',
    x: 10,
    z: 181,
    role: 'landmark',
  },
  {
    id: 'observatory.dome',
    district: 'observatory',
    label: 'Stargazer dome',
    x: 12,
    z: 194,
    role: 'destination',
  },
])

/**
 * Each placement is a small, readable vignette. Four per district gives the
 * route enough density while leaving calm gaps between authored beats.
 */
export const VILLAGE_STORY_CLUSTERS: readonly VillageStoryCluster[] = Object.freeze([
  {
    id: 'plaza.welcome',
    district: 'plaza',
    kind: 'welcome-board',
    x: -8.6,
    z: -58.5,
    yaw: 0.18,
    radius: 2.2,
    purpose: 'Introduces the village and frames the arrival path.',
  },
  {
    id: 'plaza.fountain-care',
    district: 'plaza',
    kind: 'fountain-care',
    x: 8.8,
    z: -38.8,
    yaw: -1.25,
    radius: 2.0,
    purpose: 'Suggests that the spring court is actively tended.',
  },
  {
    id: 'plaza.commons',
    district: 'plaza',
    kind: 'commons-gathering',
    x: -10.5,
    z: -23.5,
    yaw: 0.55,
    radius: 2.5,
    purpose: 'Creates a social edge between the fountain and pavilion.',
  },
  {
    id: 'plaza.lantern-watch',
    district: 'plaza',
    kind: 'lantern-watch',
    x: 12.5,
    z: -54.5,
    yaw: -0.3,
    radius: 1.8,
    purpose: 'Marks the evening route without narrowing it.',
  },

  {
    id: 'market.produce',
    district: 'market',
    kind: 'produce-stall',
    x: 29,
    z: -31,
    yaw: 0.28,
    radius: 2.3,
    purpose: 'Gives the lane a daily food-trade function.',
  },
  {
    id: 'market.delivery',
    district: 'market',
    kind: 'delivery-cart',
    x: 58,
    z: 4,
    yaw: -0.38,
    radius: 2.4,
    purpose: 'Connects the store to shell-edge supply routes.',
  },
  {
    id: 'market.tea',
    district: 'market',
    kind: 'tea-drying',
    x: 53.5,
    z: -41.5,
    yaw: 1.08,
    radius: 2.15,
    purpose: 'Adds a fragrant craft beat beside the cafe.',
  },
  {
    id: 'market.sign',
    district: 'market',
    kind: 'welcome-board',
    x: 59.5,
    z: -1,
    yaw: -0.9,
    radius: 1.75,
    purpose: 'Closes the loop with a visible wayfinding marker.',
  },

  {
    id: 'gardens.potting',
    district: 'gardens',
    kind: 'potting-bench',
    x: -76,
    z: 72,
    yaw: 0.18,
    radius: 2.5,
    purpose: 'Makes greenhouse cultivation legible at a glance.',
  },
  {
    id: 'gardens.seeds',
    district: 'gardens',
    kind: 'seed-cache',
    x: -70.5,
    z: 94,
    yaw: -0.2,
    radius: 2.1,
    purpose: 'Stores baskets, labels, and young plants beside the beds.',
  },
  {
    id: 'gardens.shrine',
    district: 'gardens',
    kind: 'garden-shrine',
    x: -61.5,
    z: 102.5,
    yaw: 0.6,
    radius: 2.2,
    purpose: 'Creates a quiet gratitude place beyond the working beds.',
  },
  {
    id: 'gardens.chimes',
    district: 'gardens',
    kind: 'chime-garden',
    x: -42.5,
    z: 94.5,
    yaw: -0.4,
    radius: 2.0,
    purpose: 'Carries the pond threshold into the bathhouse path.',
  },

  {
    id: 'residential.laundry',
    district: 'residential',
    kind: 'laundry-line',
    x: -111,
    z: -31,
    yaw: 0.14,
    radius: 2.7,
    purpose: 'Shows calm domestic routine between cottages.',
  },
  {
    id: 'residential.firewood',
    district: 'residential',
    kind: 'firewood-rack',
    x: -111.5,
    z: -18,
    yaw: 1.42,
    radius: 2.1,
    purpose: 'Creates a shared practical resource for the lane.',
  },
  {
    id: 'residential.reading',
    district: 'residential',
    kind: 'reading-nook',
    x: -109,
    z: 12,
    yaw: -1.5,
    radius: 2.2,
    purpose: 'Gives the quiet path its defining restful vignette.',
  },
  {
    id: 'residential.garden',
    district: 'residential',
    kind: 'garden-shrine',
    x: -101,
    z: 38,
    yaw: 1.3,
    radius: 2.0,
    purpose: 'Softens the cottage-to-greenhouse transition.',
  },

  {
    id: 'arts.sculptor',
    district: 'arts',
    kind: 'sculptor-yard',
    x: 72,
    z: 28,
    yaw: -0.72,
    radius: 2.5,
    purpose: 'Shows work in progress before the finished sculpture walk.',
  },
  {
    id: 'arts.install',
    district: 'arts',
    kind: 'gallery-install',
    x: 105,
    z: 48,
    yaw: -0.5,
    radius: 2.4,
    purpose: 'Suggests a changing outdoor exhibition.',
  },
  {
    id: 'arts.chimes',
    district: 'arts',
    kind: 'chime-garden',
    x: 92,
    z: 72,
    yaw: 0.35,
    radius: 2.0,
    purpose: 'Adds sound and motion near the gallery garden.',
  },
  {
    id: 'arts.lanterns',
    district: 'arts',
    kind: 'lantern-watch',
    x: 118,
    z: 68,
    yaw: -0.2,
    radius: 1.9,
    purpose: 'Guides visitors from the gallery to the east horizon deck.',
  },

  {
    id: 'wellness.herbs',
    district: 'wellness',
    kind: 'herb-drying',
    x: -26,
    z: 120,
    yaw: -0.2,
    radius: 2.4,
    purpose: 'Connects the bathhouse to its botanical remedies.',
  },
  {
    id: 'wellness.baskets',
    district: 'wellness',
    kind: 'bath-baskets',
    x: -48,
    z: 112,
    yaw: 0.72,
    radius: 2.0,
    purpose: 'Creates a cared-for arrival at the bathhouse steps.',
  },
  {
    id: 'wellness.tea',
    district: 'wellness',
    kind: 'tea-cart',
    x: -50,
    z: 132,
    yaw: 0.45,
    radius: 2.2,
    purpose: 'Provides a calm pause after the warm springs.',
  },
  {
    id: 'wellness.shrine',
    district: 'wellness',
    kind: 'garden-shrine',
    x: -29,
    z: 142,
    yaw: -0.45,
    radius: 2.0,
    purpose: 'Marks the transition toward Observatory Ridge.',
  },

  {
    id: 'observatory.survey',
    district: 'observatory',
    kind: 'survey-cart',
    x: 10.5,
    z: 181,
    yaw: 0.4,
    radius: 2.3,
    purpose: 'Makes the dome feel like a working observatory.',
  },
  {
    id: 'observatory.shrine',
    district: 'observatory',
    kind: 'star-shrine',
    x: -8.5,
    z: 184,
    yaw: -0.3,
    radius: 2.1,
    purpose: 'Creates a contemplative counterpoint to scientific tools.',
  },
  {
    id: 'observatory.lanterns',
    district: 'observatory',
    kind: 'lantern-watch',
    x: 19.5,
    z: 175.5,
    yaw: 0.2,
    radius: 1.9,
    purpose: 'Frames the final approach at night.',
  },
  {
    id: 'observatory.supplies',
    district: 'observatory',
    kind: 'gallery-install',
    x: 23.5,
    z: 195,
    yaw: 1.2,
    radius: 2.1,
    purpose: 'Suggests regular maintenance of the ancient dome.',
  },
])

export interface VillageClearanceMask {
  readonly id: string
  readonly x: number
  readonly z: number
  readonly radius: number
  readonly kind: 'spawn' | 'interaction' | 'traversal'
}

/** Critical clear areas stay shared between tests, prop validation, and scatter. */
export const VILLAGE_NAVIGATION_CLEARANCES: readonly VillageClearanceMask[] = Object.freeze([
  { id: 'arrival-spawn', x: 0, z: -202, radius: 5.5, kind: 'spawn' },
  { id: 'plaza-fountain', x: 0, z: -40, radius: 6.2, kind: 'interaction' },
  { id: 'garden-chime', x: -58, z: 56, radius: 3.0, kind: 'interaction' },
  { id: 'garden-pond', x: -52, z: 80, radius: 7.2, kind: 'traversal' },
  ...TRAVERSAL_SPANS.flatMap((span) => [
    {
      id: `${span.id}.start`,
      x: span.ax,
      z: span.az,
      radius: span.width / 2 + 1.25,
      kind: 'traversal' as const,
    },
    {
      id: `${span.id}.end`,
      x: span.bx,
      z: span.bz,
      radius: span.width / 2 + 1.25,
      kind: 'traversal' as const,
    },
  ]),
])

export const VILLAGE_PROP_EXCLUSION_ZONES = Object.freeze(
  VILLAGE_STORY_CLUSTERS.map((cluster) => ({
    id: cluster.id,
    x: cluster.x,
    z: cluster.z,
    radius: cluster.radius + 0.5,
  })),
)

function pointSegmentDistance(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax
  const dz = bz - az
  const lengthSquared = dx * dx + dz * dz
  if (lengthSquared <= 1e-8) return Math.hypot(x - ax, z - az)
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared))
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t))
}

export function distanceToVillagePath(x: number, z: number): number {
  let nearest = Number.POSITIVE_INFINITY
  for (const path of PATHS) {
    for (let index = 0; index < path.length - 1; index++) {
      const a = path[index]
      const b = path[index + 1]
      nearest = Math.min(nearest, pointSegmentDistance(x, z, a.x, a.z, b.x, b.z))
    }
  }
  return nearest
}

export interface VillageDressingValidation {
  readonly valid: boolean
  readonly errors: readonly string[]
  readonly clusterCount: number
  readonly anchorCount: number
}

export function validateVillageDressing(): VillageDressingValidation {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const cluster of VILLAGE_STORY_CLUSTERS) {
    if (ids.has(cluster.id)) errors.push(`duplicate story cluster ${cluster.id}`)
    ids.add(cluster.id)
    const pathClearance = distanceToVillagePath(cluster.x, cluster.z)
    if (pathClearance < cluster.radius + 0.45) {
      errors.push(`${cluster.id} is only ${pathClearance.toFixed(2)}m from a route`)
    }
    for (const mask of VILLAGE_NAVIGATION_CLEARANCES) {
      const distance = Math.hypot(cluster.x - mask.x, cluster.z - mask.z)
      if (distance < cluster.radius + mask.radius) {
        errors.push(`${cluster.id} intersects ${mask.id}`)
      }
    }
  }

  for (const district of SHOWCASE_DISTRICT_IDS) {
    const anchors = VILLAGE_ANCHORS.filter((anchor) => anchor.district === district)
    const clusters = VILLAGE_STORY_CLUSTERS.filter((cluster) => cluster.district === district)
    if (anchors.length < 3) errors.push(`${district} has fewer than three anchors`)
    if (clusters.length < 3) errors.push(`${district} has fewer than three story clusters`)
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    clusterCount: VILLAGE_STORY_CLUSTERS.length,
    anchorCount: VILLAGE_ANCHORS.length,
  })
}
