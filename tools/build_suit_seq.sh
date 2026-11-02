#!/usr/bin/env bash
# Build std (1440 JPEG) + 4K (WebP) sequences for one suit view from an upscaled turntable clip.
# usage: tools/build_suit_seq.sh <name e.g. tabac-model> <clip.mp4> <loop_end_frame> <rack|model>
set -euo pipefail
cd "$(dirname "$0")/.."
name=$1; clip=$2; end=$3; kind=$4
w=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$clip")
if [ "$kind" = model ]; then idx=$(python3 -I tools/angle_frames.py "$clip" 40 "$end" --lag=6 --floor=0.3); else idx=$(python3 -I tools/angle_frames.py "$clip" 40 "$end"); fi
echo "$name idx: $idx"
SEAM=0 IDX="$idx" tools/make_seq.sh "$clip" "assets/seq/$name" 40 1440 "$end" | tail -1
SEAM=0 FMT=webp WEBP_Q=80 IDX="$idx" tools/make_seq.sh "$clip" "assets/seq4k/$name" 40 "$w" "$end" | tail -1
