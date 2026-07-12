/** Interaction handlers shared by buildings and props. All optional, all calm. */
import { events } from '../core/events'
import { runtime } from '../core/runtime'
import { useGame } from '../state/gameStore'
import { useSettings } from '../state/settingsStore'
import { exitPointerLock } from '../input/pointerLock'
import { setMusicPreview } from '../audio/proceduralMusic/engineHandle'

function openOverlay(overlay: 'tv' | 'music' | 'journal' | 'reading'): void {
  useGame.getState().setOverlay(overlay)
  exitPointerLock()
  events.emit('uiSound', { kind: 'open' })
}

export const openTv = () => openOverlay('tv')
export const openMusic = () => openOverlay('music')
export const openJournal = () => openOverlay('journal')
export const openReading = () => openOverlay('reading')

// --- tea & coffee -----------------------------------------------------------

let brewTimer = 0

export const brewDrink = {
  label(kind: 'tea' | 'coffee'): string {
    const phase = useGame.getState().teaPhase
    const name = kind === 'coffee' ? 'coffee' : 'tea'
    if (phase === 'brewing') return `The ${name} is steeping…`
    if (phase === 'ready') return `Take the ${name}`
    if (phase === 'holding') return `Brew another ${name}`
    return kind === 'coffee' ? 'Brew a cup of coffee' : 'Put the kettle on'
  },
  use(kind: 'tea' | 'coffee'): void {
    const g = useGame.getState()
    const name = kind === 'coffee' ? 'coffee' : 'tea'
    if (g.teaPhase === 'brewing') return
    if (g.teaPhase === 'ready') {
      g.setTeaPhase('holding')
      g.notify(`Warm ${name} in hand ☕`)
      events.emit('interactSound', { kind: 'tea' })
      window.clearTimeout(brewTimer)
      brewTimer = window.setTimeout(() => useGame.getState().setTeaPhase('idle'), 150000)
      return
    }
    g.setTeaPhase('brewing')
    g.notify(kind === 'coffee' ? 'The espresso machine hums…' : 'The kettle begins to murmur…')
    events.emit('interactSound', { kind: 'tea' })
    window.clearTimeout(brewTimer)
    brewTimer = window.setTimeout(() => {
      useGame.getState().setTeaPhase('ready')
      useGame.getState().notify(`Your ${name} is ready`)
      events.emit('interactSound', { kind: 'chime' })
    }, 7000)
  },
}

// --- plants ------------------------------------------------------------------

const plantLines = [
  'The leaves glisten, grateful.',
  'A soft green smell rises.',
  'The ferns perk up a little.',
  'Water beads roll off the moss.',
]
let plantIdx = 0

export function waterPlants(): void {
  events.emit('interactSound', { kind: 'water' })
  useGame.getState().notify(plantLines[plantIdx++ % plantLines.length])
}

// --- shop browsing -----------------------------------------------------------

const goodsLines = [
  'Hand-thrown mugs, still smelling of the kiln.',
  'Sea-glass bottles in every shade of calm.',
  'Folded linens, warm from the window sun.',
  'Tiny turtle figurines. Of course.',
  'Jars of shell-flower honey from the gardens.',
  'A record sleeve with no name, only a wave.',
]
let goodsIdx = 0

export function browseGoods(): void {
  events.emit('uiSound', { kind: 'soft' })
  useGame.getState().notify(goodsLines[goodsIdx++ % goodsLines.length])
}

// --- home blinds ---------------------------------------------------------------

export const cycleBlinds = {
  label(): string {
    const b = useSettings.getState().home.blinds
    return b < 0.25 ? 'Lower the blinds halfway' : b < 0.75 ? 'Close the blinds' : 'Open the blinds'
  },
  use(): void {
    const s = useSettings.getState()
    const next = s.home.blinds < 0.25 ? 0.5 : s.home.blinds < 0.75 ? 1 : 0
    s.set('home', { blinds: next })
    events.emit('interactSound', { kind: 'generic' })
  },
}

// --- sleep -----------------------------------------------------------------

export function sleepUntilDawn(): void {
  const g = useGame.getState()
  g.setFade(true)
  events.emit('uiSound', { kind: 'soft' })
  window.setTimeout(() => {
    const s = useSettings.getState()
    if (s.time.auto) {
      runtime.time.t = 0.272
    } else {
      s.set('time', { manual: 0.272 })
    }
    g.notify('You rest deeply. Dawn light spills across the water.')
    window.setTimeout(() => g.setFade(false), 600)
  }, 900)
}

// --- record shop listening station -----------------------------------------

const PREVIEW_ORDER = ['dawn', 'day', 'rain', 'night'] as const
let previewIdx = 0

export function previewMusic(): void {
  const state = PREVIEW_ORDER[previewIdx++ % PREVIEW_ORDER.length]
  setMusicPreview(state)
  events.emit('uiSound', { kind: 'confirm' })
  useGame.getState().notify(`Now sampling: “${state}” side`)
}

// --- wind chimes -------------------------------------------------------------

export function ringChime(): void {
  events.emit('interactSound', { kind: 'chime' })
}
