import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppLogger } from '@/desktop/main/logging/logger'
import { DesktopRepositories } from '@/desktop/main/storage/repositories'
import { DEFAULT_DESKTOP_PREFERENCES } from '@/desktop/shared/contracts'
import { EMPTY_MEDIA } from '@/game/data/media'
import { DEFAULT_SETTINGS } from '@/game/data/settings'
import { SAVE_SCHEMA_VERSION, type PortableSaveData } from '@/game/save/schema'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function createRepositories(): Promise<{
  directory: string
  repositories: DesktopRepositories
}> {
  const directory = await mkdtemp(join(tmpdir(), 'turtleback-repositories-'))
  temporaryDirectories.push(directory)
  const logger = new AppLogger(join(directory, 'logs', 'test.log'))
  return { directory, repositories: new DesktopRepositories(directory, logger) }
}

function sampleSave(): PortableSaveData {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: '1.0.0',
    savedAt: '2026-07-13T12:00:00.000Z',
    player: { position: [1, 2, 3], yaw: 0.4, pitch: -0.1 },
    world: {
      seed: DEFAULT_SETTINGS.worldSeed,
      travelDistance: 42,
      time: { cyclePosition: 0.5, auto: true, speed: 1 },
      weather: { mode: 'auto', rainIntensity: 0.7, rain: 0.2, wetness: 0.4 },
    },
    settings: structuredClone(DEFAULT_SETTINGS),
    media: structuredClone(EMPTY_MEDIA),
    progression: { visitedDistrictIds: [], interactionFlags: {} },
  }
}

describe('DesktopRepositories', () => {
  it('round-trips validated settings, media, preferences, and portable saves', async () => {
    const { repositories } = await createRepositories()
    const settings = structuredClone(DEFAULT_SETTINGS)
    settings.graphics.quality = 'high'
    const media = structuredClone(EMPTY_MEDIA)
    media.journal.push({ id: 'entry-1', at: 1, text: 'Quiet water.' })

    await repositories.setSettings(settings)
    await repositories.setMedia(media)
    await repositories.writeSave('autosave', sampleSave())

    expect(await repositories.getSettings()).toEqual(settings)
    expect(await repositories.getMedia()).toEqual(media)
    expect(await repositories.getPreferences()).toEqual(DEFAULT_DESKTOP_PREFERENCES)
    expect(await repositories.loadSave('autosave')).toEqual(sampleSave())
    expect(await repositories.listSaves()).toEqual([
      {
        slot: 'autosave',
        savedAt: '2026-07-13T12:00:00.000Z',
        gameVersion: '1.0.0',
        recoveredFromBackup: false,
      },
    ])
  })

  it('recovers the last valid settings document after primary corruption', async () => {
    const { directory, repositories } = await createRepositories()
    const first = structuredClone(DEFAULT_SETTINGS)
    const second = structuredClone(DEFAULT_SETTINGS)
    second.graphics.fov = 84

    await repositories.setSettings(first)
    await repositories.setSettings(second)
    await writeFile(join(directory, 'settings.json'), '{not-json', 'utf8')

    expect(await repositories.getSettings()).toEqual(first)
    expect(JSON.parse(await readFile(join(directory, 'settings.json'), 'utf8'))).toEqual(first)
    expect(JSON.parse(await readFile(join(directory, 'settings.json.bak'), 'utf8'))).toEqual(first)
    expect(await readFile(join(directory, 'settings.json.corrupt'), 'utf8')).toBe('{not-json')
  })

  it('quarantines an invalid document without a backup before defaults are seeded', async () => {
    const { directory, repositories } = await createRepositories()
    await writeFile(join(directory, 'media.json'), '{broken-media', 'utf8')

    expect(await repositories.getMedia()).toBeNull()
    expect(await readFile(join(directory, 'media.json.corrupt'), 'utf8')).toBe('{broken-media')

    await repositories.setMedia(EMPTY_MEDIA)
    expect(JSON.parse(await readFile(join(directory, 'media.json'), 'utf8'))).toEqual(EMPTY_MEDIA)
    expect(await readFile(join(directory, 'media.json.corrupt'), 'utf8')).toBe('{broken-media')
  })

  it('serializes concurrent writes to the same repository document', async () => {
    const { repositories } = await createRepositories()
    const first = structuredClone(DEFAULT_SETTINGS)
    const second = structuredClone(DEFAULT_SETTINGS)
    first.graphics.fov = 72
    second.graphics.fov = 94

    await Promise.all([repositories.setSettings(first), repositories.setSettings(second)])

    expect(await repositories.getSettings()).toEqual(second)
  })

  it('erases durable application data and returns clean defaults', async () => {
    const { repositories } = await createRepositories()
    await repositories.setSettings(DEFAULT_SETTINGS)
    await repositories.setMedia(EMPTY_MEDIA)
    await repositories.writeSave('autosave', sampleSave())

    await repositories.eraseAll()

    expect(await repositories.getSettings()).toBeNull()
    expect(await repositories.getMedia()).toBeNull()
    expect(await repositories.getPreferences()).toEqual(DEFAULT_DESKTOP_PREFERENCES)
    expect(await repositories.listSaves()).toEqual([])
  })
})
