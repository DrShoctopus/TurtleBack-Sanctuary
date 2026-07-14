import { mkdir, rename, stat, appendFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const MAX_LOG_BYTES = 2 * 1024 * 1024

export class AppLogger {
  constructor(private readonly logFile: string) {}

  private async rotateIfNeeded(): Promise<void> {
    try {
      const info = await stat(this.logFile)
      if (info.size < MAX_LOG_BYTES) return
      await rename(this.logFile, `${this.logFile}.1`).catch(() => undefined)
    } catch {
      // The file does not exist yet.
    }
  }

  async write(level: LogLevel, event: string, details: Record<string, unknown> = {}): Promise<void> {
    const entry = JSON.stringify({
      at: new Date().toISOString(),
      level,
      event,
      ...details,
    })
    try {
      await mkdir(dirname(this.logFile), { recursive: true })
      await this.rotateIfNeeded()
      await appendFile(this.logFile, `${entry}\n`, 'utf8')
    } catch {
      // Logging must never crash the application.
    }
    if (process.env.NODE_ENV !== 'production') {
      const output = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info
      output(`[${event}]`, details)
    }
  }

  debug(event: string, details?: Record<string, unknown>): void {
    void this.write('debug', event, details)
  }

  info(event: string, details?: Record<string, unknown>): void {
    void this.write('info', event, details)
  }

  warn(event: string, details?: Record<string, unknown>): void {
    void this.write('warn', event, details)
  }

  error(event: string, details?: Record<string, unknown>): void {
    void this.write('error', event, details)
  }
}

