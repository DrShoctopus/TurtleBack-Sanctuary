#!/bin/sh
set -eu

output_directory='public/assets/system'
output="$output_directory/pipeline-smoke.ktx2"
temporary="$output_directory/.pipeline-smoke.$$.tmp.ktx2"

cleanup() {
  rm -f "$temporary"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

required_version='4.4.2'
for tool in toktx ktx; do
  case "$("$tool" --version 2>&1)" in
    *"$required_version"*) ;;
    *) echo "KTX-Software $required_version is required for $tool" >&2; exit 1 ;;
  esac
done

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
