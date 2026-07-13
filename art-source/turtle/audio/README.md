# Original Turtle Audio Sources

These five sounds are original deterministic synthesis created for TurtleBack
Sanctuary. They use no recordings, sample libraries, downloaded material, or
audio-generation-model output. The synthesis script and DSP recipes were
authored with OpenAI Codex assistance under the contributor's direction.

- **Author:** TurtleBack Sanctuary contributors, with OpenAI Codex synthesis assistance
- **License:** Original
- **Attribution:** none required
- **Source URL:** not applicable; generated in this repository
- **Generator:** `generate-turtle-audio.mjs`
- **Retained masters:** `wav/*.wav`
- **Runtime deliveries:** `public/assets/audio/turtle/*.mp3`
- **Machine-readable measurements:** `generation-report.json`

## Delivery contract

The generator implements the shared spatial one-shot contract:

- mono MP3;
- 48,000 Hz;
- 160,000 bps CBR with `libmp3lame`;
- −24 LUFS-I target, accepted within ±1 LU;
- true peak no higher than −3 dBTP;
- retained mono 48 kHz, signed 24-bit PCM WAV masters.

The current report was produced with Node 26.5.0 and ffmpeg/ffprobe 8.1.1.
Changing codec versions can change encoded hashes even when the source synthesis
and delivery measurements remain equivalent.

## Synthesis settings

| Asset             | Seed         | Duration | Construction                                                                  |
| ----------------- | ------------ | -------: | ----------------------------------------------------------------------------- |
| `breath-loop`     | `0x71a6c4d1` |   12.0 s | Circular filtered airflow/chest noise, 32/47/71 Hz body modes, one slow cycle |
| `breath-deep`     | `0xb3e47a29` |    6.4 s | Asymmetric inhale/exhale noise, low chest band, restrained rising body mode   |
| `stroke-front`    | `0xf10a7e35` |    3.2 s | Broad low water sweep, displacement chirp, three soft spray clusters          |
| `stroke-rear`     | `0x4c29b871` |    2.6 s | Smaller/darker water sweep, low displacement, two trailing-water clusters     |
| `shell-resonance` | `0x9d5236af` |    6.5 s | Decaying 31/46/67/103 Hz modes with seeded shell grain and settling texture   |

Every noise source uses the script's seeded Mulberry32 generator. Filters,
envelopes, resonance frequencies, fades, saturation, normalization iterations,
WAV serialization, MP3 flags, and validation thresholds are all fixed in the
script. No wall-clock time or host randomness enters generation.

## Breath-loop boundary

`breath-loop` has a measured loop start of 0.0 seconds and loop end of 12.0
seconds. A 180 ms smooth respiratory-rest taper places both codec edges near
digital silence. The delivered MP3 decodes to exactly 576,000 samples; its
measured hard-boundary delta is −111.50 dBFS and derivative mismatch is −113.29
dBFS. Runtime should still apply the shared 250 ms crossfade to make the loop
robust across browser decoders and future encodes.

## Measured deliveries

| Asset             | LUFS-I |  True peak | MP3 SHA-256                                                        |
| ----------------- | -----: | ---------: | ------------------------------------------------------------------ |
| `breath-loop`     | −24.00 | −7.92 dBTP | `b42a95c72ab4ca89deea8b21b4428d5240fc7b5f1e5a27b35b9d9b4503a39450` |
| `breath-deep`     | −24.02 | −6.73 dBTP | `2485f6e8fc5d80688b6e1c5b6b26455ef1e0711b4f6d3037f832181feb5226a6` |
| `stroke-front`    | −24.01 | −7.62 dBTP | `00e33ee9adfb9da7e071fb437f478308d68f011bf9a30035db9605747eaf2f75` |
| `stroke-rear`     | −24.01 | −8.21 dBTP | `657a1690db8d0f2e086dbcdf951dcbd5bff7bdecef1f2fe28ab4e4c7a98e8cfb` |
| `shell-resonance` | −24.00 | −3.94 dBTP | `d2cb48f0c39414217eb73340bd6701cae35e19863ab49b40c682fafe180044d7` |

The full report also records WAV hashes, encoded/source/decoded byte counts,
container and decoded durations, stream and container bitrates, channel layouts,
loudness range, source-master peaks, and loop diagnostics.

## Reproduction

From the repository root, with `ffmpeg` and `ffprobe` on `PATH`:

```sh
node art-source/turtle/audio/generate-turtle-audio.mjs
```

The command regenerates the WAV masters, MP3 deliveries, and
`generation-report.json`, then fails if a delivery is not MP3/48 kHz/mono/160
kbps, misses the loudness tolerance, exceeds −3 dBTP, clips, or loses samples
during gapless MP3 decode.

## Listening caveats

- These are technically validated synthetic masters, not field recordings. A
  final in-game listening pass is still required with the spatial panner,
  ambient-bus gain, weather, ocean, and soundtrack active together.
- The assets deliberately carry substantial low-frequency scale information.
  Audition on both headphones and small speakers before changing gain or EQ;
  small speakers will reproduce more texture and less body resonance.
- Integrated loudness on short one-shots is gate-sensitive. The measured LUFS-I
  target provides consistent delivery headroom, but event intensity and voice
  concurrency must remain bounded in `TurtleAudioEngine`.
- MP3 is lossy. Use the retained WAV masters for any future edit or alternate
  encoding rather than transcoding these MP3 files.
