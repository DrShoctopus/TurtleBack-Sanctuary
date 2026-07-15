import { describe, expect, it } from 'vitest'
import { QUALITY_PROFILES } from '@/game/core/quality'
import {
  WildlifeDirector,
  simulateFiveMinuteShowcase,
} from '@/game/world/wildlife/WildlifeDirector'
import {
  SHOWCASE_WILDLIFE_ANCHORS,
  isGroundWildlifeSafe,
  validateShowcaseWildlifeAnchors,
} from '@/game/world/wildlife/habitat'
import type { WildlifeContext } from '@/game/world/wildlife/types'

const clearDay: WildlifeContext = {
  player: [0, 18, -202],
  time: 0.5,
  rain: 0,
  wind: 0.5,
  quietMode: false,
  reducedMotion: false,
}

describe('showcase wildlife habitats', () => {
  it('keeps authored ground agents outside paths, buildings, water, props, and shell hazards', () => {
    expect(validateShowcaseWildlifeAnchors()).toEqual([])
    const hares = SHOWCASE_WILDLIFE_ANCHORS.filter((anchor) => anchor.speciesId === 'shell-hare')
    expect(hares).toHaveLength(4)
    for (const hare of hares) {
      expect(isGroundWildlifeSafe(hare.position[0], hare.position[2], 1.6), hare.id).toBe(true)
    }
    for (const animal of SHOWCASE_WILDLIFE_ANCHORS.filter((anchor) =>
      anchor.speciesId === 'blossom-grazer' || anchor.speciesId === 'lumenfen-heron')) {
      expect(isGroundWildlifeSafe(animal.position[0], animal.position[2], 1.6), animal.id).toBe(true)
    }
  })

  it('authors the first and contrast-driven second wave without runtime asset weight', () => {
    expect(new Set(SHOWCASE_WILDLIFE_ANCHORS.map((anchor) => anchor.habitat))).toEqual(
      new Set([
        'crownwood',
        'shell-meadow',
        'garden-wetland',
        'galecrest',
        'open-ocean',
        'blossomshade',
        'lumenfen',
      ]),
    )
    expect(new Set(SHOWCASE_WILDLIFE_ANCHORS.map((anchor) => anchor.speciesId))).toEqual(
      new Set([
        'crownwood-songbird',
        'shell-hare',
        'blossom-pollinators',
        'lumenfen-insects',
        'galecrest-seabird',
        'shell-ray',
        'blossom-grazer',
        'lumenfen-heron',
      ]),
    )
  })
})

describe('WildlifeDirector', () => {
  it('retains one representative category per habitat on Low', () => {
    const director = new WildlifeDirector(20260712)
    const frame = director.update(0.1, clearDay, QUALITY_PROFILES.low.wildlife)
    expect(frame.categories).toEqual(['canopy', 'coast', 'ground', 'insects', 'ocean', 'wetland'])
    expect(frame.habitats).toEqual([
      'blossomshade',
      'crownwood',
      'galecrest',
      'garden-wetland',
      'lumenfen',
      'open-ocean',
      'shell-meadow',
    ])
    expect(frame.agents.filter((agent) => agent.representation === 'near').length).toBeLessThanOrEqual(10)
    expect(frame.agents.filter((agent) => agent.representation === 'distant').length).toBeLessThanOrEqual(8)
  })

  it('is fixed-tick deterministic across render-frame chunking', () => {
    const a = new WildlifeDirector(808)
    const b = new WildlifeDirector(808)
    let frameA = a.update(0, clearDay, QUALITY_PROFILES.high.wildlife)
    let frameB = b.update(0, clearDay, QUALITY_PROFILES.high.wildlife)
    for (let i = 0; i < 120; i++) frameA = a.update(0.1, clearDay, QUALITY_PROFILES.high.wildlife)
    for (let i = 0; i < 240; i++) frameB = b.update(0.05, clearDay, QUALITY_PROFILES.high.wildlife)
    expect(frameB.tick).toBe(frameA.tick)
    expect(frameB.agents).toEqual(frameA.agents)
  })

  it('uses calm readable nonviolent states and gently flees a nearby player', () => {
    const director = new WildlifeDirector(20260712)
    const frame = director.update(0.1, { ...clearDay, player: [-118, 18, -74] }, QUALITY_PROFILES.high.wildlife)
    const behaviors = new Set(frame.agents.map((agent) => agent.behavior))
    expect(behaviors.has('flee')).toBe(true)
    expect([...behaviors]).not.toContain('attack')
    expect([...behaviors]).not.toContain('pursuit')
    expect([...behaviors]).not.toContain('death')
  })

  it('shelters birds, rests hares, and keeps luminous insects represented in rain/night', () => {
    const director = new WildlifeDirector(20260712)
    const frame = director.update(0.1, { ...clearDay, time: 0.88, rain: 0.72 }, QUALITY_PROFILES.high.wildlife)
    expect(frame.agents.filter((agent) => agent.speciesId === 'crownwood-songbird').every((agent) => agent.behavior === 'perch')).toBe(true)
    expect(frame.agents.some((agent) => agent.speciesId === 'lumenfen-insects' && agent.behavior === 'glow')).toBe(true)
    expect(director.snapshot()).toMatchObject({ rainResponse: 'sheltering', timeResponse: 'night' })
  })

  it('emits only calls owned by currently represented agents', () => {
    const director = new WildlifeDirector(20260712)
    let ownedCalls = 0
    for (let i = 0; i < 2_000; i++) {
      const frame = director.update(0.1, clearDay, QUALITY_PROFILES.high.wildlife)
      const represented = new Set(frame.representedEmitterIds)
      for (const call of frame.calls) {
        expect(represented.has(call.emitterId), call.emitterId).toBe(true)
        ownedCalls++
      }
    }
    expect(ownedCalls).toBeGreaterThan(5)
    expect(director.snapshot().orphanCalls).toBe(0)
  })

  it('reduces calls in Quiet Mode without removing habitat categories', () => {
    const normal = new WildlifeDirector(109)
    const quiet = new WildlifeDirector(109)
    let normalCalls = 0
    let quietCalls = 0
    let quietFrame = quiet.update(0, { ...clearDay, quietMode: true }, QUALITY_PROFILES.high.wildlife)
    for (let i = 0; i < 2_400; i++) {
      normalCalls += normal.update(0.1, clearDay, QUALITY_PROFILES.high.wildlife).calls.length
      quietFrame = quiet.update(0.1, { ...clearDay, quietMode: true }, QUALITY_PROFILES.high.wildlife)
      quietCalls += quietFrame.calls.length
    }
    expect(quietCalls).toBeGreaterThan(0)
    expect(quietCalls).toBeLessThan(normalCalls)
    expect(quietFrame.categories).toEqual(['canopy', 'coast', 'ground', 'insects', 'ocean', 'wetland'])
  })

  it('proves four-plus categories across the canonical five-minute showcase walk', () => {
    const report = simulateFiveMinuteShowcase(20260712, QUALITY_PROFILES.high.wildlife)
    expect(report).toMatchObject({ seconds: 300 })
    expect(report.categories).toEqual(['canopy', 'coast', 'ground', 'insects', 'ocean', 'wetland'])
    expect(report.habitats).toHaveLength(7)
    expect(report.calls).toBeGreaterThan(5)
  })
})
