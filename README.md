# Turtleback Sanctuary

A calming, nonviolent, first-person exploration game set in a surreal modern village built on the back of a colossal sea turtle. She swims steadily through an endless ocean while you wander warm coastal streets, step into fully furnished homes and shops, watch the weather change, listen to an original generative soundtrack, and rest. There are no goals, timers, enemies, or failure states — only the sea.

Most of the sanctuary is authored in TypeScript and generated at runtime —
architecture, terrain, procedural textures, the giant turtle, the ocean and sky,
and the lo-fi music. The repository also ships original project-generated
GLB/KTX2 pipeline fixtures and the Three.js Basis decoder runtime so the authored
asset path is exercised in browsers and packaged Electron. No third-party art,
audio samples, or fonts are bundled. See [ASSET_LICENSES.md](ASSET_LICENSES.md).

> **Project status:** the core game is playable and the initial rescue pass is complete, but the world-wide premium art pass is still in progress. The engine and interactions are being preserved; procedural geometry, materials, lighting, district dressing, and performance LODs are being upgraded systematically. See [RECOVERY_AUDIT.md](RECOVERY_AUDIT.md) and [GRAPHICS_ROADMAP.md](GRAPHICS_ROADMAP.md).

---

## Quick start

Requires **Node 20+**. [pnpm](https://pnpm.io) is recommended; npm works too.

```bash
pnpm install      # or: npm install
pnpm dev          # start the dev server → http://localhost:5173
pnpm build        # validate assets + type-check + production build → dist/
pnpm test         # run the unit test suite (Vitest)
pnpm validate:assets # verify the authored-asset manifest and license ledger
```

With npm, substitute `npm run`:

```bash
npm install
npm run dev
npm run build
npm test
```

Then open **http://localhost:5173** and click **Enter Sanctuary**. (The click is required — browsers only allow audio to start after a user gesture.)

### Electron desktop development

Phases 1 and 2 of the desktop conversion are complete for engineering and
unsigned native proof, targeting macOS on Apple silicon first and Windows x64
second. The secure Electron shell, durable application-profile persistence,
native local-audio folder access, lifecycle recovery, branded platform packages,
installers, and native CI verification are documented in the
[Phase 1 plan](docs/phase-1-electron-vertical-slice.md),
[Phase 2 release-readiness plan](docs/phase-2-release-readiness.md), and
[native CI proof](docs/phase-2-native-ci-proof.json). Public release candidates
still require external signing credentials and the physical-device checklists.

```bash
pnpm desktop:dev      # Vite renderer + sandboxed Electron window
pnpm desktop:build    # renderer + bundled main/preload production outputs
pnpm desktop:package  # unpacked platform application → release/
pnpm desktop:package:mac # unpacked macOS arm64 application → release/mac-arm64/
pnpm desktop:release:mac # signed/notarized arm64 DMG + ZIP (credentials required)
pnpm desktop:verify:mac  # verify local bundle identity, icon, OS floor, architecture
pnpm desktop:package:win # unpacked Windows x64 application → release/win-unpacked/
pnpm desktop:installer:win # unsigned Windows x64 NSIS proof installer
pnpm desktop:release:win # signed Windows x64 NSIS installer (credentials required)
pnpm desktop:smoke    # verify the existing unpacked app offline
pnpm desktop:measure  # smoke + fixed 60-second frame/process sample
```

### All commands

| Command                          | What it does                                         |
| -------------------------------- | ---------------------------------------------------- |
| `pnpm dev`                       | Vite dev server with HMR                             |
| `pnpm build`                     | Asset validation, strict type-check, then Vite build |
| `pnpm preview`                   | Serve the production build locally                   |
| `pnpm test`                      | Vitest unit tests                                    |
| `pnpm test:watch`                | Vitest in watch mode                                 |
| `pnpm test:e2e`                  | Playwright browser tests (see [Testing](#testing))   |
| `pnpm typecheck`                 | Strict TypeScript check only                         |
| `pnpm lint`                      | ESLint                                               |
| `pnpm format`                    | Prettier                                             |
| `pnpm validate:assets`           | Validate all registered asset files and licenses     |
| `pnpm validate:assets:rendering` | Validate only the rendering asset slice              |
| `pnpm validate:assets:final`     | Require final provenance for every asset             |
| `pnpm desktop:dev`               | Vite renderer in the sandboxed Electron shell        |
| `pnpm desktop:build`             | Renderer plus main/preload production bundles        |
| `pnpm desktop:package`           | Unpacked desktop app in `release/`                   |
| `pnpm desktop:package:mac`       | Unpacked macOS arm64 app in `release/mac-arm64/`     |
| `pnpm desktop:release:mac`       | Strict signed/notarized macOS arm64 DMG + ZIP        |
| `pnpm desktop:verify:mac`        | Verify local macOS bundle metadata and arm64 binary  |
| `pnpm desktop:package:win`       | Cross-package unpacked Windows x64 app               |
| `pnpm desktop:installer:win`     | Build unsigned Windows x64 NSIS proof installer      |
| `pnpm desktop:release:win`       | Build signed Windows x64 NSIS release installer      |
| `pnpm desktop:smoke`             | Offline packaged-app quit/relaunch smoke             |
| `pnpm desktop:measure`           | Smoke plus 60-second frame/process sample            |

---

## Controls

### Keyboard & mouse

| Input                | Action                                         |
| -------------------- | ---------------------------------------------- |
| **W A S D** / arrows | Move                                           |
| **Mouse**            | Look (click the canvas to capture the pointer) |
| **Shift**            | Gentle jog                                     |
| **Space**            | Small hop                                      |
| **E**                | Interact                                       |
| **M**                | Sanctuary menu (time, weather, settings)       |
| **Tab**              | Map                                            |
| **H**                | Return home                                    |
| **Esc**              | Pause / release pointer                        |
| **F3**               | Performance overlay (dev builds only)          |

### Gamepad (Xbox / PlayStation / generic dual-stick)

Press any button to connect; on-screen prompts switch to controller glyphs automatically.

| Input                     | Action             |
| ------------------------- | ------------------ |
| **Left stick**            | Move               |
| **Right stick**           | Look               |
| **Ⓐ / Cross**             | Interact / confirm |
| **Ⓑ / Circle**            | Back / cancel      |
| **Ⓧ / Square**            | Hop / secondary    |
| **Ⓨ / Triangle**          | Sanctuary menu     |
| **L3 (left stick click)** | Jog                |
| **D-pad**                 | Menu navigation    |
| **Select**                | Map                |
| **Start / Options**       | Pause              |
| **LB / RB**               | Switch menu tabs   |

Look sensitivity, stick deadzone, invert-Y, and (where supported) subtle vibration are all adjustable in **Sanctuary → Controls**.

---

## Browser requirements

- **WebGL 2** is required. Current desktop **Chrome, Edge, Firefox, and Safari** all qualify. A friendly message appears if WebGL 2 is unavailable (often because hardware acceleration is disabled).
- Designed for desktop/laptop. Pointer Lock, the Gamepad API, and the File System Access API are used when available and degrade gracefully when not.

---

## Features

- A **450–550 m × 300–380 m** walkable turtle shell with ridges, valleys, gardens, stairs, bridges, ponds, and shell-edge viewing decks. It takes several minutes to cross.
- Six continuously blended habitat regions — Crownwood, Blossomshade, Lumenfen, Fernfall, Galecrest, and Hearth Commons — with distinct canopy, understory, geology, atmosphere, and discovery silhouettes.
- A living, animated **giant turtle** — head, neck, blinking eyes, stroking flippers, foam and wake — with an endless-travel illusion that never moves the physics world.
- **Ten+ enterable buildings**, each with a distinct exterior, interior, furniture, lighting, and at least one calming interaction, plus a fully designed **player home**.
- Continuous **day/night cycle** (24-minute default) and **clear ↔ gentle rain** weather, both fully player-controllable with smooth 6–10 s crossfades.
- An **original, seeded adaptive lo-fi soundtrack** with seven long-form musical sections, four instrumentation palettes, biome/turtle accents, and dawn / day / rain / night colour — plus a layered ambient soundscape with indoor/outdoor audio zones, all synthesized with the Web Audio API.
- A home **television** that plays YouTube videos through the official embed, a **music player** (built-in tracks, your local files, direct radio URLs), a private **journal**, and more.
- Eight seeded, pooled **distant landmarks** (moon gates, a striding lighthouse, jellyfish processions, a floating station, a whale constellation, mirror cities…) that drift past on the horizon.
- A deterministic, quality-budgeted **wildlife ecology** spanning songbirds, shell hares, pollinators, wetland insects, seabirds, ocean rays, a gentle grazer, and a wading bird—always calm, habitat-bound, and nonviolent.
- Deep **accessibility & comfort** options: reduced motion, head-bob / sway toggles, FOV, UI scale, high-contrast prompts, subtitles, separate volume buses, and more.

---

## How YouTube embedding works

The living-room TV plays videos through YouTube's **official IFrame embed** on the privacy-enhanced `youtube-nocookie.com` host. The game **never** downloads, scrapes, proxies, records, or restreams video, and it never bypasses ads or platform controls.

- Paste any normal watch URL, `youtu.be` link, embed URL, or Shorts URL — or a bare 11-character video ID. Timestamps (`?t=90`, `?t=1h2m3s`) are honored.
- The parsed ID is validated before it's ever handed to the embed.
- No YouTube Data API key is required, and there is no search (adding one would require a key you supply yourself).
- Only recent **video IDs and stub titles** are stored, locally on your device. No viewing analytics are collected.
- If a video's uploader has disabled embedding, the player shows a gentle message; the rest of the game is unaffected.

## How to add local music

Open the home stereo → **Your files**. Click **Add audio files…** to pick common browser-playable formats (mp3, m4a, aac, ogg, opus, wav, flac).

- Files play locally through a native `<audio>` element and are **never uploaded**.
- In the Electron app, you choose a folder once. The main process retains only the folder registration, scans supported files, and gives the renderer opaque playback URLs; absolute filesystem paths are never exposed to game code.
- On browsers with the **File System Access API**, its native picker is used for the current session. Handles are not persisted.
- On other browsers, a standard file picker is used; those files are likewise available only for the current session.

## How to add radio stations

Open the home stereo → **Radio**. Enter an optional station name and a **direct `https://` audio-stream URL**, then **Save station**.

- Only secure `https` URLs are accepted (mixed-content and privacy). `http`, `file:`, `data:`, `javascript:`, loopback/`.local` hosts, and URLs with embedded credentials are rejected with a clear message.
- Browser builds play streams directly through a native `<audio>` element. The Electron app exchanges the remote URL for an opaque local playback URL and streams through a DNS-checked, IP-pinned main-process relay; no third-party proxy is used.
- Some stations block cross-origin browser playback or don't expose track titles. That is a station limitation, not a bug, and the game says so.
- A starter template lives at [`public/config/radio-stations.example.json`](public/config/radio-stations.example.json). It intentionally contains no real endpoints — add your own licensed streams.

## Browser limitations for radio & local files

- **Radio**: browser CORS/mixed-content rules mean many public streams won't play, and title metadata is usually unavailable. This is expected. No test in this project depends on any public station staying online.
- **Local files**: browsers cannot silently retain access to your files between visits. With the File System Access API, access can be re-requested; otherwise you re-pick files each session.

---

## Extending the game

Everything below is designed to be extended without touching the engine core.

### Adding professionally produced original music

The real-time procedural engine always works with no assets present. To layer in produced tracks:

1. Drop original, properly licensed audio into `public/audio/music/` (see [MUSIC_PRODUCTION.md](MUSIC_PRODUCTION.md)).
2. Reference them from your configuration and route them through the media player's `media` bus.

Do **not** add copyrighted music. See [MUSIC_PRODUCTION.md](MUSIC_PRODUCTION.md) for the full replacement path and a documented offline-render approach.

### Adding new landmarks

Landmarks live in `src/game/world/landmarks/`. Add a type name to `LANDMARK_TYPES` in `schedule.ts`, then add a matching builder function to the `BUILDERS` map in `Landmarks.tsx` (return a `THREE.Group`; optionally attach a `userData.update` animation callback). The seeded scheduler and object pool pick it up automatically.

### Adding new buildings

Building interiors are data-driven functions in `src/game/village/buildings/interiors.ts` that compose from the geometry kit (`kit/geometry.ts`, `kit/props.ts`) and the shell builder (`buildings/shellKit.ts`). Add a `BuildingSpec` to `src/game/config/layout.ts` and, for a new kind, an entry in `INTERIORS`. See [ARCHITECTURE.md](ARCHITECTURE.md).

### Adding new interaction types

Interactions are a typed registry, not name checks. Register one with `registerInteraction({ id, label, position, radius, onUse })` (see `src/game/interaction/InteractionSystem.tsx`). Buildings map their interior `InteractionSpec`s to handlers in `Building.tsx`; shared handlers live in `src/game/activities/handlers.ts`.

---

## Performance settings

Quality presets (**Auto / Low / Medium / High / Ultra**) live in **Sanctuary →
Graphics** and control internal resolution, device pixel ratio, shadows, texture
tier and LOD bias, cell residency, ocean/cloud/atmosphere detail, rain,
vegetation and wildlife density, landmarks, reflections, lights, and bloom
eligibility. **Auto** uses p95 frame time with cooldowns and sustained-headroom
hysteresis; it is intentionally capped at High. Ultra is explicit opt-in until
named release hardware proves enough headroom. The design targets are 60 FPS at
1080p on the reference dedicated GPU and a stable 30 FPS on the reference
integrated GPU; those targets still require recorded reference-hardware passes.
The **F3** overlay is development-only. The `window.__turtlebackDebug`
probe/failure-injection seam is available in development or a build made with
`VITE_TURTLEBACK_DIAGNOSTICS=1`; ordinary production builds do not install the
diagnostic globals.

## Accessibility settings

**Sanctuary → Comfort** and **→ Controls** include: reduced motion (with an OS-preference default), head-bob / turtle-sway / camera-sway toggles, adjustable mouse and gamepad sensitivity, invert-Y, adjustable FOV and UI scale, high-contrast interaction prompts, an optional center dot, hold-vs-tap interaction, sound captions for meaningful audio, separate volume sliders, and a mute-all. There are no rapidly flashing effects; strong post-processing is opt-in.

## Asset-license policy

Only original, procedurally generated, or explicitly redistributable (CC0 /
documented) assets are used. Authored files are registered in
`src/game/assets/manifest.json` with provenance, hashes, encoded/decoded sizes,
quality/LOD variants, and a deterministic fallback. The current binary fixtures
are project-generated GLB/KTX2 files; the Basis transcoder files are licensed
Three.js dependency runtime data, not third-party art. Run
`pnpm validate:assets` to verify registry shape, file hashes and sizes, format
magic, generation records, and the synchronized rows in
[ASSET_LICENSES.md](ASSET_LICENSES.md).

Asset paths in the manifest are relative and are resolved from
`document.baseURI`. The same records therefore load below browser deployment
subpaths such as `/repo/` and from the packaged app's secure
`app://turtleback/` origin. A failed authored load follows its registered asset
or procedural fallback instead of making the sanctuary depend on network
availability.

---

## Testing

- **Unit tests** (`pnpm test`): the Vitest suite covers renderer security and recovery policy, asset ownership/validation, spatial residency and probes, durable repositories and portable saves, YouTube/URL validation, gamepad math, time/weather, landmarks, settings migration, audio buses, traversal, quality, and music theory.
- **E2E tests** (`pnpm test:e2e`): Playwright flows for app load, the start screen, opening the Sanctuary menu, applying a time preset, toggling rain, settings persistence across reload, keyboard menu navigation, TV URL acceptance/rejection, and radio URL validation. First run needs the browser binary: `pnpm exec playwright install chromium`. Headless WebGL can be flaky on some machines; the render-independent logic is covered by unit tests regardless.
- **Packaged desktop smoke** (`pnpm desktop:smoke`): drives the existing unpacked application with DNS disabled, checks the production security boundary and Rapier title scene, changes settings through the UI, quits cleanly, and verifies persistence/autosave after a full relaunch. Run `pnpm desktop:package` first. `pnpm desktop:measure` adds the fixed 60-second sample documented in [docs/performance-baseline.md](docs/performance-baseline.md).
- **Manual QA**: a full checklist is in [MANUAL_QA.md](MANUAL_QA.md).

## Deployment

The production build is a fully static bundle (`dist/`) deployable to Netlify, Vercel, Cloudflare Pages, or GitHub Pages. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — code structure and system design
- [MANUAL_QA.md](MANUAL_QA.md) — manual test checklist
- [MUSIC_PRODUCTION.md](MUSIC_PRODUCTION.md) — replacing/adding original music
- [DEPLOYMENT.md](DEPLOYMENT.md) — static hosting
- [ASSET_LICENSES.md](ASSET_LICENSES.md) — asset & dependency licensing

## Known browser-specific limitations

- **Safari**: uses the legacy Web Audio `AudioListener` orientation API (handled). A current manual Safari release pass is still required before claiming full parity.
- **Firefox**: the File System Access API is not available, so local-file persistence falls back to per-session picking (handled).
- **All browsers**: internet radio and cross-origin media are subject to the station's CORS and mixed-content policies. YouTube playback uses a fullscreen sanctuary interface rather than projecting the cross-origin iframe onto the 3D television mesh.
- **QA scope**: the automated suites cover application, settings, menu, URL-validation, and media-interface flows. Movement, every building, controller hardware, audio spatialization, and final visual quality still require the checklist in [MANUAL_QA.md](MANUAL_QA.md).
