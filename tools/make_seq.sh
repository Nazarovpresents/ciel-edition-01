#!/usr/bin/env bash
# Turn a 360° turntable clip into a seamless 40-frame JPEG sequence.
# usage: [FMT=webp] [WEBP_Q=80] [SEAM=0] [IDX="…"] tools/make_seq.sh clip.mp4 assets/seq/<id>-<view> [frames=40] [width=1440] [loop_end_frame]
set -euo pipefail
CLIP="$1"; OUT="$2"; FRAMES="${3:-40}"; WIDTH="${4:-1440}"; END_OVERRIDE="${5:-}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
TOTAL=$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$CLIP")
ffmpeg -v error -y -i "$CLIP" -frames:v 1 "$TMP/f0.png"
# per-frame PSNR (centre crop) against frame 0 → best loop point in the last 15% of the clip
ffmpeg -v error -y -i "$CLIP" -loop 1 -framerate 24 -t 6 -i "$TMP/f0.png" \
  -filter_complex "[0:v]crop=iw*0.6:ih:iw*0.1:0,scale=192:-2,format=gray[a];[1:v]crop=iw*0.6:ih:iw*0.1:0,scale=192:-2,format=gray[b];[a][b]psnr=stats_file=$TMP/psnr.log" \
  -frames:v "$TOTAL" -f null - >/dev/null 2>&1
END=$(awk -v tot="$TOTAL" '
  { for (i=1;i<=NF;i++){ split($i,kv,":"); if(kv[1]=="n") n=kv[2]; if(kv[1]=="psnr_avg") p=kv[2]; }
    if (p=="inf") p=99; if (n>=tot*0.85 && p>best) { best=p; bn=n } }
  END { print bn-1 }' "$TMP/psnr.log")
if [ -n "$END_OVERRIDE" ]; then END="$END_OVERRIDE"; fi
echo "frames=$TOTAL loop_end=$END"
SEL=""
if [ -n "${IDX:-}" ]; then
  # explicit source-frame indices (e.g. from tools/angle_frames.py); duplicates are allowed
  prev=-1; dup=""
  for idx in $IDX; do
    if [ "$idx" = "$prev" ]; then dup="$dup $idx"; else SEL="${SEL}+eq(n\,${idx})"; fi
    prev=$idx
  done
  echo "indices: $IDX"
else
  for ((k=0;k<FRAMES;k++)); do
    idx=$(( (k*END + FRAMES/2) / FRAMES ))
    SEL="${SEL}+eq(n\,${idx})"
  done
fi
SEL="${SEL#+}"
mkdir -p "$OUT"; rm -f "$OUT"/*.jpg "$OUT"/*.webp
# lossless PNG intermediates
ffmpeg -v error -y -i "$CLIP" -vf "select='${SEL}',scale=${WIDTH}:-2:flags=lanczos" -fps_mode vfr -start_number 0 "$TMP/%02d.png"
# expand duplicate indices (ffmpeg's select emits each distinct source frame once, numbered 00..U-1).
# Map every output position k to its unique-file number u(k) <= k, then fill from the highest k down
# so no source file is overwritten before it has been copied.
if [ -n "${IDX:-}" ]; then
  U=(); prev=-1; u=-1
  for idx in $IDX; do [ "$idx" != "$prev" ] && u=$((u+1)); U+=($u); prev=$idx; done
  for ((k=${#U[@]}-1; k>=0; k--)); do
    src="$(printf "%s/%02d.png" "$TMP" ${U[$k]})"; dst="$(printf "%s/%02d.png" "$TMP" $k)"
    [ "$src" != "$dst" ] && cp "$src" "$dst"
  done
fi
# Seam crossfade: the last SEAM frames dissolve towards frame 00, so a full turn lands exactly
# on the first frame and the loop point is invisible.
SEAM="${SEAM:-4}"
if [ "$SEAM" -gt 0 ]; then
  for ((k=1;k<=SEAM;k++)); do
    idx=$((FRAMES-SEAM-1+k)); w=$(awk -v k=$k -v n=$SEAM 'BEGIN{printf "%.3f", k/(n+1)}')
    src=$(printf "%s/%02d.png" "$TMP" "$idx")
    ffmpeg -v error -y -i "$TMP/00.png" -i "$src" -filter_complex "[0:v][1:v]blend=all_mode=normal:all_opacity=$w" "$TMP/blend.png" && mv "$TMP/blend.png" "$src"
  done
fi
if [ "${FMT:-jpg}" = "webp" ]; then
  for f in "$TMP"/[0-9][0-9].png; do cwebp -quiet -q "${WEBP_Q:-80}" -m 4 -sharp_yuv "$f" -o "$OUT/$(basename "${f%.png}").webp"; done
else
  for f in "$TMP"/[0-9][0-9].png; do ffmpeg -v error -y -i "$f" -q:v 4 -pix_fmt yuvj420p "$OUT/$(basename "${f%.png}").jpg"; done
fi
echo "wrote $(ls "$OUT" | wc -l | tr -d ' ') frames to $OUT ($(du -sh "$OUT" | cut -f1))"
