import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JSON_CHUNK_TYPE = 0x4e4f534a
const BIN_CHUNK_TYPE = 0x004e4942
// Fixed meshoptimizer 1.2.0 glTF streams for the exact decoded triangle below.
// Keeping the reviewed bytes here makes this deterministic source generator
// depend only on Node built-ins; pipelineSmokeRecords.test.ts decodes them and
// asserts every float and index.
const ENCODED_POSITIONS = Buffer.from(
  'a00000013c000000ffff013c0000007e7d0000010c000000ff010c0000007e000000000000000000000000000000000000000000000000000000000000000000000000',
  'hex',
)
const ENCODED_INDICES = Buffer.from('e1f0007687566778a9866589689801690000', 'hex')

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const chunk = Buffer.alloc(12 + data.byteLength)
  chunk.writeUInt32BE(data.byteLength, 0)
  typeBytes.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.byteLength)
  return chunk
}

function createCheckerPng() {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(4, 0)
  ihdr.writeUInt32BE(4, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  const scanlines = Buffer.alloc(4 * (1 + 4 * 4))
  for (let y = 0; y < 4; y += 1) {
    const rowOffset = y * 17
    scanlines[rowOffset] = 0
    for (let x = 0; x < 4; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 4
      const magenta = (x + y) % 2 === 0
      scanlines[pixelOffset] = magenta ? 255 : 0
      scanlines[pixelOffset + 1] = 0
      scanlines[pixelOffset + 2] = magenta ? 255 : 0
      scanlines[pixelOffset + 3] = 255
    }
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('sRGB', Buffer.from([0])),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function alignToFour(value) {
  return (value + 3) & ~3
}

function createGlbJson(binaryByteLength, positionCompression, indexCompression) {
  return {
    asset: {
      version: '2.0',
      generator: 'Turtleback pipeline-smoke generator with meshoptimizer 1.2.0',
    },
    extensionsUsed: ['EXT_meshopt_compression', 'KHR_texture_basisu'],
    extensionsRequired: ['EXT_meshopt_compression', 'KHR_texture_basisu'],
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'PipelineSmokeTriangle' }],
    meshes: [
      {
        name: 'PipelineSmokeTriangle',
        primitives: [
          {
            attributes: { POSITION: 0 },
            indices: 1,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: 'PipelineSmokeChecker',
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      },
    ],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    textures: [
      {
        sampler: 0,
        extensions: {
          KHR_texture_basisu: { source: 0 },
        },
      },
    ],
    images: [{ uri: 'pipeline-smoke.ktx2', mimeType: 'image/ktx2' }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: 3,
        type: 'SCALAR',
        min: [0],
        max: [2],
      },
    ],
    bufferViews: [
      {
        buffer: 1,
        byteOffset: 0,
        byteLength: 36,
        byteStride: 12,
        target: 34962,
        extensions: {
          EXT_meshopt_compression: {
            buffer: 0,
            byteOffset: positionCompression.byteOffset,
            byteLength: positionCompression.byteLength,
            byteStride: 12,
            count: 3,
            mode: 'ATTRIBUTES',
            filter: 'NONE',
          },
        },
      },
      {
        buffer: 1,
        byteOffset: 36,
        byteLength: 6,
        target: 34963,
        extensions: {
          EXT_meshopt_compression: {
            buffer: 0,
            byteOffset: indexCompression.byteOffset,
            byteLength: indexCompression.byteLength,
            byteStride: 2,
            count: 3,
            mode: 'TRIANGLES',
            filter: 'NONE',
          },
        },
      },
    ],
    buffers: [{ byteLength: binaryByteLength }, { byteLength: 42 }],
  }
}

function createCompressedGlb() {
  const encodedPositions = Buffer.from(ENCODED_POSITIONS)
  const encodedIndices = Buffer.from(ENCODED_INDICES)
  const positionOffset = 0
  const indexOffset = alignToFour(encodedPositions.byteLength)
  const binaryByteLength = alignToFour(indexOffset + encodedIndices.byteLength)
  const binary = Buffer.alloc(binaryByteLength)
  encodedPositions.copy(binary, positionOffset)
  encodedIndices.copy(binary, indexOffset)

  const json = createGlbJson(
    binaryByteLength,
    { byteOffset: positionOffset, byteLength: encodedPositions.byteLength },
    { byteOffset: indexOffset, byteLength: encodedIndices.byteLength },
  )
  const serializedJson = Buffer.from(JSON.stringify(json), 'utf8')
  const paddedJsonLength = alignToFour(serializedJson.byteLength)
  const jsonChunk = Buffer.alloc(paddedJsonLength, 0x20)
  serializedJson.copy(jsonChunk)

  const totalLength = 12 + 8 + jsonChunk.byteLength + 8 + binary.byteLength
  const glb = Buffer.alloc(totalLength)
  glb.write('glTF', 0, 'ascii')
  glb.writeUInt32LE(2, 4)
  glb.writeUInt32LE(totalLength, 8)
  glb.writeUInt32LE(jsonChunk.byteLength, 12)
  glb.writeUInt32LE(JSON_CHUNK_TYPE, 16)
  jsonChunk.copy(glb, 20)
  const binaryHeaderOffset = 20 + jsonChunk.byteLength
  glb.writeUInt32LE(binary.byteLength, binaryHeaderOffset)
  glb.writeUInt32LE(BIN_CHUNK_TYPE, binaryHeaderOffset + 4)
  binary.copy(glb, binaryHeaderOffset + 8)
  return glb
}

const rootDirectory = process.cwd()
const sourceDirectory = join(rootDirectory, 'assets-src/system')
const publicDirectory = join(rootDirectory, 'public/assets/system')
await Promise.all([
  mkdir(sourceDirectory, { recursive: true }),
  mkdir(publicDirectory, { recursive: true }),
])
await Promise.all([
  writeFile(join(sourceDirectory, 'pipeline-smoke.png'), createCheckerPng()),
  writeFile(join(publicDirectory, 'pipeline-smoke.glb'), createCompressedGlb()),
])
