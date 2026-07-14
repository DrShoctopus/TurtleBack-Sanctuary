$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$releaseDirectory = Join-Path $root 'release'
$installer = Get-ChildItem -LiteralPath $releaseDirectory -Filter 'Turtleback Sanctuary-*-win-x64.exe' |
  Select-Object -First 1
if (-not $installer) { throw 'Windows x64 NSIS installer was not found.' }

$installDirectory = Join-Path $env:RUNNER_TEMP 'turtleback-sanctuary-install'
if (Test-Path -LiteralPath $installDirectory) {
  Remove-Item -LiteralPath $installDirectory -Recurse -Force
}

$install = Start-Process -FilePath $installer.FullName -ArgumentList @(
  '/S',
  "/D=$installDirectory"
) -Wait -PassThru
if ($install.ExitCode -ne 0) { throw "Installer exited with $($install.ExitCode)." }

$application = Join-Path $installDirectory 'Turtleback Sanctuary.exe'
$uninstaller = Get-ChildItem -LiteralPath $installDirectory -Filter 'Uninstall*.exe' |
  Select-Object -First 1
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Turtleback Sanctuary.lnk'
$startMenuShortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Turtleback Sanctuary.lnk'

if (-not (Test-Path -LiteralPath $application)) { throw 'Installed application was not found.' }
if (-not $uninstaller) { throw 'Uninstaller was not found.' }
if (-not (Test-Path -LiteralPath $desktopShortcut)) { throw 'Desktop shortcut was not created.' }
if (-not (Test-Path -LiteralPath $startMenuShortcut)) { throw 'Start menu shortcut was not created.' }

$installedSmokeReport = Join-Path $releaseDirectory 'windows-installed-smoke.json'
& node (Join-Path $root 'scripts\smoke-desktop.mjs') "--executable=$application" |
  Tee-Object -FilePath $installedSmokeReport
if ($LASTEXITCODE -ne 0) { throw "Installed application smoke failed with $LASTEXITCODE." }

$uninstall = Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -Wait -PassThru
if ($uninstall.ExitCode -ne 0) { throw "Uninstaller exited with $($uninstall.ExitCode)." }

$deadline = [DateTime]::UtcNow.AddSeconds(20)
while ((Test-Path -LiteralPath $application) -and [DateTime]::UtcNow -lt $deadline) {
  Start-Sleep -Milliseconds 250
}
if (Test-Path -LiteralPath $application) { throw 'Application remained after uninstall.' }
if (Test-Path -LiteralPath $desktopShortcut) { throw 'Desktop shortcut remained after uninstall.' }
if (Test-Path -LiteralPath $startMenuShortcut) { throw 'Start menu shortcut remained after uninstall.' }

$proof = [ordered]@{
  schemaVersion = 1
  installer = $installer.FullName.Substring($root.Length + 1)
  installDirectory = $installDirectory
  desktopShortcutCreated = $true
  startMenuShortcutCreated = $true
  installedApplicationSmoke = $true
  uninstallRemovedApplication = $true
  uninstallRemovedShortcuts = $true
}
$proofJson = $proof | ConvertTo-Json
$proofJson | Set-Content -LiteralPath (Join-Path $releaseDirectory 'windows-install-proof.json')
$proofJson
