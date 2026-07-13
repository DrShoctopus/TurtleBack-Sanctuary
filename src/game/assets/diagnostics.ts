import type { AssetDiagnostics } from './AssetManager'

export interface AssetDiagnosticsSource {
  diagnostics(): AssetDiagnostics
}

let activeSource: { readonly token: symbol; readonly source: AssetDiagnosticsSource } | null = null

/** Module-only read seam for browser tests; no production window global is installed. */
export function readActiveAssetDiagnostics(): AssetDiagnostics | null {
  return activeSource?.source.diagnostics() ?? null
}

export function registerActiveAssetDiagnostics(source: AssetDiagnosticsSource): () => void {
  const token = Symbol('active asset diagnostics')
  activeSource = { token, source }
  let cleaned = false

  return () => {
    if (cleaned) return
    cleaned = true
    if (activeSource?.token === token) activeSource = null
  }
}
