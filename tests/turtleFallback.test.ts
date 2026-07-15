import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SOURCE_ROOT = fileURLToPath(new URL('../src', import.meta.url))
const TURTLE_WRAPPER = resolve(SOURCE_ROOT, 'game/world/turtle/Turtle.tsx')
const WORLD = resolve(SOURCE_ROOT, 'game/world/TurtleWorld.tsx')

describe('monumental turtle ownership', () => {
  it('mounts the production hero behind the stable Turtle wrapper', () => {
    const wrapper = readFileSync(TURTLE_WRAPPER, 'utf8')

    expect(wrapper).toMatch(/from ['"]\.\/MonumentalTurtle['"]/)
    expect(wrapper).toContain('<MonumentalTurtle />')
  })

  it('mounts only the stable Turtle export from TurtleWorld', () => {
    const world = readFileSync(WORLD, 'utf8')

    expect(world).toMatch(/from ['"]\.\/turtle\/Turtle['"]/)
    expect(world).toContain('<Turtle />')
  })
})
