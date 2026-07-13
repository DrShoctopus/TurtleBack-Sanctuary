import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { z } from 'zod'
import type { AppLogger } from '../logging/logger'
import { readAtomicJson, writeAtomicJson } from '../storage/atomicJson'

const windowStateSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().min(960).max(7680),
  height: z.number().int().min(540).max(4320),
  maximized: z.boolean(),
})

type WindowState = z.infer<typeof windowStateSchema>

const DEFAULT_STATE: WindowState = { x: 80, y: 80, width: 1280, height: 720, maximized: false }

function intersectsVisibleDisplay(state: WindowState): boolean {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea
    const right = Math.min(state.x + state.width, area.x + area.width)
    const bottom = Math.min(state.y + state.height, area.y + area.height)
    const left = Math.max(state.x, area.x)
    const top = Math.max(state.y, area.y)
    return right - left >= 160 && bottom - top >= 120
  })
}

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
    if (!result.data || !intersectsVisibleDisplay(result.data)) return DEFAULT_STATE
    return result.data
  }

  attach(window: BrowserWindow): void {
    const schedule = () => {
      if (this.pendingTimer) clearTimeout(this.pendingTimer)
      this.pendingTimer = setTimeout(() => void this.persist(window), 350)
    }
    window.on('resize', schedule)
    window.on('move', schedule)
    window.on('maximize', schedule)
    window.on('unmaximize', schedule)
    window.on('close', () => void this.persist(window))
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

