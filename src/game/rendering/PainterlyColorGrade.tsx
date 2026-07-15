import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BrightnessContrastEffect, HueSaturationEffect } from 'postprocessing'
import { runtime } from '../core/runtime'
import { createPainterlyEnvironmentSample, samplePainterlyEnvironment } from './painterlyPalette'

/** Restrained full-scene grade; both effects merge into the composer's single effect pass. */
export function PainterlyColorGrade() {
  const brightnessContrast = useMemo(() => new BrightnessContrastEffect(), [])
  const hueSaturation = useMemo(() => new HueSaturationEffect(), [])
  const sample = useMemo(() => createPainterlyEnvironmentSample(), [])

  useFrame(() => {
    samplePainterlyEnvironment(sample, runtime.time.t, runtime.weather.rain)
    brightnessContrast.brightness = sample.brightness
    brightnessContrast.contrast = sample.contrast
    hueSaturation.saturation = sample.saturation
  })

  useEffect(
    () => () => {
      brightnessContrast.dispose()
      hueSaturation.dispose()
    },
    [brightnessContrast, hueSaturation],
  )

  return (
    <>
      <primitive object={brightnessContrast} />
      <primitive object={hueSaturation} />
    </>
  )
}
