import { z } from 'zod'

export interface RecentVideo {
  id: string
  title: string
  addedAt: number
}

export interface RadioStation {
  name: string
  url: string
}

export interface JournalEntry {
  id: string
  at: number
  text: string
}

export interface PortableMediaData {
  recentVideos: RecentVideo[]
  stations: RadioStation[]
  journal: JournalEntry[]
}

const safeHttpsUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => value.startsWith('https://'), 'Only HTTPS media URLs are portable')

export const portableMediaSchema: z.ZodType<PortableMediaData> = z.object({
  recentVideos: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]{6,32}$/),
        title: z.string().max(160),
        addedAt: z.number().int().nonnegative(),
      }),
    )
    .max(12),
  stations: z
    .array(z.object({ name: z.string().min(1).max(160), url: safeHttpsUrl }))
    .max(20),
  journal: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        at: z.number().int().nonnegative(),
        text: z.string().min(1).max(4000),
      }),
    )
    .max(100),
})

export const EMPTY_MEDIA: PortableMediaData = {
  recentVideos: [],
  stations: [],
  journal: [],
}

/** Validate persisted media and migrate legacy numeric journal IDs. */
export function migrateMedia(value: unknown): PortableMediaData {
  if (!value || typeof value !== 'object') return structuredClone(EMPTY_MEDIA)
  const source = value as Record<string, unknown>
  const candidate = {
    recentVideos: source.recentVideos ?? [],
    stations: source.stations ?? [],
    journal: Array.isArray(source.journal)
      ? source.journal.map((entry) => {
          if (!entry || typeof entry !== 'object') return entry
          const record = entry as Record<string, unknown>
          return {
            ...record,
            id: typeof record.id === 'string' ? record.id : `legacy-${String(record.id ?? '')}`,
          }
        })
      : [],
  }
  const parsed = portableMediaSchema.safeParse(candidate)
  return parsed.success ? parsed.data : structuredClone(EMPTY_MEDIA)
}

export function createJournalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `journal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

