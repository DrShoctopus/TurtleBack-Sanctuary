import { useEffect, useRef } from 'react'
import { useGame } from '../../state/gameStore'
import { requestPointerLock } from '../../input/pointerLock'
import { startAudio } from '../../audio/AudioManager'

export function TitleScreen() {
  const setPhase = useGame((s) => s.setPhase)
  const device = useGame((s) => s.device)
  const enterRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    enterRef.current?.focus()
  }, [])

  // controller: A anywhere on the title enters
  useEffect(() => {
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent<{ kind: string }>).detail
      if (detail.kind === 'confirm') enter()
    }
    window.addEventListener('menu-nav', onNav)
    return () => window.removeEventListener('menu-nav', onNav)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enter = () => {
    startAudio()
    setPhase('playing')
    // Headless automation cannot hold pointer lock reliably; real browsers
    // capture immediately from this trusted click.
    if (!navigator.webdriver) requestPointerLock()
  }

  return (
    <div className="title-screen layer">
      <div className="title-card">
        <h1>Turtleback Sanctuary</h1>
        <p className="tagline">A slow voyage on the back of an old friend.</p>
        <button ref={enterRef} className="btn primary enter" onClick={enter} data-nav>
          Enter Sanctuary
        </button>
        <div className="hints">
          {device === 'pad' ? (
            <>Left stick — walk · Right stick — look · Ⓐ interact · Ⓨ sanctuary menu</>
          ) : (
            <>WASD — walk · Mouse — look · E — interact · M — sanctuary menu · Esc — pause</>
          )}
          <br />
          Headphones recommended. No goals, no timers — just the sea.
        </div>
      </div>
    </div>
  )
}
