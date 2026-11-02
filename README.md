# CIEL — Édition 01

Immersive single-page product experience for a four-suit tailoring collection
(Minuit, Tabac, Granit, Grenat), built from an Instagram reference video.
Static HTML/CSS/JS, no build step.

## Run locally

```bash
node serve.js 5173
```

Then open http://127.0.0.1:5173 — or simply open `index.html` in a browser
(everything is relative, no server strictly required).

## What's inside

| Path | Purpose |
| --- | --- |
| `index.html` | Page structure: scene, HUD, product card, collection overlay, bag drawer, mobile details sheet |
| `css/styles.css` | Design system (glass UI, forest-green primary), desktop + mobile layouts |
| `js/app.js` | Scene engine (scrub / drag / wheel / keys), compositing crossfades, bag, overlays |
| `assets/seq/<id>-rack/`, `assets/seq/<id>-model/` | 360° turntable sequences, 40 JPEG frames at 1440 px (≈2.5 MB per sequence) — loads first everywhere |
| `assets/seq4k/<id>-rack/`, `assets/seq4k/<id>-model/` | The same 40 frames in 4K WebP (≈7–11 MB per sequence), layered on top for large / high-density screens once loaded |
| `assets/img/` | Still renders (rack 3:2, full-length model 16:9) used for tiles, bag thumbnails and first paint |
| `tools/angle_frames.py` | Picks the 40 source frames of a clip at equal motion increments (even rotation speed, clean loop) |
| `tools/make_seq.sh` | Exports those frames (`IDX="…"` from angle_frames.py, `FMT=webp` for the 4K tier, loop-end frame as 5th argument) |
| `serve.js` | Tiny static server for local preview |

## Interactions

- **Move the mouse over the scene (desktop), drag, use the slider, or scroll** to rotate the jacket a full 360° on its hanger: the slider runs 0→360° left to right and the turn continues seamlessly past 360°. Frames are sampled at equal *motion* increments (`tools/angle_frames.py`), so the speed is even and the loop point is invisible.
- **Leave it alone for ~2.5 s** and the turntable keeps turning on its own (`IDLE_MODE`, `IDLE_DELAY`, `IDLE_TURN_MS` at the top of `js/app.js`; `IDLE_MODE = 'pingpong'` gives a boomerang instead).
- **‹ 01 › pill, card arrows, swatches, collection tiles** switch product with a quick in-place crossfade. Keyboard: ← →.
- **See it on** crossfades to a full-length on-model turntable (wide shot, head to shoes); drag to turn the model. `M` toggles view, `B` opens bag, `Esc` closes.
- **Add to bag** keeps a local bag with quantities and subtotal (checkout is a stub). Sizes are EU tailoring sizes 46–54.

## Editing products

Products (names, prices, copy, swatch colours) live in the `PRODUCTS` array at
the top of `js/app.js`. A new suit needs a still `assets/img/rack-<id>.jpg`
and `assets/img/model-<id>-front.jpg`, plus two sequences made with
`tools/make_seq.sh clip.mp4 assets/seq/<id>-rack` and `… <id>-model`.
