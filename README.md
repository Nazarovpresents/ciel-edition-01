# CIEL — Édition 01

Immersive single-page product experience for a three-piece jacket collection,
built from an Instagram reference video. Static HTML/CSS/JS, no build step.

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
| `assets/seq/<id>-rack/`, `assets/seq/<id>-model/` | 360° turntable sequences, 40 JPEG frames each (≈2.8 MB per sequence), scrubbed by drag |
| `assets/img/` | Still renders used for tiles, bag thumbnails and first paint |
| `tools/make_seq.sh` | Turns a 5 s turntable clip into a seamless 40-frame sequence (finds the loop point, samples frames) |
| `serve.js` | Tiny static server for local preview |

## Interactions

- **Drag the scene, the slider, or scroll** to rotate the jacket a full 360° on its hanger (light inertia, settles on a crisp frame).
- **‹ 01 › pill, card arrows, swatches, collection tiles** switch product with a quick in-place crossfade. Keyboard: ← →.
- **See it on** crossfades to the on-model turntable; drag to turn the model. `M` toggles view, `B` opens bag, `Esc` closes.
- **Add to bag** keeps a local bag with quantities and subtotal (checkout is a stub).

## Editing products

Products (names, prices, copy, swatch colours) live in the `PRODUCTS` array at
the top of `js/app.js`. A new jacket needs a still `assets/img/rack-<id>.jpg`
and `assets/img/model-<id>-front.jpg`, plus two sequences made with
`tools/make_seq.sh clip.mp4 assets/seq/<id>-rack` and `… <id>-model`.
