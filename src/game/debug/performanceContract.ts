export const GRAPHICS_PERFORMANCE_CONTRACT = Object.freeze({
  high: Object.freeze({
    referenceId: 'high-dedicated',
    viewport: Object.freeze({ width: 1920, height: 1080 }),
    maxP95FrameMs: 16.7,
  }),
  low: Object.freeze({
    referenceId: 'low-integrated',
    viewport: Object.freeze({ width: 1920, height: 1080 }),
    maxP95FrameMs: 33.3,
  }),
  soak: Object.freeze({
    durationMs: 30 * 60_000,
    finalWindowMs: 20 * 60_000,
    maxMemoryGrowthPercent: 10,
    maxCellTransitionsPerMinute: 18,
  }),
})
