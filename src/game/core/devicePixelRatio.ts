import { useEffect, useState } from 'react'

export type DevicePixelRatioSource = Pick<
  Window,
  'devicePixelRatio' | 'addEventListener' | 'removeEventListener' | 'matchMedia'
>

function readDevicePixelRatio(source: DevicePixelRatioSource): number {
  const value = source.devicePixelRatio
  return Number.isFinite(value) && value > 0 ? value : 1
}

/**
 * Observe browser zoom and monitor-density changes. The resolution query must
 * be rebuilt after every change because it describes the previous DPR.
 */
export function subscribeToDevicePixelRatio(
  source: DevicePixelRatioSource,
  onChange: (devicePixelRatio: number) => void,
): () => void {
  let active = true
  let resolutionQuery: MediaQueryList | null = null

  const rearm = () => {
    if (!active) return
    resolutionQuery?.removeEventListener('change', rearm)
    const devicePixelRatio = readDevicePixelRatio(source)
    resolutionQuery = source.matchMedia(`(resolution: ${devicePixelRatio}dppx)`)
    resolutionQuery.addEventListener('change', rearm)
    onChange(devicePixelRatio)
  }

  source.addEventListener('resize', rearm)
  rearm()

  return () => {
    active = false
    source.removeEventListener('resize', rearm)
    resolutionQuery?.removeEventListener('change', rearm)
    resolutionQuery = null
  }
}

/** Reactive device DPR for R3F canvas sizing. */
export function useDevicePixelRatio(): number {
  const source = typeof window === 'undefined' ? null : window
  const [devicePixelRatio, setDevicePixelRatio] = useState(() =>
    source ? readDevicePixelRatio(source) : 1,
  )

  useEffect(() => {
    if (!source) return
    return subscribeToDevicePixelRatio(source, setDevicePixelRatio)
  }, [source])

  return devicePixelRatio
}
