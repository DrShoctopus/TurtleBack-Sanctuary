import { readdirSync, readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SOURCE_ROOT = fileURLToPath(new URL('../src', import.meta.url))
const TURTLE_WRAPPER = resolve(SOURCE_ROOT, 'game/world/turtle/Turtle.tsx')
const FALLBACK = resolve(SOURCE_ROOT, 'game/world/turtle/ProceduralTurtleFallback.tsx')
const WORLD = resolve(SOURCE_ROOT, 'game/world/TurtleWorld.tsx')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : []
  })
}

describe('procedural turtle fallback ownership', () => {
  it('keeps the procedural fallback behind the stable Turtle wrapper', () => {
    const wrapper = readFileSync(TURTLE_WRAPPER, 'utf8')
    const fallback = readFileSync(FALLBACK, 'utf8')

    expect(wrapper).toMatch(/from ['"]\.\/ProceduralTurtleFallback['"]/)
    expect(wrapper).toContain('<ProceduralTurtleFallback />')
    expect(fallback).toContain('export function ProceduralTurtleFallback()')
  })

  it('mounts only the stable Turtle export from TurtleWorld', () => {
    const world = readFileSync(WORLD, 'utf8')

    expect(world).toMatch(/from ['"]\.\/turtle\/Turtle['"]/)
    expect(world).toContain('<Turtle />')
    expect(world).not.toContain('ProceduralTurtleFallback')
  })

  it('allows no second fallback import or mount', () => {
    const consumers = sourceFiles(SOURCE_ROOT)
      .filter((path) => path !== FALLBACK)
      .filter((path) => readFileSync(path, 'utf8').includes('ProceduralTurtleFallback'))

    expect(consumers).toEqual([TURTLE_WRAPPER])

    const mounts = sourceFiles(SOURCE_ROOT).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return source.includes('<ProceduralTurtleFallback') ? [path] : []
    })
    expect(mounts).toEqual([TURTLE_WRAPPER])
  })
})
