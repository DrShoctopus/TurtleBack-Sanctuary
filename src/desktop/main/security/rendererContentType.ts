import { extname } from 'node:path'

/** Content types served through the packaged renderer's app:// protocol. */
export function rendererContentType(file: string): string {
  switch (extname(file).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.wasm':
      return 'application/wasm'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.glb':
      return 'model/gltf-binary'
    case '.gltf':
      return 'model/gltf+json; charset=utf-8'
    case '.ktx2':
      return 'image/ktx2'
    case '.hdr':
      return 'image/vnd.radiance'
    case '.exr':
      return 'image/x-exr'
    case '.bin':
      return 'application/octet-stream'
    default:
      return 'application/octet-stream'
  }
}
