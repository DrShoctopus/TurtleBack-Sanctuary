import { useRef, useState } from 'react'
import { useMedia } from '../../state/mediaStore'
import { useGame } from '../../state/gameStore'
import { closeOverlay } from '../UIRoot'
import { useMenuNav } from '../menus/useMenuNav'

/** A private, local-only journal. Nothing leaves the device. */
export function JournalOverlay() {
  const ref = useRef<HTMLDivElement>(null)
  const entries = useMedia((s) => s.journal)
  const add = useMedia((s) => s.addJournal)
  const remove = useMedia((s) => s.removeJournal)
  const notify = useGame((s) => s.notify)
  const [text, setText] = useState('')

  useMenuNav(ref, { onBack: () => closeOverlay(), autoFocus: false })

  const save = () => {
    const t = text.trim()
    if (!t) return
    add(t)
    setText('')
    notify('Saved to your journal')
  }

  return (
    <div className="layer top">
      <div ref={ref} className="menu-shell" role="dialog" aria-modal="true" aria-label="Journal" style={{ width: 'min(600px, calc(100vw - 3rem))' }}>
        <div className="menu-head">
          <h2>Journal</h2>
          <div className="spacer" />
          <button className="btn small ghost" data-nav aria-label="Close" onClick={() => closeOverlay()}>✕</button>
        </div>
        <div className="menu-body">
          <textarea
            className="journal-input"
            placeholder="A quiet thought, a note to your future self…"
            value={text}
            rows={4}
            onChange={(e) => setText(e.target.value)}
            aria-label="New journal entry"
            data-nav
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn primary" data-nav onClick={save} disabled={!text.trim()}>Save entry</button>
          </div>
          {entries.length > 0 && (
            <>
              <h3>Past entries</h3>
              <ul className="journal-list">
                {entries.map((e) => (
                  <li key={e.id}>
                    <div className="journal-date">{new Date(e.at).toLocaleString()}</div>
                    <div className="journal-text">{e.text}</div>
                    <button className="btn small ghost" data-nav aria-label="Delete entry" onClick={() => remove(e.id)}>✕</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="menu-foot"><span>Stored only on this device. Clear anytime in Sanctuary → Data.</span></div>
      </div>
    </div>
  )
}
