import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const root = resolve(import.meta.dirname, '..')
const outputDirectory = resolve(root, 'dist-desktop')
const development = process.argv.includes('--development')

await rm(outputDirectory, { recursive: true, force: true })

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  sourcemap: development ? 'inline' : false,
  minify: !development,
  legalComments: 'none',
  external: ['electron'],
  define: {
    'process.env.NODE_ENV': JSON.stringify(development ? 'development' : 'production'),
  },
}

await Promise.all([
  build({
    ...common,
    entryPoints: [resolve(root, 'src/desktop/main/index.ts')],
    outfile: resolve(outputDirectory, 'main/index.cjs'),
    format: 'cjs',
  }),
  build({
    ...common,
    entryPoints: [resolve(root, 'src/desktop/preload/index.ts')],
    outfile: resolve(outputDirectory, 'preload/index.cjs'),
    format: 'cjs',
  }),
])

console.info(`Desktop processes bundled (${development ? 'development' : 'production'}).`)
