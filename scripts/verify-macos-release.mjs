import { access, readdir, stat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { platform } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const mode = parseMode(process.argv)

assert(platform() === 'darwin', 'macOS release verification must run on macOS')

const appPath = await findApplication(process.argv)
const contentsPath = join(appPath, 'Contents')
const infoPlist = join(contentsPath, 'Info.plist')
const executablePath = join(contentsPath, 'MacOS', 'Turtleback Sanctuary')
const bundleIdentifier = await plistValue(infoPlist, 'CFBundleIdentifier')
const minimumSystemVersion = await plistValue(infoPlist, 'LSMinimumSystemVersion')
const iconName = await plistValue(infoPlist, 'CFBundleIconFile')
const iconPath = join(contentsPath, 'Resources', iconName.endsWith('.icns') ? iconName : `${iconName}.icns`)
const iconSizeBytes = (await stat(iconPath)).size
const architectures = (await run('lipo', ['-archs', executablePath])).stdout.trim().split(/\s+/)

assert(bundleIdentifier === 'com.turtleback.sanctuary', `unexpected bundle id ${bundleIdentifier}`)
assert(minimumSystemVersion === '12.0', `unexpected minimum macOS ${minimumSystemVersion}`)
assert(iconSizeBytes > 1_024, `generated icon is unexpectedly small (${iconSizeBytes} bytes)`)
assert(
  architectures.length === 1 && architectures[0] === 'arm64',
  `expected an arm64-only executable, received ${architectures.join(', ')}`,
)
await run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath])
const signature = await run('codesign', ['--display', '--verbose=4', appPath])
const signatureDetails = `${signature.stdout}\n${signature.stderr}`

const report = {
  schemaVersion: 1,
  mode,
  artifact: appPath.slice(root.length + 1),
  bundleIdentifier,
  minimumSystemVersion,
  architectures,
  icon: {
    resource: iconPath.slice(appPath.length + 1),
    sizeBytes: iconSizeBytes,
  },
  signing: {
    kind: mode === 'local' ? 'ad-hoc' : 'Developer ID Application',
    verified: true,
  },
  notarization: null,
  diskImage: null,
}

if (mode === 'release') {
  assert(
    signatureDetails.includes('Authority=Developer ID Application:'),
    'application is not signed with a Developer ID Application certificate',
  )
  assert(/flags=.*runtime/.test(signatureDetails), 'hardened runtime is not present in the signature')
  const gatekeeper = await run('spctl', ['--assess', '--type', 'execute', '--verbose=2', appPath])
  const stapler = await run('xcrun', ['stapler', 'validate', appPath])
  const diskImage = await findDiskImage()
  const diskImageVerification = await run('hdiutil', ['verify', diskImage])

  report.signing = {
    kind: 'Developer ID Application',
    verified: true,
    developerIdApplication: true,
    hardenedRuntime: true,
    gatekeeper: `${gatekeeper.stdout}\n${gatekeeper.stderr}`.trim(),
  }
  report.notarization = `${stapler.stdout}\n${stapler.stderr}`.trim()
  report.diskImage = {
    artifact: diskImage.slice(root.length + 1),
    verified: /verified successfully/i.test(
      `${diskImageVerification.stdout}\n${diskImageVerification.stderr}`,
    ),
  }
  assert(report.diskImage.verified, 'hdiutil did not report a valid disk image')
} else {
  assert(signatureDetails.includes('Signature=adhoc'), 'local proof is not ad-hoc signed')
}

console.info(JSON.stringify(report, null, 2))

async function plistValue(plist, key) {
  return (await run('plutil', ['-extract', key, 'raw', '-o', '-', plist])).stdout.trim()
}

async function findApplication(args) {
  const explicit = args.find((argument) => argument.startsWith('--app='))?.slice('--app='.length)
  const candidates = explicit
    ? [resolve(root, explicit)]
    : [
        resolve(root, 'release/mac-arm64/Turtleback Sanctuary.app'),
        resolve(root, 'release/mac/Turtleback Sanctuary.app'),
      ]
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next Electron Builder output directory.
    }
  }
  throw new Error('No macOS application found. Run pnpm desktop:package:mac first.')
}

async function findDiskImage() {
  const entries = await readdir(resolve(root, 'release'))
  const name = entries.find((entry) => entry.endsWith('-mac-arm64.dmg'))
  assert(name, 'no arm64 release disk image found')
  return resolve(root, 'release', name)
}

async function run(command, args) {
  try {
    return await execFileAsync(command, args, { cwd: root, maxBuffer: 10 * 1024 * 1024 })
  } catch (error) {
    const stdout = typeof error.stdout === 'string' ? error.stdout : ''
    const stderr = typeof error.stderr === 'string' ? error.stderr : ''
    throw new Error(`${command} ${args.join(' ')} failed\n${stdout}\n${stderr}`.trim())
  }
}

function parseMode(args) {
  const value = args.find((argument) => argument.startsWith('--mode='))?.slice('--mode='.length)
  assert(value === 'local' || value === 'release', '--mode must be local or release')
  return value
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
