# Pipeline-smoke asset generation record

## Purpose

These deliberately tiny assets prove the complete authored loading path. The GLB has one node,
one mesh, and one triangle with positions `(0,0,0)`, `(1,0,0)`, `(0,1,0)` and indices `0,1,2`.
Its position and index streams are genuinely compressed with `EXT_meshopt_compression`, and its
material references the external `pipeline-smoke.ktx2` exclusively through required
`KHR_texture_basisu` metadata.

## Deterministic source and GLB generation

Run from the repository root:

```sh
node scripts/authoring/generate-pipeline-smoke-sources.mjs
```

The generator used Node.js `v26.5.0` and only built-in `node:fs`, `node:path`, and `node:zlib`.
It embeds the reviewed Meshopt byte streams previously produced for this exact fixture by
`meshoptimizer` `1.2.0`; the asset test decodes those streams and asserts every source float and
index. It performs these fixed operations:

1. Writes a 4x4, opaque, alternating magenta/black RGBA PNG with filter type 0, an sRGB chunk,
   zlib level 9, fixed chunk order, calculated CRC-32 values, and no timestamps.
2. Writes the fixed Meshopt 1.2.0 `ATTRIBUTES` stream for the 36-byte little-endian float positions
   and `TRIANGLES` stream for the 6-byte little-endian unsigned-short indices.
3. Four-byte-aligns both compressed stream offsets in the GLB BIN chunk.
4. Writes stable insertion-ordered glTF JSON. The decoded bufferViews point to a URI-less
   42-byte placeholder buffer, while their `EXT_meshopt_compression` objects point to the real
   compressed GLB buffer. Both `EXT_meshopt_compression` and `KHR_texture_basisu` are required.
5. Pads JSON with spaces and the BIN chunk with zero bytes to four-byte boundaries, then writes
   the glTF 2.0 header and chunk lengths. No source or GLB metadata contains a timestamp.

Two consecutive generator runs produced identical PNG and GLB SHA-256 values.

## KTX-Software provenance and command

The authoring package was downloaded from:

`https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.2/KTX-Software-4.4.2-Darwin-arm64.pkg`

Its required and verified SHA-256 is:

`500bd8f9d63358c3f3a0d83b724c8574436a72c37dc0e4bad90ec1ca38032c3c`

The package signature did not validate in this environment, so the package was **not** installed
into the system. After the exact package digest was verified, its tools payload was extracted to
a temporary authoring directory and invoked from there. These are the exact download,
verification, safe expansion, and PATH commands used:

```sh
curl -fsSL \
  https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.2/KTX-Software-4.4.2-Darwin-arm64.pkg \
  -o /private/tmp/KTX-Software-4.4.2-Darwin-arm64.pkg

echo '500bd8f9d63358c3f3a0d83b724c8574436a72c37dc0e4bad90ec1ca38032c3c  /private/tmp/KTX-Software-4.4.2-Darwin-arm64.pkg' \
  | shasum -a 256 -c -

test ! -e /private/tmp/ktx-4.4.2-expanded-codex
pkgutil --expand-full \
  /private/tmp/KTX-Software-4.4.2-Darwin-arm64.pkg \
  /private/tmp/ktx-4.4.2-expanded-codex

ln -s \
  /private/tmp/ktx-4.4.2-expanded-codex/KTX-Software-4.4.2-Darwin-arm64-library.pkg/Payload/usr/local/lib/libktx.4.4.2.dylib \
  /private/tmp/ktx-4.4.2-expanded-codex/KTX-Software-4.4.2-Darwin-arm64-tools.pkg/Payload/usr/local/lib/libktx.4.dylib

export PATH="/private/tmp/ktx-4.4.2-expanded-codex/KTX-Software-4.4.2-Darwin-arm64-tools.pkg/Payload/usr/local/bin:$PATH"
toktx --version
ktx --version
```

The extracted tools expect `@rpath/libktx.4.dylib`; the explicit symlink above supplies that
runtime dependency from the separately extracted library payload without installing the package.
No `installer` command was run. Both extracted tools reported version 4.4.2:

```text
toktx v4.4.2
ktx version: v4.4.2
```

The authoring script checks both tool versions before touching the golden file. It encodes to a
hidden, same-directory temporary `.ktx2`, installs an exit/signal cleanup trap, validates glTF
BasisU compatibility with warnings promoted to errors, and only then atomically renames the
temporary file over the golden. A missing tool, encoder failure, warning, validation error, or
interrupt therefore leaves the prior checked-in KTX2 unchanged.

The complete encode, validation, and replacement sequence pinned in
`generate-pipeline-smoke-ktx2.sh` is:

```sh
output_directory='public/assets/system'
output="$output_directory/pipeline-smoke.ktx2"
temporary="$output_directory/.pipeline-smoke.$$.tmp.ktx2"

cleanup() {
  rm -f "$temporary"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

mkdir -p "$output_directory"
rm -f "$temporary"

toktx \
  --t2 \
  --encode uastc \
  --threads 1 \
  --genmipmap \
  --assign_oetf srgb \
  --assign_primaries bt709 \
  "$temporary" \
  assets-src/system/pipeline-smoke.png

ktx validate --warnings-as-errors --gltf-basisu "$temporary"
mv -f "$temporary" "$output"
```

The result is a 4x4 UASTC, BT.709, sRGB KTX2 with 4x4, 2x2, and 1x1 mip levels. The decoded
RGBA mip chain is `64 + 16 + 4 = 84` bytes.

KTX-Software documents Basis/UASTC output as potentially non-deterministic across platforms.
Therefore the committed KTX2 SHA-256 below, not re-encoding in CI or during a production build,
is the runtime contract.

## Deliberate smoke double-load and accounting boundary

The model preload resolves this KTX2 through the GLB material, while the separately registered
texture preload resolves the same file directly. This deliberate double-load exercises both the
integrated GLTFLoader/KTX2Loader path and the standalone texture acquisition path with one tiny
4x4 asset; it is a smoke-test exception, not a content-authoring pattern.

Registry diagnostics attribute the fixed 42 decoded geometry/index bytes to the model record and
the fixed 84 decoded mip bytes to the texture record once. If the two loader paths hold separate
GPU texture allocations, that estimate intentionally undercounts physical memory. The bounded
4x4 fixture makes this acceptable while keeping ordinary asset accounting stable and
deterministic.

## Checked-in file facts

| File                                       | Encoded bytes | SHA-256                                                            |
| ------------------------------------------ | ------------: | ------------------------------------------------------------------ |
| `assets-src/system/pipeline-smoke.png`     |            95 | `9e985f07c2437555a29cbb7e69fe82d1d4ae096e553b2fa15ef2fafe1d76d7dd` |
| `public/assets/system/pipeline-smoke.glb`  |          1612 | `8df14b639313b884daca98eb272c939086a0ca422b6f31b6a224d65d88995bf8` |
| `public/assets/system/pipeline-smoke.ktx2` |           352 | `94405cdd8e3d4fb1e44fc26f1bb48e71cf18aed84378b680acaa7097fd1980cf` |
