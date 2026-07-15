import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const output = parseOutput(process.argv.slice(2))
const manifest = JSON.parse(await readFile(join(root, 'src/game/assets/manifest.json'), 'utf8'))
const manifestPaths = new Set(
  manifest.assets.flatMap((record) => record.variants.map((variant) => variant.path)),
)
const publicFiles = await walk(join(root, 'public'))
const distFiles = await walk(join(root, 'dist'))
const runtimeFiles = [...publicFiles, ...distFiles]
const binaryExtensions = new Set([
  '.bmp',
  '.exr',
  '.flac',
  '.glb',
  '.hdr',
  '.jpeg',
  '.jpg',
  '.ktx2',
  '.mp3',
  '.ogg',
  '.png',
  '.tga',
  '.wav',
  '.wasm',
])
const uncompressedRuntimeExtensions = new Set(['.bmp', '.exr', '.hdr', '.tga', '.wav'])
const publicAssetFiles = publicFiles.filter((file) => file.relative.startsWith('public/assets/'))
const unregisteredAuthoredBinaries = publicAssetFiles.filter((file) => {
  if (!binaryExtensions.has(extname(file.relative).toLowerCase())) return false
  if (file.relative.startsWith('public/assets/decoders/')) return false
  return !manifestPaths.has(file.relative.slice('public/'.length))
})
const uncompressedRuntimeAssets = publicAssetFiles.filter((file) =>
  uncompressedRuntimeExtensions.has(extname(file.relative).toLowerCase()),
)
const oversizedRuntimeFiles = runtimeFiles.filter((file) => file.bytes > 10 * 1024 * 1024)
const appAsar = await optionalFile(
  'release/mac-arm64/Turtleback Sanctuary.app/Contents/Resources/app.asar',
)
const report = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  sourceCommit: await currentCommit(),
  manifest: {
    assetCount: manifest.assets.length,
    variantCount: manifest.assets.reduce((sum, record) => sum + record.variants.length, 0),
    encodedBytes: manifest.assets.reduce(
      (sum, record) =>
        sum + record.variants.reduce((variantSum, variant) => variantSum + variant.encodedBytes, 0),
      0,
    ),
    decodedBytes: manifest.assets.reduce(
      (sum, record) =>
        sum + record.variants.reduce((variantSum, variant) => variantSum + variant.decodedBytes, 0),
      0,
    ),
  },
  directories: {
    public: summarize(publicFiles),
    dist: summarize(distFiles),
  },
  packagedApp: { appAsar },
  largestRuntimeFiles: [...runtimeFiles]
    .sort((left, right) => right.bytes - left.bytes || left.relative.localeCompare(right.relative))
    .slice(0, 20),
  gates: {
    maxRuntimeFileBytes: 10 * 1024 * 1024,
    oversizedRuntimeFiles,
    uncompressedRuntimeAssets,
    unregisteredAuthoredBinaries,
    passed:
      oversizedRuntimeFiles.length === 0 &&
      uncompressedRuntimeAssets.length === 0 &&
      unregisteredAuthoredBinaries.length === 0,
  },
}

await writeReport(output, report)
console.info(JSON.stringify(report, null, 2))
if (!report.gates.passed) process.exitCode = 1

async function walk(directory) {
  const files = []
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile())
        files.push({ relative: relative(root, path), bytes: (await stat(path)).size })
    }
  }
  await visit(directory)
  return files.sort((left, right) => left.relative.localeCompare(right.relative))
}

function summarize(files) {
  return {
    fileCount: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
  }
}

async function optionalFile(path) {
  try {
    return { path, bytes: (await stat(join(root, path))).size }
  } catch {
    return null
  }
}

async function currentCommit() {
  try {
    return (await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim()
  } catch {
    return 'unknown'
  }
}

function parseOutput(args) {
  const raw = args.find((argument) => argument.startsWith('--output='))?.slice('--output='.length)
  return raw ?? 'test-results/release-size.json'
}

async function writeReport(path, report) {
  const absolute = resolve(root, path)
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
    throw new Error(`Release-size output must stay inside the repository: ${path}`)
  }
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}
