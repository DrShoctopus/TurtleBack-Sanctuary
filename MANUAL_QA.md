# Manual QA Checklist

Run through this before a release. It complements the automated suites
(`pnpm test`, `pnpm test:e2e`) by covering things that need human eyes or a real
GPU. Tick each item; note the browser and OS used.

Tested on: ______________________ Date: __________

## Phase 1 automated desktop coverage

These items are checked because `pnpm desktop:smoke`, `pnpm desktop:measure`, or
the deliberate packaged crash run verified them on Apple M5 macOS 26.5.1. They
do not replace the unchecked human/hardware passes below.

- [x] Unpacked arm64 app starts with DNS disabled and reaches the Rapier-backed title scene
- [x] Renderer origin is `app://turtleback`; preload bridge exists; `require` and `process` do not
- [x] Real FOV/High UI changes survive coordinated quit and full process relaunch
- [x] Clean quit creates and relaunch lists the `autosave` slot
- [x] Deliberate renderer crash reloads with durable data and a visible recovery notice
- [x] Three rapid renderer crashes stop on the safe screen instead of looping
- [x] Fixed 60-second High/Arrival Overlook sample completes without a renderer console error

## Phase 2 automated desktop coverage

These checks passed in native GitHub-hosted CI against commit `32a0ab0`. They
prove package, installer, and synthetic lifecycle behavior, but not physical
audio, controller, display, or sleep/wake behavior.

- [x] Apple-silicon macOS package is arm64-only, branded, ad-hoc signed, and declares macOS 12.0 plus `com.turtleback.sanctuary`
- [x] Apple-silicon package passes offline launch/relaunch, persistence, second-instance, and synthetic suspend/resume smoke
- [x] Windows installer contains an AMD64 application payload with the expected version metadata
- [x] Windows silent per-user install creates Desktop and Start Menu shortcuts
- [x] Installed Windows app passes offline lifecycle, persistence, second-instance, and synthetic suspend/resume smoke
- [x] Windows silent uninstall removes the application and test shortcuts cleanly

Run URLs and machine-readable results are in
[`docs/phase-2-native-ci-proof.json`](docs/phase-2-native-ci-proof.json).

## Electron desktop manual checks

- [ ] Put the Mac to sleep while playing; wake resumes safely with audio/input in a sane state
- [ ] Change audio output devices while playing and while the app is suspended
- [ ] Close/reopen from the Dock and verify second-instance focus behavior
- [ ] Disconnect/reconnect an external display; the window remains reachable
- [ ] Select a real local-audio folder; relaunch, rescan, seek, and play several supported formats
- [ ] Exercise fullscreen/borderless/windowed transitions on each target display
- [ ] Run at least a 30-minute traversal/rain/interior/media soak and compare memory afterward
- [ ] Repeat packaged play with a controller and verify vibration/disconnect behavior
- [ ] Repeat packaged play on physical Apple-silicon macOS and Windows 10/11 x64 target systems
- [ ] Test Intel macOS, Windows on Arm, and Linux only before expanding the declared support matrix

## Movement & camera

- [ ] WASD / arrows move in all directions; diagonal isn't faster
- [ ] Mouse look is smooth; click-to-capture pointer works
- [ ] Pointer lock releases on Esc and restores on resume / clicking the canvas
- [ ] Shift jogs; Space hops; neither destabilizes the capsule
- [ ] Head-bob is subtle and can be disabled
- [ ] Collision is solid against walls, furniture, trees, railings, shell edges
- [ ] Garden pond bridge is climbable both ways; rails hold and the crown does not snag
- [ ] Observatory ramp and parallel ceremonial stair are climbable both ways
- [ ] Stern stair/landing and bow/east/west deck gangways are climbable both ways
- [ ] Stairs, ramps, and slopes allow diagonal movement, stopping, jogging, and jumping at seams
- [ ] FOV slider changes view; UI scale changes interface size

## Falling & recovery

- [ ] Walking off the shell edge fades and respawns gently ashore (no death screen)
- [ ] "Return Home" (H, and the Sanctuary button) fades and places you at the porch
- [ ] Respawn never drops you at the exact edge you fell from

## Buildings & interiors (enter every one)

- [ ] Player home — living room, kitchen, dining, bedroom, bathroom, study
- [ ] Driftwood Café
- [ ] Tidal Pages (bookshop)
- [ ] Shell Records
- [ ] The Verdant House (greenhouse)
- [ ] Gallery Meridian
- [ ] Warm Springs Bathhouse
- [ ] Stargazer Dome (observatory)
- [ ] Shorelight Goods (store)
- [ ] The Commons (pavilion)
- [ ] The cottages along the quiet path
- [ ] Every major interior has furniture, lighting, and props
- [ ] Doors slide open on approach and never trap the player
- [ ] Windows show the exterior by day; glow warm from outside at night

## Interactions & activities

- [ ] Interaction prompt appears only when looking at something usable
- [ ] Sit on a sofa/chair/bench — camera glides in; stand with E/Esc/Ⓑ
- [ ] Breathing session runs and is dismissible with any input
- [ ] Brew tea/coffee (home & café) — cup becomes ready after a moment
- [ ] Ocean-overlook benches ("Listen to the sea")
- [ ] Observatory telescope zooms; lower it to exit
- [ ] Journal — write, save, and delete a private note
- [ ] Wind chimes ring
- [ ] Water the greenhouse plants
- [ ] Toggle a lamp / gallery lighting
- [ ] Home blinds cycle
- [ ] Quiet mode softens the UI

## Day / night & weather

- [ ] Time advances automatically; slider scrubs sun & moon smoothly
- [ ] Presets (dawn/noon/sunset/night) apply instantly; pause holds time
- [ ] Cycle-speed options (½×–5×) work
- [ ] Night shows stars, moon, warm windows, lamp posts, bioluminescent seams
- [ ] Clear ↔ rain crossfades over several seconds (no instant pop)
- [ ] Rain intensity slider works; particles + ground ripples appear
- [ ] Paths/roofs darken and look wet in rain; dry slowly after
- [ ] Rain sounds crisp outdoors and muffled indoors

## Audio

- [ ] Generative music starts only after "Enter Sanctuary"
- [ ] Music mood shifts with time of day and with rain
- [ ] Ambient ocean/wind/birds present; birds by day, crickets by night
- [ ] Footsteps differ on wood / stone / grass / shell / interior
- [ ] Every volume slider (master/music/ambient/sfx/tv/media) works independently
- [ ] Mute-all silences everything; un-mute restores
- [ ] Tab-away suspends audio; returning resumes it

## Gamepad

- [ ] Pressing a button connects the pad; prompts switch to controller glyphs
- [ ] Left stick moves; right stick looks; deadzone/sensitivity/invert-Y apply
- [ ] Ⓐ interacts, Ⓑ backs, Ⓨ opens Sanctuary, Start pauses
- [ ] All menus fully navigable with the D-pad/stick + Ⓐ/Ⓑ; LB/RB switch tabs
- [ ] Disconnecting the pad shows a message and reverts prompts to keyboard
- [ ] No input drift at rest; input pauses when the tab is inactive

## Media

- [ ] TV accepts watch / youtu.be / embed / Shorts URLs and bare IDs
- [ ] Invalid TV input shows a helpful error (no iframe)
- [ ] A non-embeddable video shows the gentle "can't be embedded" message
- [ ] Recently-watched thumbnails appear and reload on click
- [ ] Music player: built-in tracks play; transport (play/pause/next/prev/shuffle/repeat)
- [ ] Local files: picker adds tracks; they play; nothing uploads
- [ ] Radio: https URL saves & plays; http/invalid is rejected with a message
- [ ] Exiting TV/music offers to restore pointer lock

## Graphics quality

Run the same daylight, rain, and night route at each explicit tier. Capture the
OS/browser, viewport, device pixel ratio, GPU/driver, and the F3/probe values in
your release notes; a SwiftShader capture does not count as a hardware pass.

| Complete | Preset | Visual and residency check                                                                                                                             |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [ ]      | Low    | 512 texture tier, lowest internal scale/density and bounded effects remain coherent; paths, buildings, turtle, and horizon forest keep their identity. |
| [ ]      | Medium | The 1k tier, shadows, denser vegetation/wildlife, weather, ocean, and landmarks add detail without a traversal hitch.                                  |
| [ ]      | High   | The 2k tier, wider active/retained rings, fuller rain/atmosphere/reflections, and High shadows remain stable on named target hardware.                 |
| [ ]      | Ultra  | The explicit 4k/max-density tier is visibly richer, survives the complete route, and is not silently selected by Auto.                                 |

- [ ] Auto responds to p95 frame-time pressure and sustained headroom without
      thrashing; it can resolve Low, Medium, or High but never Ultra
- [ ] Bloom toggle and particle-density slider take effect
- [ ] F3 performance overlay appears in a development build. An explicit
      diagnostics build exposes the probe globals; an ordinary production build
      has no `window.__turtlebackDebug` or `window.__scene`

### Phase A streaming and asset boundary

- [ ] Traverse continuously across two consecutive 50 m cell boundaries and
      return across both. Full-detail vegetation changes only after the
      hysteresis boundary, retained horizon trees preserve the same distant
      forest silhouette, tree collisions do not disappear before they are
      reachable, and there is no one-frame empty ring or React hitch.
- [ ] In a development build, record
      `window.__turtlebackDebug.probe().sections.world` before and after both
      crossings. `centerCell` changes in order, active/retained counts match the
      selected tier, and only discrete transitions are published.
- [ ] In a development or `VITE_TURTLEBACK_DIAGNOSTICS=1` build, call
      `window.__turtlebackDebug.failAsset('model.pipeline-smoke')`, then change
      quality to force a new preload. The call returns `true`, startup/play
      remains usable, and `probe().fallbackAssetIds` contains
      `procedural.debug-box` with no page error. Repeat for
      `texture.pipeline-smoke` and expect `procedural.debug-checker`.
- [ ] For every authored asset that is mounted visibly, perform the same
      injection and confirm its registered fallback has an intentional visible
      appearance (the debug model/checker are magenta), not a hole, invisible
      material, or crash. The current pipeline-smoke fixtures are preload-only,
      so their fallback proof is the readiness mark and probe row above.
- [ ] Trigger and restore WebGL context loss in a development run. One safe
      DevTools snippet is
      `(() => { const g = document.querySelector('canvas')?.getContext('webgl2'); const e = g?.getExtension('WEBGL_lose_context'); e?.loseContext(); setTimeout(() => e?.restoreContext(), 2000); })()`.
      The recovery UI appears, context restoration clears it, the scene becomes
      interactive again, and a subsequent quality change does not strand an
      asset preload or duplicate scene resources.
- [ ] After `pnpm desktop:package`, run `pnpm desktop:smoke` with networking
      unavailable. It must fetch
      `app://turtleback/assets/system/pipeline-smoke.glb` as
      `model/gltf-binary`, the KTX2 as `image/ktx2`, and the Basis JS/WASM/relay
      from the same origin; `authoredReady` is true, both smoke IDs are loaded,
      no fallback ID is present, and coordinated shutdown reports no renderer
      error.
- [ ] At Low, Medium, High, and Ultra, inspect the forest from the same fixed
      overlook and while crossing the two boundaries. Near trees may change
      density/LOD, but the seeded horizon-tree identity and broad silhouette do
      not reshuffle, vanish, or pop into a different forest.

## Accessibility & comfort

- [ ] Reduced Motion disables head-bob, sway, and large screen motion; turtle
      reference frame stays visually stable; sitting camera travel minimized
- [ ] High-contrast prompts, center-dot toggle, hold-vs-tap interaction all work
- [ ] Sound captions appear for rain and other meaningful cues
- [ ] No rapidly flashing effects anywhere

## Persistence & data

- [ ] Settings, audio levels, home decor, journal, stations survive a reload
- [ ] Reset settings / clear media history / clear journal / erase-all work
- [ ] Private-mode or disabled storage doesn't crash the game

## Resilience

- [ ] Works fully with no network (only YouTube/radio are unavailable, gracefully)
- [ ] No game-breaking console errors during a 5-minute play session
- [ ] Unsupported-browser message appears without WebGL 2

## Cross-browser spot check

- [ ] Chrome
- [ ] Edge
- [ ] Firefox
- [ ] Safari
