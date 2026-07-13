import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, Color, MeshBasicMaterial, TubeGeometry, Vector3 } from 'three'
import { terrainHeight } from './shellShape'
import { runtime } from '../../core/runtime'
import { sampleShellTransitionAnchors } from '../turtle/shellAlignment'

/** Bioluminescent seams tracing the shell's ridgelines — visible after dusk. */
export function BiolumSeams() {
  const geometries = useMemo(() => {
    const lines: Vector3[][] = []
    // spine seam
    const spine: Vector3[] = []
    for (let z = -215; z <= 225; z += 14) {
      spine.push(new Vector3(0.4, terrainHeight(0.4, z) + 0.1, z))
    }
    lines.push(spine)
    // lateral seams
    for (const sx of [-92, 92]) {
      const lat: Vector3[] = []
      for (let z = -170; z <= 185; z += 16) {
        const x = sx * (1 - Math.abs(z) / 620)
        lat.push(new Vector3(x, terrainHeight(x, z) + 0.1, z))
      }
      lines.push(lat)
    }
    // rim ring
    const rim: Vector3[] = sampleShellTransitionAnchors(96).map(({ x, z }) => {
      const seamX = x * 0.955
      const seamZ = z * 0.955
      return new Vector3(seamX, terrainHeight(seamX, seamZ) + 0.12, seamZ)
    })
    lines.push(rim)
    return lines.map((pts, i) => {
      const curve = new CatmullRomCurve3(pts, i === 3)
      return new TubeGeometry(curve, pts.length * 2, 0.055, 5, i === 3)
    })
  }, [])

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#000000'),
        toneMapped: false,
        transparent: true,
        opacity: 0.85,
      }),
    [],
  )

  useFrame((state) => {
    const night = runtime.time.celest.nightFactor
    const pulse = 0.7 + Math.sin(state.clock.elapsedTime * 0.45) * 0.3
    const v = night * pulse * 0.62
    material.color.setRGB(0.28 * v, 0.85 * v, 0.72 * v)
    material.visible = v > 0.02
  })

  return (
    <group>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} material={material} />
      ))}
    </group>
  )
}
