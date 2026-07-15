import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DEFAULT_DESKTOP_PREFERENCES,
  desktopPreferencesSchema,
  type DesktopPreferences,
} from '../../shared/contracts'
import { gameSettingsSchema, type GameSettings } from '../../../game/data/settings'
import {
  portableSaveSchema,
  saveSlotSchema,
  type PortableSaveData,
  type SaveSlotInfo,
} from '../../../game/save/schema'
import type { AppLogger } from '../logging/logger'
import { portableMediaSchema, type PortableMediaData } from '../../../game/data/media'
import { deleteAtomicJson, readAtomicJson, writeAtomicJson } from './atomicJson'

export class DesktopRepositories {
  private readonly savesDirectory: string
  private readonly settingsFile: string
  private readonly preferencesFile: string
  private readonly mediaFile: string

  constructor(
    userDataDirectory: string,
    private readonly logger: AppLogger,
  ) {
    this.savesDirectory = join(userDataDirectory, 'saves')
    this.settingsFile = join(userDataDirectory, 'settings.json')
    this.preferencesFile = join(userDataDirectory, 'desktop-preferences.json')
    this.mediaFile = join(userDataDirectory, 'media.json')
  }

  private saveFile(slot: string): string {
    return join(this.savesDirectory, `${saveSlotSchema.parse(slot)}.json`)
  }

  async writeSave(slot: string, data: PortableSaveData): Promise<void> {
    const safeSlot = saveSlotSchema.parse(slot)
    await writeAtomicJson(this.saveFile(safeSlot), data, portableSaveSchema)
    this.logger.info('save.write', { slot: safeSlot, schemaVersion: data.schemaVersion })
  }

  async loadSave(slot: string): Promise<PortableSaveData | null> {
    const safeSlot = saveSlotSchema.parse(slot)
    const result = await readAtomicJson(this.saveFile(safeSlot), portableSaveSchema)
    if (result.primaryCorrupt) this.logger.warn('save.primary_corrupt', { slot: safeSlot })
    if (result.recoveredFromBackup) this.logger.warn('save.recovered_backup', { slot: safeSlot })
    return result.data
  }

  async listSaves(): Promise<SaveSlotInfo[]> {
    let files: string[] = []
    try {
      files = await readdir(this.savesDirectory)
    } catch {
      return []
    }
    const slots = files
      .filter((file) => file.endsWith('.json') && !file.endsWith('.bak'))
      .map((file) => file.slice(0, -'.json'.length))
      .filter((slot) => saveSlotSchema.safeParse(slot).success)

    const results = await Promise.all(
      slots.map(async (slot): Promise<SaveSlotInfo | null> => {
        const loaded = await readAtomicJson(this.saveFile(slot), portableSaveSchema)
        if (!loaded.data) return null
        return {
          slot,
          savedAt: loaded.data.savedAt,
          gameVersion: loaded.data.gameVersion,
          recoveredFromBackup: loaded.recoveredFromBackup,
        }
      }),
    )
    return results
      .filter((entry): entry is SaveSlotInfo => entry !== null)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  }

  async getSettings(): Promise<GameSettings | null> {
    const result = await readAtomicJson(this.settingsFile, gameSettingsSchema)
    if (result.primaryCorrupt) this.logger.warn('settings.primary_corrupt')
    if (result.recoveredFromBackup) this.logger.warn('settings.recovered_backup')
    return result.data
  }

  async setSettings(settings: GameSettings): Promise<GameSettings> {
    const parsed = gameSettingsSchema.parse(settings)
    await writeAtomicJson(this.settingsFile, parsed, gameSettingsSchema)
    return parsed
  }

  async getMedia(): Promise<PortableMediaData | null> {
    const result = await readAtomicJson(this.mediaFile, portableMediaSchema)
    if (result.primaryCorrupt) this.logger.warn('media.primary_corrupt')
    if (result.recoveredFromBackup) this.logger.warn('media.recovered_backup')
    return result.data
  }

  async setMedia(media: PortableMediaData): Promise<PortableMediaData> {
    const parsed = portableMediaSchema.parse(media)
    await writeAtomicJson(this.mediaFile, parsed, portableMediaSchema)
    return parsed
  }

  async getPreferences(): Promise<DesktopPreferences> {
    const result = await readAtomicJson(this.preferencesFile, desktopPreferencesSchema)
    if (result.primaryCorrupt) this.logger.warn('desktop_preferences.primary_corrupt')
    if (result.recoveredFromBackup) this.logger.warn('desktop_preferences.recovered_backup')
    return result.data ?? structuredClone(DEFAULT_DESKTOP_PREFERENCES)
  }

  async eraseAll(): Promise<void> {
    await Promise.all([
      deleteAtomicJson(this.settingsFile),
      deleteAtomicJson(this.mediaFile),
      deleteAtomicJson(this.preferencesFile),
      rm(this.savesDirectory, { recursive: true, force: true }),
    ])
    this.logger.info('data.erase_all')
  }
}
