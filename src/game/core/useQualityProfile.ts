import { useGame } from '../state/gameStore'
import { useSettings } from '../state/settingsStore'
import { QUALITY_PROFILES, type QualityProfile } from './quality'

/** Reactive render profile for geometry and component topology decisions. */
export function useQualityProfile(): QualityProfile {
  const choice = useSettings((state) => state.graphics.quality)
  const autoQuality = useGame((state) => state.autoQuality)
  return QUALITY_PROFILES[choice === 'auto' ? autoQuality : choice]
}
