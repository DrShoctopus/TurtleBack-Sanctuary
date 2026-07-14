#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../..')
const WAV_DIRECTORY = join(HERE, 'wav')
const DELIVERY_DIRECTORY = join(ROOT, 'public/assets/audio/turtle')
const SAMPLE_RATE = 48_000
const TARGET_LUFS = -24
const MAX_TRUE_PEAK_DBTP = -3
const MASTER_TRUE_PEAK_MARGIN_DBTP = -3.5
const MP3_BITRATE = '160k'
const LOOP_CROSSFADE_SECONDS = 0.25

const ASSETS = [
  {
    name: 'breath-loop',
    category: 'breath',
    durationSeconds: 12,
    seed: 0x71a6c4d1,
    loop: { startSeconds: 0, endSeconds: 12, crossfadeSeconds: LOOP_CROSSFADE_SECONDS },
    synthesize: synthesizeBreathLoop,
  },
  {
    name: 'breath-deep',
    category: 'breath',
    durationSeconds: 6.4,
    seed: 0xb3e47a29,
    synthesize: synthesizeDeepBreath,
  },
  {
    name: 'stroke-front',
    category: 'flipper',
    durationSeconds: 3.2,
    seed: 0xf10a7e35,
    synthesize: synthesizeFrontStroke,
  },
  {
    name: 'stroke-rear',
    category: 'flipper',
    durationSeconds: 2.6,
    seed: 0x4c29b871,
    synthesize: synthesizeRearStroke,
  },
  {
    name: 'shell-resonance',
    category: 'shell-resonance',
    durationSeconds: 6.5,
    seed: 0x9d5236af,
    synthesize: synthesizeShellResonance,
  },
]

function assertCommand(command) {
  const result = spawnSync(command, ['-version'], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`${command} is required: ${result.stderr || result.stdout}`)
  }
  return result.stdout.split(/\r?\n/, 1)[0]
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: options.binary ? null : 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : result.stderr
    throw new Error(`${command} ${args.join(' ')} failed:\n${stderr}`)
  }
  return result
}

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function whiteNoise(length, seed) {
  const random = mulberry32(seed)
  const values = new Float64Array(length)
  for (let index = 0; index < length; index += 1) values[index] = random() * 2 - 1
  return values
}

function lowpass(input, cutoffHz, circular = false) {
  const output = new Float64Array(input.length)
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoffHz) / SAMPLE_RATE)
  let state = 0
  const passes = circular ? 4 : 1
  for (let pass = 0; pass < passes; pass += 1) {
    for (let index = 0; index < input.length; index += 1) {
      state += alpha * (input[index] - state)
      if (pass === passes - 1) output[index] = state
    }
  }
  return output
}

function bandpass(input, lowCutHz, highCutHz, circular = false) {
  const highLimited = lowpass(input, highCutHz, circular)
  const lowBand = lowpass(input, lowCutHz, circular)
  const output = new Float64Array(input.length)
  for (let index = 0; index < input.length; index += 1) {
    output[index] = highLimited[index] - lowBand[index]
  }
  return output
}

function smoothstep(value) {
  const clamped = Math.max(0, Math.min(1, value))
  return clamped * clamped * (3 - 2 * clamped)
}

function gaussian(time, center, width) {
  const normalized = (time - center) / width
  return Math.exp(-0.5 * normalized * normalized)
}

function fadeEdges(samples, fadeInSeconds, fadeOutSeconds = fadeInSeconds) {
  const fadeInSamples = Math.round(fadeInSeconds * SAMPLE_RATE)
  const fadeOutSamples = Math.round(fadeOutSeconds * SAMPLE_RATE)
  for (let index = 0; index < samples.length; index += 1) {
    const fadeIn = smoothstep(index / Math.max(1, fadeInSamples))
    const remaining = samples.length - 1 - index
    const fadeOut = smoothstep(remaining / Math.max(1, fadeOutSamples))
    samples[index] *= Math.min(fadeIn, fadeOut)
  }
}

function removeDc(samples) {
  let sum = 0
  for (const sample of samples) sum += sample
  const mean = sum / samples.length
  for (let index = 0; index < samples.length; index += 1) samples[index] -= mean
}

function soften(samples, drive = 1.2) {
  const denominator = Math.tanh(drive)
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.tanh(samples[index] * drive) / denominator
  }
}

function rotateToQuietSeam(samples, searchFraction = 0.1) {
  const edge = Math.floor(samples.length * searchFraction)
  let bestIndex = 0
  let bestScore = Number.POSITIVE_INFINITY
  for (let index = 1; index < samples.length; index += 1) {
    if (index > edge && index < samples.length - edge) continue
    const previous = samples[index - 1]
    const current = samples[index]
    const next = samples[(index + 1) % samples.length]
    const score = Math.abs(current - previous) + Math.abs(next - current) * 0.2
    if (score < bestScore) {
      bestScore = score
      bestIndex = index
    }
  }
  if (bestIndex === 0) return samples
  const rotated = new Float64Array(samples.length)
  rotated.set(samples.subarray(bestIndex), 0)
  rotated.set(samples.subarray(0, bestIndex), samples.length - bestIndex)
  return rotated
}

function synthesizeBreathLoop({ sampleCount, seed, durationSeconds }) {
  const airflow = bandpass(whiteNoise(sampleCount, seed), 18, 680, true)
  const chest = bandpass(whiteNoise(sampleCount, seed ^ 0xa17342cf), 8, 150, true)
  const samples = new Float64Array(sampleCount)

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE
    const phase = time / durationSeconds
    const cycle = 0.5 - 0.5 * Math.cos(2 * Math.PI * phase)
    const airflowEnvelope = 0.13 + 0.87 * Math.pow(cycle, 0.72)
    const bodyEnvelope = 0.38 + 0.62 * cycle
    const bodyModulation = 0.1 * Math.sin(2 * Math.PI * phase)
    const resonance =
      Math.sin(2 * Math.PI * 32 * time + bodyModulation) * 0.095 +
      Math.sin(2 * Math.PI * 47 * time + 0.8) * 0.045 +
      Math.sin(2 * Math.PI * 71 * time + 1.7) * 0.018
    samples[index] =
      airflow[index] * airflowEnvelope * 0.78 +
      chest[index] * bodyEnvelope * 0.8 +
      resonance * bodyEnvelope
  }

  removeDc(samples)
  soften(samples, 1.05)
  const loop = rotateToQuietSeam(samples)
  // Put the codec boundary inside a brief respiratory rest. The envelope is
  // smooth at both ends and the runtime still crossfades the documented 250 ms.
  fadeEdges(loop, 0.18)
  return loop
}

function synthesizeDeepBreath({ sampleCount, seed, durationSeconds }) {
  const airflow = bandpass(whiteNoise(sampleCount, seed), 16, 820)
  const chest = bandpass(whiteNoise(sampleCount, seed ^ 0x62c1e5b9), 7, 135)
  const samples = new Float64Array(sampleCount)
  const crest = 2.45

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE
    const rise = smoothstep(time / crest)
    const fall = 1 - smoothstep((time - crest) / (durationSeconds - crest))
    const envelope = Math.min(rise, fall)
    const exhale = smoothstep((time - 2.2) / 0.55) * fall
    const chirpPhase = 2 * Math.PI * (28 * time + 0.5 * 1.2 * time * time)
    const resonance = Math.sin(chirpPhase) * 0.11 + Math.sin(2 * Math.PI * 43 * time + 0.55) * 0.045
    samples[index] =
      airflow[index] * (0.26 + 0.74 * exhale) * envelope * 0.92 +
      chest[index] * envelope * 0.9 +
      resonance * envelope
  }

  fadeEdges(samples, 0.12, 0.3)
  removeDc(samples)
  soften(samples, 1.15)
  return samples
}

function synthesizeFrontStroke({ sampleCount, seed, durationSeconds }) {
  const water = bandpass(whiteNoise(sampleCount, seed), 24, 1_250)
  const body = bandpass(whiteNoise(sampleCount, seed ^ 0x9416db73), 9, 190)
  const spray = bandpass(whiteNoise(sampleCount, seed ^ 0x183aef25), 650, 4_200)
  const samples = new Float64Array(sampleCount)

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE
    const attack = smoothstep(time / 0.18)
    const tail = Math.exp(-time * 1.08)
    const sweepEnvelope = attack * tail
    const displacementPhase = 2 * Math.PI * (44 * time - 2.7 * time * time)
    const droplets =
      gaussian(time, 0.48, 0.08) +
      gaussian(time, 0.72, 0.11) * 0.72 +
      gaussian(time, 1.05, 0.15) * 0.45
    samples[index] =
      water[index] * sweepEnvelope * 1.05 +
      body[index] * sweepEnvelope * 0.88 +
      Math.sin(displacementPhase) * sweepEnvelope * 0.11 +
      spray[index] * droplets * 0.18
  }

  fadeEdges(samples, 0.035, 0.22)
  removeDc(samples)
  soften(samples, 1.28)
  return samples
}

function synthesizeRearStroke({ sampleCount, seed, durationSeconds }) {
  const water = bandpass(whiteNoise(sampleCount, seed), 28, 980)
  const body = bandpass(whiteNoise(sampleCount, seed ^ 0x3a6ce901), 11, 170)
  const detail = bandpass(whiteNoise(sampleCount, seed ^ 0xc52f8137), 520, 3_100)
  const samples = new Float64Array(sampleCount)

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE
    const attack = smoothstep(time / 0.14)
    const tail = Math.exp(-time * 1.35)
    const envelope = attack * tail
    const displacementPhase = 2 * Math.PI * (39 * time - 2.25 * time * time)
    const trailingWater = gaussian(time, 0.62, 0.12) + gaussian(time, 0.92, 0.16) * 0.48
    samples[index] =
      water[index] * envelope * 0.94 +
      body[index] * envelope * 0.82 +
      Math.sin(displacementPhase) * envelope * 0.085 +
      detail[index] * trailingWater * 0.13
  }

  fadeEdges(samples, 0.03, 0.2)
  removeDc(samples)
  soften(samples, 1.22)
  return samples
}

function synthesizeShellResonance({ sampleCount, seed, durationSeconds }) {
  const grain = bandpass(whiteNoise(sampleCount, seed), 12, 310)
  const texture = bandpass(whiteNoise(sampleCount, seed ^ 0xd4e2016b), 80, 1_150)
  const samples = new Float64Array(sampleCount)
  const modes = [
    { frequency: 31, amplitude: 0.1, decay: 0.34, phase: 0.2 },
    { frequency: 46, amplitude: 0.072, decay: 0.43, phase: 1.1 },
    { frequency: 67, amplitude: 0.044, decay: 0.52, phase: 2.2 },
    { frequency: 103, amplitude: 0.021, decay: 0.67, phase: 0.7 },
  ]

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE
    const rise = smoothstep(time / 0.32)
    const tail = 1 - smoothstep((time - 4.7) / (durationSeconds - 4.7))
    const bodyEnvelope = rise * tail
    let resonance = 0
    for (const mode of modes) {
      const drift = 0.08 * Math.sin(2 * Math.PI * 0.11 * time + mode.phase)
      resonance +=
        Math.sin(2 * Math.PI * mode.frequency * time + drift + mode.phase) *
        mode.amplitude *
        Math.exp(-time * mode.decay)
    }
    const settling = gaussian(time, 1.7, 0.55) + gaussian(time, 3.25, 0.82) * 0.45
    samples[index] =
      resonance * bodyEnvelope +
      grain[index] * bodyEnvelope * Math.exp(-time * 0.34) * 0.78 +
      texture[index] * settling * 0.12
  }

  fadeEdges(samples, 0.08, 0.4)
  removeDc(samples)
  soften(samples, 1.12)
  return samples
}

function peak(samples) {
  let maximum = 0
  for (const sample of samples) maximum = Math.max(maximum, Math.abs(sample))
  return maximum
}

function scaledSamples(samples, gainDb) {
  const gain = 10 ** (gainDb / 20)
  const output = new Float64Array(samples.length)
  for (let index = 0; index < samples.length; index += 1) output[index] = samples[index] * gain
  const maximum = peak(output)
  if (maximum >= 1) throw new Error(`normalization would clip at ${maximum.toFixed(6)} FS`)
  return output
}

async function writePcm24Wav(path, samples) {
  const bytesPerSample = 3
  const dataSize = samples.length * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28)
  buffer.writeUInt16LE(bytesPerSample, 32)
  buffer.writeUInt16LE(24, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataSize, 40)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1 - 1 / 8_388_608, samples[index]))
    const value = Math.round(sample * 8_388_607)
    buffer.writeIntLE(value, 44 + index * bytesPerSample, bytesPerSample)
  }
  await writeFile(path, buffer)
}

function measureLoudness(path) {
  const result = run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    path,
    '-af',
    `loudnorm=I=${TARGET_LUFS}:TP=${MAX_TRUE_PEAK_DBTP}:LRA=7:print_format=json`,
    '-f',
    'null',
    '-',
  ])
  const matches = result.stderr.match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/g)
  if (!matches?.length) throw new Error(`ffmpeg did not return loudness JSON for ${path}`)
  const parsed = JSON.parse(matches[matches.length - 1])
  const loudnessLufs = Number(parsed.input_i)
  const truePeakDbtp = Number(parsed.input_tp)
  const loudnessRangeLu = Number(parsed.input_lra)
  if (![loudnessLufs, truePeakDbtp, loudnessRangeLu].every(Number.isFinite)) {
    throw new Error(`invalid loudness measurement for ${path}: ${matches[matches.length - 1]}`)
  }
  return { loudnessLufs, truePeakDbtp, loudnessRangeLu }
}

function encodeMp3(wavPath, mp3Path, name) {
  run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    wavPath,
    '-map_metadata',
    '-1',
    '-ar',
    String(SAMPLE_RATE),
    '-ac',
    '1',
    '-c:a',
    'libmp3lame',
    '-b:a',
    MP3_BITRATE,
    '-write_xing',
    '1',
    '-id3v2_version',
    '3',
    '-metadata',
    `title=${name}`,
    '-metadata',
    'artist=TurtleBack Sanctuary',
    '-metadata',
    'comment=Original deterministic synthesis',
    mp3Path,
  ])
}

function probeMp3(path) {
  const result = run('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'a:0',
    '-show_entries',
    'stream=codec_name,sample_rate,channels,channel_layout,bit_rate',
    '-show_entries',
    'format=duration,bit_rate',
    '-of',
    'json',
    path,
  ])
  const parsed = JSON.parse(result.stdout)
  const stream = parsed.streams?.[0]
  if (!stream) throw new Error(`ffprobe found no audio stream in ${path}`)
  return {
    codec: stream.codec_name,
    sampleRateHz: Number(stream.sample_rate),
    channels: Number(stream.channels),
    channelLayout: stream.channel_layout,
    streamBitrateBps: Number(stream.bit_rate),
    containerBitrateBps: Number(parsed.format?.bit_rate),
    containerDurationSeconds: Number(parsed.format?.duration),
  }
}

function decodeMp3(path) {
  const result = run(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      path,
      '-f',
      'f32le',
      '-acodec',
      'pcm_f32le',
      '-ar',
      String(SAMPLE_RATE),
      '-ac',
      '1',
      'pipe:1',
    ],
    { binary: true },
  )
  const bytes = result.stdout
  const samples = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
  return samples
}

function dbfs(value) {
  return 20 * Math.log10(Math.max(Math.abs(value), 1e-12))
}

function loopSeamMetrics(decoded) {
  const boundaryDelta = decoded[0] - decoded[decoded.length - 1]
  const derivativeBefore = decoded[decoded.length - 1] - decoded[decoded.length - 2]
  const derivativeAfter = decoded[1] - decoded[0]
  return {
    boundaryDeltaDbfs: dbfs(boundaryDelta),
    derivativeMismatchDbfs: dbfs(derivativeAfter - derivativeBefore),
  }
}

async function sha256(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex')
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits))
}

async function renderAsset(asset) {
  const sampleCount = Math.round(asset.durationSeconds * SAMPLE_RATE)
  const synthesized = asset.synthesize({
    sampleCount,
    seed: asset.seed,
    durationSeconds: asset.durationSeconds,
  })
  if (synthesized.length !== sampleCount)
    throw new Error(`${asset.name} returned wrong sample count`)

  const temporaryPath = join(WAV_DIRECTORY, `.${asset.name}.premaster.wav`)
  const wavPath = join(WAV_DIRECTORY, `${asset.name}.wav`)
  const mp3Path = join(DELIVERY_DIRECTORY, `${asset.name}.mp3`)
  await writePcm24Wav(temporaryPath, synthesized)
  const premaster = measureLoudness(temporaryPath)
  let gainDb = TARGET_LUFS - premaster.loudnessLufs
  if (premaster.truePeakDbtp + gainDb > MASTER_TRUE_PEAK_MARGIN_DBTP) {
    gainDb = MASTER_TRUE_PEAK_MARGIN_DBTP - premaster.truePeakDbtp
  }

  let deliveryMeasurement = null
  let renderedGainDb = gainDb
  for (let iteration = 0; iteration < 4; iteration += 1) {
    renderedGainDb = gainDb
    await writePcm24Wav(wavPath, scaledSamples(synthesized, gainDb))
    encodeMp3(wavPath, mp3Path, asset.name)
    deliveryMeasurement = measureLoudness(mp3Path)
    const loudnessCorrection = TARGET_LUFS - deliveryMeasurement.loudnessLufs
    if (Math.abs(loudnessCorrection) <= 0.03) break
    const peakAfterCorrection = deliveryMeasurement.truePeakDbtp + loudnessCorrection
    gainDb +=
      peakAfterCorrection > MASTER_TRUE_PEAK_MARGIN_DBTP
        ? MASTER_TRUE_PEAK_MARGIN_DBTP - deliveryMeasurement.truePeakDbtp
        : loudnessCorrection
  }
  await unlink(temporaryPath)

  if (!deliveryMeasurement) throw new Error(`${asset.name} was not measured`)
  const probe = probeMp3(mp3Path)
  const decoded = decodeMp3(mp3Path)
  const [wavStats, mp3Stats] = await Promise.all([stat(wavPath), stat(mp3Path)])
  if (probe.codec !== 'mp3') throw new Error(`${asset.name} codec is ${probe.codec}`)
  if (probe.sampleRateHz !== SAMPLE_RATE) throw new Error(`${asset.name} is not 48 kHz`)
  if (probe.channels !== 1) throw new Error(`${asset.name} is not mono`)
  if (probe.streamBitrateBps !== 160_000) {
    throw new Error(`${asset.name} stream bitrate is ${probe.streamBitrateBps}`)
  }
  if (Math.abs(deliveryMeasurement.loudnessLufs - TARGET_LUFS) > 1) {
    throw new Error(`${asset.name} loudness is ${deliveryMeasurement.loudnessLufs} LUFS-I`)
  }
  if (deliveryMeasurement.truePeakDbtp > MAX_TRUE_PEAK_DBTP) {
    throw new Error(`${asset.name} true peak is ${deliveryMeasurement.truePeakDbtp} dBTP`)
  }
  if (decoded.length !== sampleCount) {
    throw new Error(
      `${asset.name} gapless decode returned ${decoded.length} samples; expected ${sampleCount}`,
    )
  }

  return {
    name: asset.name,
    category: asset.category,
    seed: `0x${asset.seed.toString(16).padStart(8, '0')}`,
    synthesisDurationSeconds: asset.durationSeconds,
    decodedDurationSeconds: decoded.length / SAMPLE_RATE,
    containerDurationSeconds: round(probe.containerDurationSeconds, 6),
    codec: probe.codec,
    sampleRateHz: probe.sampleRateHz,
    channels: probe.channels,
    channelLayout: probe.channelLayout,
    streamBitrateBps: probe.streamBitrateBps,
    containerBitrateBps: probe.containerBitrateBps,
    encodedBytes: mp3Stats.size,
    decodedFloat32Bytes: decoded.byteLength,
    sourceWavBytes: wavStats.size,
    loudnessLufs: round(deliveryMeasurement.loudnessLufs, 2),
    truePeakDbtp: round(deliveryMeasurement.truePeakDbtp, 2),
    loudnessRangeLu: round(deliveryMeasurement.loudnessRangeLu, 2),
    sourceWavPeakDbfs: round(dbfs(peak(scaledSamples(synthesized, renderedGainDb))), 2),
    loop: asset.loop
      ? {
          ...asset.loop,
          ...Object.fromEntries(
            Object.entries(loopSeamMetrics(decoded)).map(([key, value]) => [key, round(value, 2)]),
          ),
        }
      : null,
    wavSha256: await sha256(wavPath),
    mp3Sha256: await sha256(mp3Path),
  }
}

async function main() {
  await mkdir(WAV_DIRECTORY, { recursive: true })
  await mkdir(DELIVERY_DIRECTORY, { recursive: true })
  const ffmpegVersion = assertCommand('ffmpeg')
  const ffprobeVersion = assertCommand('ffprobe')
  const rendered = []
  for (const asset of ASSETS) {
    rendered.push(await renderAsset(asset))
    process.stdout.write(`Rendered ${asset.name}\n`)
  }

  const report = {
    schemaVersion: 1,
    provenance: {
      author: 'TurtleBack Sanctuary contributors, with OpenAI Codex synthesis assistance',
      license: 'Original',
      method:
        'Deterministic in-repository DSP synthesis; no recordings, sample libraries, or audio-generation model output.',
      script: 'art-source/turtle/audio/generate-turtle-audio.mjs',
    },
    deliveryTarget: {
      codec: 'mp3',
      sampleRateHz: SAMPLE_RATE,
      channels: 1,
      bitrateBps: 160_000,
      loudnessLufs: TARGET_LUFS,
      loudnessToleranceLu: 1,
      maxTruePeakDbtp: MAX_TRUE_PEAK_DBTP,
      sourceWav: 'PCM signed 24-bit little-endian, mono, 48 kHz',
    },
    toolchain: {
      node: process.version,
      ffmpeg: ffmpegVersion,
      ffprobe: ffprobeVersion,
    },
    assets: rendered,
  }
  await writeFile(join(HERE, 'generation-report.json'), `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`Wrote ${join(HERE, 'generation-report.json')}\n`)
}

await main()
