export type RendererRecoveryMode = 'reload' | 'safe-mode'

export interface RendererRecoveryDecision {
  mode: RendererRecoveryMode
  attempt: number
}

/**
 * Bounds automatic reloads so a persistent renderer/GPU failure cannot trap the
 * application in a tight crash loop. Attempts age out after the stability window.
 */
export class RendererRecoveryPolicy {
  private attempts: number[] = []

  constructor(
    private readonly stabilityWindowMs = 60_000,
    private readonly maxAutomaticReloads = 2,
  ) {}

  next(now = Date.now()): RendererRecoveryDecision {
    this.attempts = this.attempts.filter((at) => now - at < this.stabilityWindowMs)
    const mode = this.attempts.length >= this.maxAutomaticReloads ? 'safe-mode' : 'reload'
    this.attempts.push(now)
    return { mode, attempt: this.attempts.length }
  }

  reset(): void {
    this.attempts = []
  }
}

export function rendererRecoveryUrl(baseUrl: string, reason: string, safeMode: boolean): string {
  const url = new URL(baseUrl)
  url.searchParams.set('recovery', reason.slice(0, 80))
  if (safeMode) url.searchParams.set('safe', '1')
  else url.searchParams.delete('safe')
  return url.toString()
}
