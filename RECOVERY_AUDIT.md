# Turtleback Sanctuary Recovery Audit

## Decision

Repair the project; do not restart it.

The repository contains a credible game engine rather than a disposable mock-up: a Rapier first-person controller, analytic 500 × 340 metre terrain and collider, fourteen placed buildings with eleven interior types, seeded landmarks, day/night and weather simulation, procedural Web Audio, typed Zustand persistence, and meaningful test coverage for pure logic. Rebuilding would throw away the strongest parts.

The project had instead become a feature-rich prototype presented as a finished release. The rescue therefore separates three concerns:

1. restore a reproducible green build and browser suite;
2. repair controls whose UI did not affect runtime behaviour;
3. preserve the engine while replacing prototype presentation with a premium art layer.

## Initial rescue completed

- Restored strict TypeScript production builds and clean ESLint output.
- Repaired the pointer-lock/menu race and made headless browser testing deterministic.
- Repaired the persistence and music-list browser tests.
- Made generated-music Play/Pause and mood selection control the actual engine.
- Preserved room-speaker position and mode across lazy audio initialization.
- Connected YouTube volume changes to the iframe player command channel.
- Added the missing physical television screen to the player home.
- Made rain intensity scale both visible rain and accumulated wetness.
- Prevented shared interior furniture materials from being globally rain-darkened.
- Made breathing mode capture player movement/look and accept controller dismissal.
- Expanded quiet mode to reduce nonessential HUD, birds, wind, and ambient activity.
- Connected home blind and accent-theme controls to visible scene elements.
- Fixed coplanar window glow placement.
- Replaced opaque rectangular grass/flower cards with shaped procedural geometry.
- Added restrained bloom, a night aurora system, aurora water colour, and calm lapping foam bands around the shell edge.
- Split the heavy physics runtime into a separately cacheable production chunk.

## Remaining release blockers

### Visual quality

- Most architecture and props still use sharp primitive geometry without the bevel, trim, silhouette, normal, roughness, and AO quality required by the original brief.
- District composition is sparse and lacks a consistent foreground/midground/background dressing pass.
- Bridges, meaningful stairs, ramps, and several promised shell formations need purpose-built assets.
- The turtle, landmarks, and vegetation require dedicated silhouette and animation polish.
- High-end material response and texture-density standards are not yet applied consistently.

### Interaction and media

- The YouTube iframe remains a fullscreen DOM interface; it is not perspective-aligned to the in-world television.
- Uploader-disabled embed detection cannot be guaranteed by a plain cross-origin iframe.
- Several relaxation interactions still provide audio/toast feedback without a world-state animation.
- Local file-handle persistence helpers are not yet wired into the player UI.

### Quality and verification

- No current manual Chrome/Firefox/Safari/controller matrix has been recorded.
- Movement, collision, building reachability, audio zones, and long-session performance need integration or repeatable manual tests.
- The Rapier runtime remains the dominant download chunk and should be profiled against the first-interaction loading target.
- This folder is not currently a Git worktree. Before it is treated as the canonical copy, initialize version control or restore its missing `.git` metadata and make a backup.

## Source-of-truth rule

README feature claims must follow verified runtime behaviour. A checkbox in `MANUAL_QA.md` is evidence only after it has a browser, OS, date, and tester result.
