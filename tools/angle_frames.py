#!/usr/bin/env python3
"""Pick N frames of a turntable clip so the perceived rotation speed is uniform.

Generated turntables ease in and out, so sampling at equal *time* gives jerky, uneven steps and a
visible jump at the loop point. Instead we measure how much the picture changes from frame to
frame (the background is static, so that change is the subject turning), accumulate it into a
progress curve, and sample the clip at equal progress increments.

usage: angle_frames.py clip.mp4 [frames=40] [loop_end_frame] [--debug] [--mode=width]  → prints frame indices
"""
import subprocess, sys

clip = sys.argv[1]
args = [a for a in sys.argv[2:] if not a.startswith('--')]
N = int(args[0]) if len(args) > 0 else 40
END = int(args[1]) if len(args) > 1 else None
DEBUG = '--debug' in sys.argv
W = 160
BAND = (0.0, 1.0)
for a in sys.argv:
    if a.startswith('--w='): W = int(a[4:])
    if a.startswith('--band='): BAND = tuple(float(v) for v in a[7:].split(','))

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

MODE = 'width' if '--mode=width' in sys.argv else 'motion'

def pick_by_curve(C):
    total = C[-1] or 1.0
    out = []
    for k in range(N):
        target = total * k / N
        best = min(range(END + 1), key=lambda i: (abs(C[i] - target), i))
        if out and best < out[-1]: best = out[-1]
        out.append(best)
    out[0] = 0
    # The loop-end frame is the chosen front-facing pose: make sure the last picks actually reach
    # it (the final approach often carries almost no measurable motion and would be skipped).
    tail_target = END - max(1, round((END - out[-4]) / 4))     # last frame one step short of END
    if out[-1] < tail_target:
        out[-1] = tail_target
        out[-2] = max(out[-2], round((out[-3] + tail_target) / 2))
    return out

if MODE == 'width':
    import math, statistics
    # background = temporal median; mask = |frame - bg| > thr; width = robust horizontal extent
    bg = bytearray(fs)
    step = max(1, T // 60)
    for p in range(fs):
        bg[p] = int(statistics.median(frames[t][p] for t in range(0, T, step)))
    THR = 24
    y0, y1 = int(H * BAND[0]), int(H * BAND[1])
    def width_at(t):
        f = frames[t]; cols = [0] * W
        for p in range(y0 * W, y1 * W):
            if abs(f[p] - bg[p]) > THR: cols[p % W] += 1
        total = sum(cols)
        if total < 20: return None
        acc, lo, hi = 0, None, None
        for x in range(W):
            acc += cols[x]
            if lo is None and acc >= total * 0.04: lo = x
            if acc >= total * 0.96: hi = x; break
        return (hi - lo) if (lo is not None and hi is not None) else None
    w = [width_at(t) for t in range(END + 1)]
    last = next((v for v in w if v is not None), 1.0)
    for i in range(len(w)):
        if w[i] is None: w[i] = last
        last = w[i]
    ws = [sum(w[max(0, i - 2):i + 3]) / len(w[max(0, i - 2):i + 3]) for i in range(len(w))]
    n = len(ws)
    t2 = max(range(int(n * 0.3), int(n * 0.7) + 1), key=lambda i: ws[i])   # back (180°)
    t1 = min(range(0, t2 + 1), key=lambda i: ws[i])                         # 90°
    t3 = min(range(t2, n), key=lambda i: ws[i])                             # 270°
    def quarter(i0, i1, base, rising):
        out = {}
        a = max(ws[i0], ws[i1]); b = min(ws[i0], ws[i1])
        for i in range(i0, i1 + 1):
            if a - b < 1e-6: frac = (i - i0) / max(1, i1 - i0)
            else:
                c2 = min(1.0, max(0.0, (ws[i] ** 2 - b ** 2) / (a ** 2 - b ** 2)))
                ang = math.degrees(math.acos(math.sqrt(c2)))
                frac = ang / 90.0 if not rising else 1 - ang / 90.0
            out[i] = base + 90.0 * frac
        return out
    theta = {}
    theta.update(quarter(0, t1, 0, False)); theta.update(quarter(t1, t2, 90, True))
    theta.update(quarter(t2, t3, 180, False)); theta.update(quarter(t3, END, 270, True))
    th = [theta[i] for i in range(END + 1)]
    for i in range(1, len(th)): th[i] = max(th[i], th[i - 1])
    th[-1] = 360.0
    idx = pick_by_curve(th)
    if DEBUG:
        sys.stderr.write(f"frames={T} end={END} t90={t1} t180={t2} t270={t3}\n")
        sys.stderr.write("width: " + ' '.join(f"{v:.0f}" for v in ws[::4]) + "\n")
        sys.stderr.write("theta: " + ' '.join(f"{v:.0f}" for v in th[::4]) + "\n")
    print(' '.join(str(i) for i in idx)); sys.exit(0)

# per-frame change: mean absolute difference to the frame LAG frames earlier (divided by LAG).
# A longer lag lets back-and-forth sway cancel out while steady turning still accumulates.
LAG = 1; FLOOR = 0.125
for a in sys.argv:
    if a.startswith('--lag='): LAG = int(a[6:])
    if a.startswith('--floor='): FLOOR = float(a[8:])
d = [0.0]
for t in range(1, END + 1):
    a, b = frames[t], frames[max(0, t - LAG)]
    k = t - max(0, t - LAG)
    d.append(sum(abs(a[p] - b[p]) for p in range(fs)) / fs / k)
ds = [sum(d[max(0, i - 1):i + 2]) / len(d[max(0, i - 1):i + 2]) for i in range(len(d))]
ds[0] = 0.0
# noise floor: sway / codec noise should not count as rotation
floor = sorted(ds)[int(len(ds) * FLOOR)]
ds = [max(0.0, v - floor) for v in ds]
# cumulative progress
C = [0.0]
for t in range(1, END + 1): C.append(C[-1] + ds[t])
total = C[-1] or 1.0

idx = pick_by_curve(C)

if DEBUG:
    sys.stderr.write(f"frames={T} end={END}\n")
    sys.stderr.write("change/frame: " + ' '.join(f"{v:.1f}" for v in ds[::4]) + "\n")
    sys.stderr.write("progress %:   " + ' '.join(f"{100*v/total:.0f}" for v in C[::4]) + "\n")
print(' '.join(str(i) for i in idx))
