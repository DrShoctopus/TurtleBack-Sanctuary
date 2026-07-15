import { BASIS_TRANSCODER_WORKER_PATH } from '../../../shared/basisTranscoder'

/**
 * Three's bundled Basis transcoder uses Emscripten Embind-generated functions.
 * Keep that capability on the exact external worker response instead of
 * weakening the renderer document's script policy.
 */
export const BASIS_TRANSCODER_WORKER_CSP = [
  "default-src 'none'",
  "script-src blob: 'unsafe-eval' 'wasm-unsafe-eval'",
  "connect-src 'none'",
  "object-src 'none'",
  "worker-src 'none'",
].join('; ')

export function rendererDocumentContentSecurityPolicy(development: boolean): string {
  const scriptPolicy = development
    ? "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'"
    : "script-src 'self' 'wasm-unsafe-eval'"
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    scriptPolicy,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: turtleback-media:",
    "connect-src 'self' https: wss: ws:",
    'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
    "worker-src 'self'",
  ].join('; ')
}

export function isBasisTranscoderWorkerUrl(url: string, rendererBaseUrl: string): boolean {
  try {
    const expected = new URL(BASIS_TRANSCODER_WORKER_PATH, `${rendererBaseUrl}/`)
    const actual = new URL(url)
    return (
      actual.protocol === expected.protocol &&
      actual.host === expected.host &&
      actual.pathname === expected.pathname &&
      actual.search === '' &&
      actual.hash === ''
    )
  } catch {
    return false
  }
}

export function contentSecurityPolicyForResponse(input: {
  readonly url: string
  readonly resourceType: string
  readonly appOrigin: string
  readonly developmentOrigin?: string
}): string | null {
  const appDocument = input.url.startsWith(`${input.appOrigin}/`)
  const developmentDocument =
    input.developmentOrigin !== undefined && input.url.startsWith(`${input.developmentOrigin}/`)
  const rendererDocument =
    input.resourceType === 'mainFrame' && (appDocument || developmentDocument)
  if (rendererDocument) {
    return rendererDocumentContentSecurityPolicy(developmentDocument)
  }
  return isBasisTranscoderWorkerUrl(input.url, input.developmentOrigin ?? input.appOrigin)
    ? BASIS_TRANSCODER_WORKER_CSP
    : null
}
