import { useMemo, useRef } from 'react'
import { closeOverlay } from '../UIRoot'
import { useMenuNav } from '../menus/useMenuNav'
import { mulberry32 } from '../../core/rng'
import { runtime } from '../../core/runtime'

/**
 * The bookshop reading nook: short, original, public-domain-style calming
 * passages generated from word banks. No copyrighted text.
 */
export function ReadingOverlay() {
  const ref = useRef<HTMLDivElement>(null)
  useMenuNav(ref, { onBack: () => closeOverlay(), autoFocus: false })
  const passage = useMemo(() => generatePassage(Math.floor(runtime.travel.distance) ^ 0x1234), [])

  return (
    <div className="layer top">
      <div ref={ref} className="menu-shell reading-shell" role="dialog" aria-modal="true" aria-label="Reading">
        <div className="menu-head">
          <h2>{passage.title}</h2>
          <div className="spacer" />
          <button className="btn small ghost" data-nav aria-label="Close book" onClick={() => closeOverlay()}>✕</button>
        </div>
        <div className="menu-body reading-body">
          {passage.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="menu-foot"><span>From the sanctuary’s own shelves. Esc / Ⓑ to close.</span></div>
      </div>
    </div>
  )
}

const TITLES = ['On Stillness', 'The Slow Tide', 'A Field of Salt', 'Notes for a Quiet Hour', 'The Turtle’s Patience', 'Weather From a Window']
const OPENERS = [
  'There is a kind of quiet that only arrives by water,',
  'Somewhere beneath us the great one moves,',
  'The morning comes in colors we have no names for,',
  'To rest is not to stop, the old book says,',
  'When the rain begins, the village softens,',
]
const MIDDLES = [
  'and the hours grow round and unhurried.',
  'carrying the whole small town like a held breath.',
  'and every window becomes a small, warm lamp.',
  'only to turn and face the sea more gently.',
  'as if the sky had leaned down to listen.',
]
const CLOSERS = [
  'Stay as long as you like. The horizon is in no hurry.',
  'Nothing here asks anything of you.',
  'You may leave and return; the sea keeps your place.',
  'Breathe out. The tide will do the rest.',
  'Rest here. You have already arrived.',
]

function generatePassage(seed: number) {
  const rng = mulberry32(seed >>> 0)
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)]
  const paras: string[] = []
  for (let i = 0; i < 3; i++) {
    paras.push(`${pick(OPENERS)} ${pick(MIDDLES)} ${pick(CLOSERS)}`)
  }
  return { title: pick(TITLES), paragraphs: paras }
}
