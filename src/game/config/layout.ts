/**
 * Village layout — pure data, no imports. Positions in meters.
 * x: lateral (east +), z: travel axis (bow/head is -z, stern is +z).
 * Pad heights were chosen against the shell dome profile in shellShape.ts.
 */

export interface Pad {
  x: number
  z: number
  /** flat radius */
  r: number
  /** target height */
  h: number
  /** blend distance beyond r */
  feather: number
}

export interface PathNode {
  x: number
  z: number
}

export interface BuildingSpec {
  id: string
  name: string
  kind:
    | 'home'
    | 'cafe'
    | 'bookshop'
    | 'records'
    | 'plants'
    | 'gallery'
    | 'bathhouse'
    | 'observatory'
    | 'store'
    | 'pavilion'
    | 'cottage'
  x: number
  z: number
  /** rotation around Y, radians. 0 → door faces +z. */
  yaw: number
  padR: number
  padH: number
}

export interface DistrictSpec {
  id: string
  name: string
  x: number
  z: number
  r: number
}

export interface TraversalSpan {
  id: string
  kind: 'bridge' | 'ramp' | 'stairs'
  ax: number
  az: number
  bx: number
  bz: number
  width: number
  material: 'woodDeck' | 'concrete'
  rails?: boolean
  /** Extra rise at the middle of a segmented bridge. */
  arch?: number
}

export const BUILDINGS: BuildingSpec[] = [
  { id: 'home', name: 'Your House', kind: 'home', x: -62, z: -132, yaw: 1.9, padR: 17, padH: 12.7 },
  {
    id: 'cafe',
    name: 'Driftwood Café',
    kind: 'cafe',
    x: 36,
    z: -52,
    yaw: -2.2,
    padR: 13,
    padH: 15.55,
  },
  {
    id: 'store',
    name: 'Shorelight Goods',
    kind: 'store',
    x: 56,
    z: -22,
    yaw: -1.85,
    padR: 11,
    padH: 15.2,
  },
  {
    id: 'bookshop',
    name: 'Tidal Pages',
    kind: 'bookshop',
    x: -30,
    z: -14,
    yaw: 2.55,
    padR: 12,
    padH: 15.55,
  },
  {
    id: 'records',
    name: 'Shell Records',
    kind: 'records',
    x: 80,
    z: 38,
    yaw: -1.35,
    padR: 11,
    padH: 13.9,
  },
  {
    id: 'gallery',
    name: 'Gallery Meridian',
    kind: 'gallery',
    x: 100,
    z: 62,
    yaw: -0.9,
    padR: 14,
    padH: 13.75,
  },
  {
    id: 'plants',
    name: 'The Verdant House',
    kind: 'plants',
    x: -66,
    z: 62,
    yaw: 2.2,
    padR: 13,
    padH: 13.95,
  },
  {
    id: 'bathhouse',
    name: 'Warm Springs Bathhouse',
    kind: 'bathhouse',
    x: -38,
    z: 120,
    yaw: 2.75,
    padR: 15,
    padH: 13.65,
  },
  {
    id: 'observatory',
    name: 'Stargazer Dome',
    kind: 'observatory',
    x: 12,
    z: 194,
    yaw: 3.14,
    padR: 13,
    padH: 17.4,
  },
  {
    id: 'pavilion',
    name: 'The Commons',
    kind: 'pavilion',
    x: -6,
    z: 36,
    yaw: 0.35,
    padR: 12,
    padH: 15.25,
  },
  // smaller residences along the quiet path
  {
    id: 'cottage1',
    name: 'Reed Cottage',
    kind: 'cottage',
    x: -94,
    z: -46,
    yaw: 1.35,
    padR: 9,
    padH: 13.3,
  },
  {
    id: 'cottage2',
    name: 'Foam Cottage',
    kind: 'cottage',
    x: -100,
    z: -6,
    yaw: 1.65,
    padR: 9,
    padH: 13.25,
  },
  {
    id: 'cottage3',
    name: 'Kelp Cottage',
    kind: 'cottage',
    x: -90,
    z: 28,
    yaw: 2.05,
    padR: 9,
    padH: 13.3,
  },
  {
    id: 'cottage4',
    name: 'Dune Cottage',
    kind: 'cottage',
    x: 62,
    z: -84,
    yaw: -2.6,
    padR: 9,
    padH: 14.55,
  },
]

export const PLAZA = { x: 0, z: -40, r: 26, h: 15.8 }

export const EXTRA_PADS: Pad[] = [
  { x: PLAZA.x, z: PLAZA.z, r: PLAZA.r, h: PLAZA.h, feather: 10 },
  // shell-edge viewing platforms (deck meshes sit on these)
  { x: -146, z: -24, r: 10, h: 10.1, feather: 8 },
  { x: 148, z: 58, r: 10, h: 9.8, feather: 8 },
  { x: 0, z: -224, r: 11, h: 10.0, feather: 9 },
  { x: 2, z: 236, r: 9, h: 10.6, feather: 8 },
  // garden pond dip
  { x: -52, z: 80, r: 7, h: 13.0, feather: 5 },
  // observatory approach terrace
  { x: 2, z: 160, r: 9, h: 15.6, feather: 8 },
]

export const DISTRICTS: DistrictSpec[] = [
  { id: 'overlook', name: 'Arrival Overlook', x: -52, z: -150, r: 34 },
  { id: 'plaza', name: 'Village Plaza', x: 0, z: -40, r: 30 },
  { id: 'market', name: 'Market Lane', x: 46, z: -34, r: 26 },
  { id: 'gardens', name: 'Greenhouse Gardens', x: -58, z: 70, r: 34 },
  { id: 'residential', name: 'Quiet Path', x: -94, z: -8, r: 34 },
  { id: 'arts', name: 'Arts District', x: 90, z: 50, r: 32 },
  { id: 'wellness', name: 'Warm Springs', x: -38, z: 120, r: 24 },
  { id: 'observatory', name: 'Observatory Ridge', x: 10, z: 190, r: 30 },
  { id: 'bow', name: 'Bow Overlook', x: 0, z: -218, r: 24 },
  { id: 'stern', name: 'Stern Deck', x: 2, z: 232, r: 18 },
  { id: 'westdeck', name: 'West Horizon Deck', x: -144, z: -24, r: 16 },
  { id: 'eastdeck', name: 'East Horizon Deck', x: 146, z: 58, r: 16 },
]

/** Path polylines (walking routes; also drive the terrain splat + map). */
export const PATHS: PathNode[][] = [
  // bow overlook → plaza spine
  [
    { x: 0, z: -218 },
    { x: 2, z: -180 },
    { x: -4, z: -140 },
    { x: -8, z: -100 },
    { x: -2, z: -66 },
    { x: 0, z: -40 },
  ],
  // home → spine
  [
    { x: -56, z: -128 },
    { x: -36, z: -118 },
    { x: -8, z: -100 },
  ],
  // plaza → market lane loop
  [
    { x: 0, z: -40 },
    { x: 22, z: -50 },
    { x: 36, z: -46 },
    { x: 50, z: -32 },
    { x: 56, z: -16 },
    { x: 42, z: -4 },
    { x: 20, z: -12 },
    { x: 0, z: -40 },
  ],
  // plaza → bookshop → residential
  [
    { x: 0, z: -40 },
    { x: -24, z: -20 },
    { x: -56, z: -32 },
    { x: -90, z: -42 },
    { x: -98, z: -8 },
    { x: -88, z: 26 },
    { x: -66, z: 50 },
  ],
  // plaza → pavilion → gardens
  [
    { x: 0, z: -40 },
    { x: -4, z: 8 },
    { x: -8, z: 34 },
    { x: -36, z: 52 },
    { x: -62, z: 60 },
  ],
  // gardens → bathhouse → observatory
  [
    { x: -62, z: 60 },
    { x: -56, z: 70 },
    { x: -52, z: 74 },
    { x: -52, z: 86 },
    { x: -54, z: 94 },
    { x: -40, z: 116 },
    { x: -16, z: 140 },
    { x: 0, z: 154 },
    { x: 0, z: 178 },
    { x: 10, z: 190 },
  ],
  // plaza → arts → gallery
  [
    { x: 0, z: -40 },
    { x: 24, z: 6 },
    { x: 54, z: 26 },
    { x: 78, z: 36 },
    { x: 98, z: 58 },
  ],
  // arts → east deck
  [
    { x: 98, z: 58 },
    { x: 126, z: 60 },
    { x: 146, z: 58 },
  ],
  // residential → west deck
  [
    { x: -90, z: -42 },
    { x: -120, z: -34 },
    { x: -144, z: -24 },
  ],
  // observatory → stern deck
  [
    { x: 10, z: 190 },
    { x: 6, z: 216 },
    { x: 2, z: 232 },
  ],
  // cottage on the hill → market
  [
    { x: 60, z: -80 },
    { x: 48, z: -60 },
    { x: 36, z: -46 },
  ],
  // home → bow overlook shortcut along the west rail
  [
    { x: -56, z: -128 },
    { x: -44, z: -168 },
    { x: -20, z: -200 },
    { x: 0, z: -218 },
  ],
]

/** Authored collision-backed route structures. Endpoints also align with PATHS. */
export const TRAVERSAL_SPANS: TraversalSpan[] = [
  {
    id: 'garden-pond-bridge',
    kind: 'bridge',
    ax: -52,
    az: 74,
    bx: -52,
    bz: 86,
    width: 2.6,
    material: 'woodDeck',
    rails: true,
    arch: 0.52,
  },
  {
    id: 'observatory-ramp',
    kind: 'ramp',
    ax: 0,
    az: 154,
    bx: 0,
    bz: 178,
    width: 2.35,
    material: 'woodDeck',
    rails: true,
  },
  {
    id: 'observatory-stairs',
    kind: 'stairs',
    ax: 4.4,
    az: 169.6,
    bx: 6,
    bz: 176,
    width: 2.5,
    material: 'concrete',
    rails: true,
  },
  {
    id: 'stern-descent',
    kind: 'stairs',
    ax: 5.2,
    az: 220,
    bx: 3.6,
    bz: 228,
    width: 2.55,
    material: 'woodDeck',
    rails: true,
  },
  {
    id: 'stern-landing',
    kind: 'ramp',
    ax: 3.6,
    az: 228,
    bx: 2,
    bz: 236,
    width: 2.55,
    material: 'woodDeck',
    rails: true,
  },
  {
    id: 'west-deck-gangway',
    kind: 'ramp',
    ax: -130.4,
    az: -30,
    bx: -146,
    bz: -24,
    width: 2.45,
    material: 'woodDeck',
    rails: true,
  },
  {
    id: 'east-deck-gangway',
    kind: 'ramp',
    ax: 126,
    az: 60,
    bx: 148,
    bz: 58,
    width: 2.45,
    material: 'woodDeck',
    rails: true,
  },
  {
    id: 'bow-deck-gangway',
    kind: 'ramp',
    ax: 0,
    az: -205,
    bx: 0,
    bz: -224,
    width: 2.55,
    material: 'woodDeck',
    rails: true,
  },
]

/** Garden pond + plaza fountain + bath pools (visual water discs). */
export const WATER_FEATURES = [
  { id: 'pond', x: -52, z: 80, r: 5.4, y: 13.12 },
  { id: 'fountain', x: 0, z: -40, r: 3.2, y: 15.95 },
] as const
