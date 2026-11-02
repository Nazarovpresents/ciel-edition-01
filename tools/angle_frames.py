#!/usr/bin/env python3
"""Pick N frames of a turntable clip so the perceived rotation speed is uniform.

Generated turntables ease in and out, so sampling at equal *time* gives jerky, uneven steps and a
visible jump at the loop point. Instead we measure how much the picture changes from frame to
frame (the background is static, so that change is the subject turning), accumulate it into a
progress curve, and sample the clip at equal progress increments.

usage: angle_frames.py clip.mp4 [frames=40] [loop_end_frame] [--debug]  → prints frame indices
"""
import subprocess, sys

clip = sys.argv[1]
args = [a for a in sys.argv[2:] if not a.startswith('--')]
N = int(args[0]) if len(args) > 0 else 40
END = int(args[1]) if len(args) > 1 else None
DEBUG = '--debug' in sys.argv
W = 160

probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                        'stream=width,height', '-of', 'csv=p=0', clip], capture_output=True, text=True).stdout.strip()
sw, sh = (int(v) for v in probe.split(','))
H = (sh * W // sw) // 2 * 2
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', clip, '-vf', f'scale={W}:{H}', '-pix_fmt', 'gray',
                      '-f', 'rawvideo', '-'], capture_output=True).stdout
fs = W * H
T = len(raw) // fs
frames = [raw[i * fs:(i + 1) * fs] for i in range(T)]
if END is None or END >= T: END = T - 1

# per-frame change (mean absolute difference to the previous frame), lightly smoothed
d = [0.0]
for t in range(1, END + 1):
    a, b = frames[t], frames[t - 1]
    d.append(sum(abs(a[p] - b[p]) for p in range(fs)) / fs)
ds = [sum(d[max(0, i - 1):i + 2]) / len(d[max(0, i - 1):i + 2]) for i in range(len(d))]
ds[0] = 0.0
# noise floor: fabric sway / codec noise should not count as rotation
floor = sorted(ds)[len(ds) // 8]
ds = [max(0.0, v - floor) for v in ds]
# cumulative progress
C = [0.0]
for t in range(1, END + 1): C.append(C[-1] + ds[t])
total = C[-1] or 1.0

idx = []
for k in range(N):
    target = total * k / N
    best = min(range(END + 1), key=lambda i: (abs(C[i] - target), i))
    if idx and best < idx[-1]: best = idx[-1]
    idx.append(best)
idx[0] = 0

if DEBUG:
    sys.stderr.write(f"frames={T} end={END}\n")
    sys.stderr.write("change/frame: " + ' '.join(f"{v:.1f}" for v in ds[::4]) + "\n")
    sys.stderr.write("progress %:   " + ' '.join(f"{100*v/total:.0f}" for v in C[::4]) + "\n")
print(' '.join(str(i) for i in idx))
