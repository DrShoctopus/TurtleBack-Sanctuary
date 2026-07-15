import { describe, expect, it } from 'vitest'
import { BuildPlan } from '../src/game/village/kit/geometry'
import { buildVillageStoryClusters } from '../src/game/village/dressing/buildStoryClusters'
import { isForestPlacementAllowed } from '../src/game/village/forest/layout'
import {
  SHOWCASE_DISTRICT_IDS,
  VILLAGE_ANCHORS,
  VILLAGE_NAVIGATION_CLEARANCES,
  VILLAGE_PROP_EXCLUSION_ZONES,
  VILLAGE_STORY_CLUSTERS,
  distanceToVillagePath,
  validateVillageDressing,
} from '../src/game/village/dressing/layout'

describe('authored village dressing', () => {
  it('gives every showcase district three anchors and several story clusters', () => {
    for (const district of SHOWCASE_DISTRICT_IDS) {
      expect(
        VILLAGE_ANCHORS.filter((anchor) => anchor.district === district),
        district,
      ).toHaveLength(3)
      expect(
        VILLAGE_STORY_CLUSTERS.filter((cluster) => cluster.district === district).length,
        district,
      ).toBeGreaterThanOrEqual(3)
    }
    expect(VILLAGE_ANCHORS).toHaveLength(21)
    expect(VILLAGE_STORY_CLUSTERS).toHaveLength(28)
  })

  it('keeps clusters outside route, spawn, interaction, and traversal clearances', () => {
    const validation = validateVillageDressing()
    expect(validation).toMatchObject({
      valid: true,
      errors: [],
      anchorCount: 21,
      clusterCount: 28,
    })
    for (const cluster of VILLAGE_STORY_CLUSTERS) {
      expect(distanceToVillagePath(cluster.x, cluster.z), cluster.id).toBeGreaterThanOrEqual(
        cluster.radius + 0.45,
      )
      for (const mask of VILLAGE_NAVIGATION_CLEARANCES) {
        expect(
          Math.hypot(cluster.x - mask.x, cluster.z - mask.z),
          `${cluster.id}/${mask.id}`,
        ).toBeGreaterThanOrEqual(cluster.radius + mask.radius)
      }
    }
  })

  it('publishes the same conservative footprints to vegetation placement', () => {
    expect(VILLAGE_PROP_EXCLUSION_ZONES).toHaveLength(VILLAGE_STORY_CLUSTERS.length)
    for (const cluster of VILLAGE_STORY_CLUSTERS) {
      expect(VILLAGE_PROP_EXCLUSION_ZONES).toContainEqual({
        id: cluster.id,
        x: cluster.x,
        z: cluster.z,
        radius: cluster.radius + 0.5,
      })
      expect(isForestPlacementAllowed(cluster.x, cluster.z, 1.2), cluster.id).toBe(false)
    }
  })

  it('builds all story families into merged, collision-backed geometry', () => {
    const plan = new BuildPlan()
    const stats = buildVillageStoryClusters(plan, () => 10)
    expect(stats).toEqual({ clusters: 28, districts: 7, propFamilies: 21 })
    expect(plan.colliders.length).toBeGreaterThan(30)
    const merged = plan.merge()
    expect(merged.length).toBeGreaterThanOrEqual(14)
    const materials = new Set(merged.map((entry) => entry.mat))
    expect(materials.has('woodDark')).toBe(true)
    expect(materials.has('woodWarm')).toBe(true)
    expect(materials.has('weatheringMoss')).toBe(true)
    expect(materials.has('earthDark')).toBe(true)
    for (const entry of merged) entry.geometry.dispose()
  })
})
