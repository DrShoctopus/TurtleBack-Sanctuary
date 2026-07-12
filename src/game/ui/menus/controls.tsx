import type { ReactNode } from 'react'

export function Row(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field-row">
      <label>
        {props.label}
        {props.hint && <span className="hint">{props.hint}</span>}
      </label>
      {props.children}
    </div>
  )
}

export function Toggle(props: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={props.value}
      aria-label={props.label}
      data-nav
      onClick={() => props.onChange(!props.value)}
    />
  )
}

export function Slider(props: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  label: string
  format?: (v: number) => string
}) {
  const { min = 0, max = 1, step = 0.05 } = props
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {props.format && (
        <span style={{ color: 'var(--c-text-dim)', fontSize: '0.8em', minWidth: 42, textAlign: 'right' }}>
          {props.format(props.value)}
        </span>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={props.value}
        aria-label={props.label}
        data-nav
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </span>
  )
}

export function Seg<T extends string>(props: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  label: string
}) {
  return (
    <span className="seg" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={props.value === o.value}
          className={props.value === o.value ? 'active' : ''}
          data-nav
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}
