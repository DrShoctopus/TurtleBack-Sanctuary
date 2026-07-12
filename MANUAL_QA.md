# Manual QA Checklist

Run through this before a release. It complements the automated suites
(`pnpm test`, `pnpm test:e2e`) by covering things that need human eyes or a real
GPU. Tick each item; note the browser and OS used.

Tested on: ______________________  Date: __________

## Movement & camera
- [ ] WASD / arrows move in all directions; diagonal isn't faster
- [ ] Mouse look is smooth; click-to-capture pointer works
- [ ] Pointer lock releases on Esc and restores on resume / clicking the canvas
- [ ] Shift jogs; Space hops; neither destabilizes the capsule
- [ ] Head-bob is subtle and can be disabled
- [ ] Collision is solid against walls, furniture, trees, railings, shell edges
- [ ] Stairs, ramps, and slopes are climbable; no getting stuck
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
- [ ] Low / Medium / High visibly change fidelity and framerate
- [ ] Auto steps quality when framerate drops/rises
- [ ] Bloom toggle and particle-density slider take effect
- [ ] F3 performance overlay appears in dev builds

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
