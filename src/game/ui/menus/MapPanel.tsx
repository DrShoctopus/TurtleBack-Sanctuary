import { useEffect, useRef } from 'react'
import { BUILDINGS, DISTRICTS, PATHS, WATER_FEATURES } from '../../config/layout'
import { runtime } from '../../core/runtime'

/** Stylized top-down map of the shell. Bow (direction of travel) is up. */
export function MapPanel() {
  const markerRef = useRef<SVGGElement>(null)
  useEffect(() => {
    const id = window.setInterval(() => {
      const m = markerRef.current
      if (!m) return
      const p = runtime.player.pos
      m.setAttribute('transform', `translate(${p.x}, ${p.z}) rotate(${(-runtime.player.yaw * 180) / Math.PI})`)
    }, 120)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg
        viewBox="-190 -280 380 560"
        style={{ maxHeight: 430, width: '100%' }}
        role="img"
        aria-label="Map of the sanctuary village"
      >
        {/* shell */}
        <ellipse cx={0} cy={0} rx={172} ry={252} fill="rgba(56,92,84,0.35)" stroke="rgba(127,212,193,0.5)" strokeWidth={2} />
        <ellipse cx={0} cy={0} rx={148} ry={224} fill="none" stroke="rgba(127,212,193,0.14)" strokeWidth={1} />
        {/* head marker */}
        <ellipse cx={0} cy={-282} rx={26} ry={20} fill="rgba(96,150,138,0.4)" />
        <text x={0} y={-306} textAnchor="middle" fill="rgba(159,232,211,0.8)" fontSize={11}>
          ⌃ heading
        </text>
        {/* paths */}
        {PATHS.map((line, i) => (
          <polyline
            key={i}
            points={line.map((p) => `${p.x},${p.z}`).join(' ')}
            fill="none"
            stroke="rgba(226,214,180,0.5)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {/* water */}
        {WATER_FEATURES.map((w) => (
          <circle key={w.id} cx={w.x} cy={w.z} r={w.r} fill="rgba(110,180,220,0.55)" />
        ))}
        {/* buildings */}
        {BUILDINGS.map((b) => (
          <g key={b.id}>
            <circle cx={b.x} cy={b.z} r={b.kind === 'cottage' ? 3.4 : 5} fill={b.id === 'home' ? '#f2c894' : '#7fd4c1'} />
            {b.kind !== 'cottage' && (
              <text x={b.x} y={b.z - 9} textAnchor="middle" fill="rgba(234,243,242,0.85)" fontSize={10.5}>
                {b.name}
              </text>
            )}
          </g>
        ))}
        {/* district names */}
        {DISTRICTS.filter((d) => ['gardens', 'residential', 'arts'].includes(d.id)).map((d) => (
          <text key={d.id} x={d.x} y={d.z + 22} textAnchor="middle" fill="rgba(157,180,182,0.6)" fontSize={10} fontStyle="italic">
            {d.name}
          </text>
        ))}
        {/* player marker */}
        <g ref={markerRef}>
          <circle r={5.4} fill="#ffffff" stroke="#0b1620" strokeWidth={1.6} />
          <path d="M 0 -10 L 4 -3 L -4 -3 Z" fill="#ffffff" />
        </g>
      </svg>
    </div>
  )
}
