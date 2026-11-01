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
| `assets/img/` | 9 scene renders: 3 rack views, 3 on-model front, 3 on-model back (JPEG, ~230 KB each) |
| `serve.js` | Tiny static server for local preview |

## Interactions

- **Drag the scene, the slider, or scroll** to move along the rail between the three jackets.
- **See it on** switches to the on-model view; drag to turn the model around.
- **Arrows / swatches / collection tiles** jump between products. Keyboard: ← →, `M` toggles view, `B` opens bag, `Esc` closes.
- **Add to bag** keeps a local bag with quantities and subtotal (checkout is a stub).

## Editing products

Products (names, prices, copy, swatch colours, tag anchor points) live in the
`PRODUCTS` array at the top of `js/app.js`. Images follow the naming
`rack-<id>.jpg`, `model-<id>-front.jpg`, `model-<id>-back.jpg`.
