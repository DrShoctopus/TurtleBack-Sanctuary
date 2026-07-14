/**
 * Registry of shader uniform blocks that respond to rain wetness.
 * WeatherSystem pushes runtime.weather.wetness into each registered uniform set.
 */

interface WetUniforms {
  wetness: { value: number }
}

const registered = new Set<WetUniforms>()

export function registerWeatherMaterial(uniforms: WetUniforms): void {
  registered.add(uniforms)
}

export function updateWetness(value: number): void {
  for (const u of registered) u.wetness.value = value
}
