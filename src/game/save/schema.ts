import { z } from 'zod'
import { gameSettingsSchema } from '../data/settings'
import { portableMediaSchema } from '../data/media'

export const SAVE_SCHEMA_VERSION = 1 as const

const finite = z.number().finite()
const portableId = z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,79}$/)

export const portableSaveSchema = z.object({
  schemaVersion: z.literal(SAVE_SCHEMA_VERSION),
  gameVersion: z.string().min(1).max(40),
  savedAt: z.string().datetime({ offset: true }),
  player: z.object({
    position: z.tuple([finite, finite, finite]),
    yaw: finite,
    pitch: finite.min(-1.5).max(1.5),
  }),
  world: z.object({
    seed: z.number().int().min(0).max(0x7fffffff),
    travelDistance: finite.nonnegative(),
    time: z.object({
      cyclePosition: finite.min(0).max(1),
      auto: z.boolean(),
      speed: z.union([z.literal(0.5), z.literal(1), z.literal(2), z.literal(5)]),
    }),
    weather: z.object({
      mode: z.enum(['auto', 'clear', 'rain']),
      rainIntensity: finite.min(0).max(1),
      rain: finite.min(0).max(1),
      wetness: finite.min(0).max(1),
    }),
  }),
  settings: gameSettingsSchema,
  media: portableMediaSchema,
  progression: z.object({
    visitedDistrictIds: z.array(portableId).max(128),
    interactionFlags: z.record(portableId, z.boolean()),
  }),
  desktop: z
    .object({
      sourcePlatform: z.enum(['win32', 'darwin', 'linux']).optional(),
    })
    .optional(),
})

export type PortableSaveData = z.infer<typeof portableSaveSchema>

export interface SaveSlotInfo {
  slot: string
  savedAt: string
  gameVersion: string
  recoveredFromBackup: boolean
}

export const saveSlotSchema = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/)

export function parsePortableSave(value: unknown): PortableSaveData {
  return portableSaveSchema.parse(value)
}

