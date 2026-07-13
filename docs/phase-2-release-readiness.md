# Phase 2 — Desktop Release Readiness

## Outcome

Turn the Phase 1 desktop vertical slice into reproducible release candidates in
this fixed order:

1. **Primary:** macOS 12+ on Apple silicon (`arm64`).
2. **Secondary:** Windows 10/11 on 64-bit Intel/AMD (`x64`).

Intel macOS, Windows on Arm, and Linux are explicitly deferred. Phase 2 does
not expand the game feature surface; it closes packaging, platform lifecycle,
trust, and repeatability gaps around the existing desktop application.

## Release rules

- Local proof builds are ad-hoc signed for reliable launch, but they are never
  release candidates.
- A macOS release candidate must be Developer ID signed, hardened, notarized,
  stapled, Gatekeeper accepted, and produced as Apple-silicon-only DMG and ZIP
  artifacts.
- A Windows candidate must be built and smoke-tested on a real Windows x64
  runner. Cross-packaging alone is not platform proof.
- Signing keys and notarization credentials stay outside the repository.
- Each platform slice is verified, committed, and pushed before the next begins.

## 2A — macOS Apple silicon

### A1. Identity and deterministic packaging

- Reuse the project's original turtle SVG as the single package icon source.
- Set the bundle identifier to `com.turtleback.sanctuary` and declare macOS 12.0
  as the minimum supported system.
- Build only `arm64`; do not silently emit Intel or universal artifacts.
- Keep an ad-hoc-signed unpacked local command for fast smoke testing and a
  separate strict DMG/ZIP release command.

### A2. Hardened runtime and lifecycle proof

- Provide the Electron JIT entitlements required by the hardened runtime without
  enabling unrelated device or personal-information permissions.
- Extend the packaged smoke test to exercise quit/relaunch persistence, second
  instance activation, synthetic suspend/resume delivery, offline startup, and
  post-event renderer responsiveness.
- Verify bundle metadata, generated icon, minimum OS, and Mach-O architecture.

### A3. Signed/notarized release gate

- Make the release build fail if a Developer ID Application identity is absent.
- Use electron-builder notarization with credentials injected by the release
  environment.
- Verify the deep signature, hardened-runtime flag, Gatekeeper assessment,
  stapled notarization ticket, and DMG integrity.
- Run the release workflow on a GitHub-hosted Apple silicon runner and retain the
  DMG, ZIP, and verification output.

### Apple silicon exit criteria

- Unit, browser E2E, typecheck, lint, build, package, metadata verification, and
  packaged lifecycle smoke pass.
- Finder/Dock use the Turtleback icon rather than Electron's default.
- A credentialed CI run produces a signed/notarized candidate and its verifier
  reports success.
- A short physical-device checklist confirms first launch, audio, controller,
  sleep/wake, fullscreen, and clean uninstall on Apple silicon.

## 2B — Windows x64

### B1. Native package configuration

- Build an explicit `x64` NSIS installer and unpacked application with the same
  application identifier and branded icon.
- Configure install scope, shortcuts, uninstall identity, and artifact names.
- Keep platform-specific commands separate from the macOS release path.

Implementation uses a non-elevating per-user assisted installer, preserves
application data during uninstall, and creates Desktop and Start Menu shortcuts.
Unsigned proof and credentialed Authenticode configurations are separate.

### Cross-package proof — 2026-07-13

- Produced the branded Windows x64 unpacked application and unsigned NSIS
  installer from the Apple silicon build host.
- Verified the installed payload executable is an AMD64 PE. The NSIS bootstrap
  executable is an x86 PE by design and carries only the x64 application
  payload.
- Verified the generated ICO matches the original Turtleback vector source.
- Native Windows version-resource checks, installed-app smoke, shortcut checks,
  and uninstall cleanup remain gated on the Windows workflow.

### B2. Real Windows automation

- Run unit/type/lint/build checks on Windows.
- Build and launch the unpacked application on a Windows x64 GitHub-hosted
  runner, using the same offline persistence and lifecycle smoke contract.
- Validate PE architecture, executable metadata, installer existence, and
  install/uninstall behavior.

### B3. Windows trust gate

- Support externally supplied Authenticode credentials and timestamping.
- Treat unsigned CI output as proof artifacts only, not release candidates.
- Record SmartScreen/reputation as a product-distribution concern distinct from
  signature validity.

### Windows exit criteria

- The native Windows x64 workflow passes and retains the installer plus proof.
- Install, launch, persistence, second-instance behavior, uninstall, keyboard,
  audio, controller, and display scaling are checked on physical Windows 10/11
  hardware.
- A signed installer passes Authenticode verification before public release.

## Evidence and remaining external gates

Automated evidence belongs under `docs/` as machine-readable JSON or in the CI
run artifacts. The Apple Developer certificate/notarization credentials,
Windows signing certificate, and physical-device/controller checks are external
release gates. They must remain visibly open until their evidence exists.

### Local Apple silicon proof — 2026-07-13

- Passed 157 unit tests, 12 browser E2E tests, typecheck, lint, production build,
  package metadata verification, and the packaged lifecycle smoke on an Apple
  M5 host.
- Verified an arm64-only executable, macOS 12.0 deployment floor,
  `com.turtleback.sanctuary` bundle identifier, generated Turtleback ICNS, and a
  valid deep ad-hoc signature.
- Verified offline first launch, clean quit/relaunch persistence and autosave,
  second-instance handoff, synthetic system suspend/resume delivery, and
  post-event renderer responsiveness.
- The credentialed Developer ID/notarization workflow and hands-on hardware
  checklist remain open release gates.
