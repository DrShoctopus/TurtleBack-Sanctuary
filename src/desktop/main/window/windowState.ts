import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { z } from 'zod'
import type { AppLogger } from '../logging/logger'
import { readAtomicJson, writeAtomicJson } from '../storage/atomicJson'
import { intersectsVisibleDisplay } from './windowPlacement'

const windowStateSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().min(960).max(7680),
  height: z.number().int().min(540).max(4320),
  maximized: z.boolean(),
})

type WindowState = z.infer<typeof windowStateSchema>

const DEFAULT_STATE: WindowState = { x: 80, y: 80, width: 1280, height: 720, maximized: false }

export class WindowStateManager {
  private readonly file: string
  private pendingTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    userDataDirectory: string,
    private readonly logger: AppLogger,
  ) {
    this.file = join(userDataDirectory, 'window-state.json')
  }

  async restore(): Promise<WindowState> {
    const result = await readAtomicJson(this.file, windowStateSchema)
    if (result.primaryCorrupt) this.logger.warn('window.state_primary_corrupt')
    if (result.recoveredFromBackup) this.logger.warn('window.state_recovered_backup')
    if (!result.data) return DEFAULT_STATE
    if (
      !intersectsVisibleDisplay(
        result.data,
        screen.getAllDisplays().map((display) => display.workArea),
      )
    ) {
      this.logger.warn('window.state_offscreen_reset')
      return DEFAULT_STATE
    }
    return result.data
  }

  attach(window: BrowserWindow): void {
    const schedule = () => {
      if (this.pendingTimer) clearTimeout(this.pendingTimer)
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null
        void this.persist(window)
      }, 350)
    }
    window.on('resize', schedule)
    window.on('move', schedule)
    window.on('maximize', schedule)
    window.on('unmaximize', schedule)
  }

  async flush(window: BrowserWindow): Promise<void> {
    if (this.pendingTimer) clearTimeout(this.pendingTimer)
    this.pendingTimer = null
    await this.persist(window)
  }

  async persist(window: BrowserWindow): Promise<void> {
    if (window.isDestroyed()) return
    const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds()
    const state: WindowState = {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      maximized: window.isMaximized(),
    }
    try {
      await writeAtomicJson(this.file, state, windowStateSchema)
    } catch (error) {
      this.logger.warn('window.state_write_failed', { error: String(error) })
    }
  }
}
