import { readdirSync, readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SOURCE_ROOT = fileURLToPath(new URL('../src', import.meta.url))
const TURTLE_WRAPPER = resolve(SOURCE_ROOT, 'game/world/turtle/Turtle.tsx')
const FALLBACK = resolve(SOURCE_ROOT, 'game/world/turtle/ProceduralTurtleFallback.tsx')
const HERO = resolve(SOURCE_ROOT, 'game/world/turtle/MonumentalTurtle.tsx')
const WORLD = resolve(SOURCE_ROOT, 'game/world/TurtleWorld.tsx')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : []
  })
}

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
    expect(world).not.toContain('ProceduralTurtleFallback')
  })

  it('leaves the old procedural mascot unmounted', () => {
    const consumers = sourceFiles(SOURCE_ROOT)
      .filter((path) => path !== FALLBACK)
      .filter((path) => readFileSync(path, 'utf8').includes('ProceduralTurtleFallback'))

    expect(consumers).toEqual([])

    const mounts = sourceFiles(SOURCE_ROOT).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return source.includes('<ProceduralTurtleFallback') ? [path] : []
    })
    expect(mounts).toEqual([])
    expect(readFileSync(FALLBACK, 'utf8')).toContain('export function ProceduralTurtleFallback()')
    expect(readFileSync(HERO, 'utf8')).toContain('export function MonumentalTurtle()')
  })
})
