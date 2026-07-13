import { open, readdir, stat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { platform } from 'node:os'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const releaseDirectory = resolve(root, 'release')
const mode = parseMode(process.argv)
const applicationPath = resolve(releaseDirectory, 'win-unpacked', 'Turtleback Sanctuary.exe')
const installerPath = await findInstaller()
const applicationPe = await inspectPe(applicationPath)
const installerPe = await inspectPe(installerPath)
const applicationSizeBytes = (await stat(applicationPath)).size
const installerSizeBytes = (await stat(installerPath)).size

assert(applicationPe.machine === 'x64', `expected x64 application, received ${applicationPe.machine}`)
assert(applicationSizeBytes > 50 * 1024 * 1024, 'unpacked application executable is too small')
assert(installerSizeBytes > 50 * 1024 * 1024, 'NSIS installer is too small')

const report = {
  schemaVersion: 1,
  mode,
  sourceCommit: await currentCommit(),
  application: {
    artifact: applicationPath.slice(root.length + 1),
    machine: applicationPe.machine,
    sizeBytes: applicationSizeBytes,
    versionInfo: null,
    signature: null,
  },
  installer: {
    artifact: installerPath.slice(root.length + 1),
    machine: installerPe.machine,
    sizeBytes: installerSizeBytes,
    versionInfo: null,
    signature: null,
  },
}

if (platform() === 'win32') {
  report.application.versionInfo = await versionInfo(applicationPath)
  report.installer.versionInfo = await versionInfo(installerPath)
  assert(
    report.application.versionInfo.ProductName === 'Turtleback Sanctuary',
    `unexpected application product name ${report.application.versionInfo.ProductName}`,
  )
  assert(
    report.application.versionInfo.FileDescription === 'Turtleback Sanctuary',
    `unexpected application description ${report.application.versionInfo.FileDescription}`,
  )
  assert(
    report.application.versionInfo.ProductVersion.startsWith('1.0.0'),
    `unexpected application version ${report.application.versionInfo.ProductVersion}`,
  )

  report.application.signature = await authenticode(applicationPath)
  report.installer.signature = await authenticode(installerPath)
  if (mode === 'release') {
    assert(
      report.application.signature.Status === 'Valid',
      `application Authenticode status is ${report.application.signature.Status}`,
    )
    assert(
      report.installer.signature.Status === 'Valid',
      `installer Authenticode status is ${report.installer.signature.Status}`,
    )
  }
} else {
  assert(mode === 'proof', 'signed Windows release verification must run on Windows')
}

console.info(JSON.stringify(report, null, 2))

async function inspectPe(file) {
  const handle = await open(file, 'r')
  try {
    const dosHeader = Buffer.alloc(64)
    await handle.read(dosHeader, 0, dosHeader.length, 0)
    assert(dosHeader.toString('ascii', 0, 2) === 'MZ', `${file} has no DOS header`)
    const peOffset = dosHeader.readUInt32LE(0x3c)
    const peHeader = Buffer.alloc(6)
    await handle.read(peHeader, 0, peHeader.length, peOffset)
    assert(peHeader.toString('ascii', 0, 4) === 'PE\0\0', `${file} has no PE header`)
    const machineCode = peHeader.readUInt16LE(4)
    return {
      machineCode: `0x${machineCode.toString(16)}`,
      machine: machineCode === 0x8664 ? 'x64' : machineCode === 0x14c ? 'x86' : 'unknown',
    }
  } finally {
    await handle.close()
  }
}

async function findInstaller() {
  const entries = await readdir(releaseDirectory)
  const name = entries.find(
    (entry) => entry.startsWith('Turtleback Sanctuary-') && entry.endsWith('-win-x64.exe'),
  )
  assert(name, 'no Windows x64 NSIS installer found')
  return resolve(releaseDirectory, name)
}

async function versionInfo(file) {
  const script = [
    `$info = (Get-Item -LiteralPath '${powerShellQuote(file)}').VersionInfo;`,
    '[pscustomobject]@{',
    'ProductName = $info.ProductName;',
    'FileDescription = $info.FileDescription;',
    'ProductVersion = $info.ProductVersion;',
    'FileVersion = $info.FileVersion;',
    'CompanyName = $info.CompanyName',
    '} | ConvertTo-Json -Compress',
  ].join(' ')
  return JSON.parse((await runPowerShell(script)).trim())
}

async function authenticode(file) {
  const script = [
    `$signature = Get-AuthenticodeSignature -LiteralPath '${powerShellQuote(file)}';`,
    '[pscustomobject]@{',
    'Status = [string]$signature.Status;',
    'StatusMessage = $signature.StatusMessage;',
    'Subject = $signature.SignerCertificate.Subject',
    '} | ConvertTo-Json -Compress',
  ].join(' ')
  return JSON.parse((await runPowerShell(script)).trim())
}

async function runPowerShell(script) {
  const executable = process.env.SystemRoot
    ? resolve(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell.exe'
  return (
    await execFileAsync(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
      cwd: root,
      maxBuffer: 10 * 1024 * 1024,
    })
  ).stdout
}

function powerShellQuote(value) {
  return value.replaceAll("'", "''")
}

function parseMode(args) {
  const value = args.find((argument) => argument.startsWith('--mode='))?.slice('--mode='.length)
  assert(value === 'proof' || value === 'release', '--mode must be proof or release')
  return value
}

async function currentCommit() {
  try {
    return (await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim()
  } catch {
    return 'unknown'
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
