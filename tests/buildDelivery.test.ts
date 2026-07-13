import { access } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BASIS_TRANSCODER_COPY_TARGETS } from '../vite.config'

describe('authored asset build delivery', () => {
  it('copies the pinned Three Basis decoder files to their stable runtime directory', async () => {
    expect(
      BASIS_TRANSCODER_COPY_TARGETS.map((target) => ({
        name: basename(target.src),
        dest: target.dest,
      })),
    ).toEqual([
      { name: 'basis_transcoder.js', dest: 'assets/decoders/basis' },
      { name: 'basis_transcoder.wasm', dest: 'assets/decoders/basis' },
    ])

    await Promise.all(BASIS_TRANSCODER_COPY_TARGETS.map((target) => access(target.src)))
  })

  it('keeps notices and authored smoke assets on Vite public paths', async () => {
    const publicFiles = [
      'assets/decoders/basis/LICENSE.txt',
      'assets/decoders/basis/NOTICE.txt',
      'assets/decoders/basis/turtleback-basis-worker.js',
      'assets/system/pipeline-smoke.glb',
      'assets/system/pipeline-smoke.ktx2',
    ]

    await Promise.all(publicFiles.map((file) => access(resolve('public', file))))
  })
})
