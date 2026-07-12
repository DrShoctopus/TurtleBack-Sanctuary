/** Seeded generative canvases for the gallery and the player's home. */
import { CanvasTexture, SRGBColorSpace } from 'three'
import { mulberry32 } from '../core/rng'

const PALETTES: string[][] = [
  ['#0e2a3a', '#2d6f6a', '#7fd4c1', '#f2e8d8', '#f2c894'], // tide
  ['#3a2b20', '#a06a3c', '#d8b088', '#f0e2cc', '#7a8a6a'], // dunes
  ['#122436', '#28527a', '#6aa9c4', '#e8dfd0', '#c65f4e'], // reef
  ['#1c1c2e', '#4a4a7c', '#8f8fc4', '#e6e2f0', '#f2b56a'], // sky
]

export function generateArtwork(seed: number): CanvasTexture {
  const rng = mulberry32(seed)
  const size = 256
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  const palette = PALETTES[Math.floor(rng() * PALETTES.length)]
  ctx.fillStyle = palette[3]
  ctx.fillRect(0, 0, size, size)

  const style = Math.floor(rng() * 3)
  if (style === 0) {
    // layered horizon bands with a sun disc
    const bands = 4 + Math.floor(rng() * 4)
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = palette[i % palette.length]
      const y = (i / bands) * size + (rng() - 0.5) * 18
      ctx.beginPath()
      ctx.moveTo(0, y)
      for (let x = 0; x <= size; x += 16) {
        ctx.lineTo(x, y + Math.sin(x * 0.05 + i * 2 + seed) * 7)
      }
      ctx.lineTo(size, size)
      ctx.lineTo(0, size)
      ctx.fill()
    }
    ctx.fillStyle = palette[4]
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.arc(size * (0.25 + rng() * 0.5), size * (0.2 + rng() * 0.25), 14 + rng() * 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  } else if (style === 1) {
    // overlapping translucent circles
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = palette[Math.floor(rng() * palette.length)]
      ctx.globalAlpha = 0.35 + rng() * 0.4
      ctx.beginPath()
      ctx.arc(rng() * size, rng() * size, 18 + rng() * 60, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  } else {
    // quiet geometric composition
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = palette[Math.floor(rng() * palette.length)]
      ctx.globalAlpha = 0.6 + rng() * 0.4
      const w = 20 + rng() * 90
      const h = 20 + rng() * 90
      ctx.save()
      ctx.translate(rng() * size, rng() * size)
      ctx.rotate((rng() - 0.5) * 0.4)
      ctx.fillRect(-w / 2, -h / 2, w, h)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }
  // grain
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'
    ctx.fillRect(rng() * size, rng() * size, 1.5, 1.5)
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}
