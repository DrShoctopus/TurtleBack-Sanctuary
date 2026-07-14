export interface DesktopRectangle {
  x: number
  y: number
  width: number
  height: number
}

/** Require a useful portion of a restored window to remain reachable on a current display. */
export function intersectsVisibleDisplay(
  state: DesktopRectangle,
  workAreas: readonly DesktopRectangle[],
): boolean {
  return workAreas.some((area) => {
    const right = Math.min(state.x + state.width, area.x + area.width)
    const bottom = Math.min(state.y + state.height, area.y + area.height)
    const left = Math.max(state.x, area.x)
    const top = Math.max(state.y, area.y)
    return right - left >= 160 && bottom - top >= 120
  })
}
