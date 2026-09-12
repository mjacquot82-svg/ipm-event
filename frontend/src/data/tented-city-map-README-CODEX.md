# IPM Tented City Map - Codex Handoff

## Files

- `ipm-tented-city-app-ready.svg` - app-ready SVG. The official map artwork is unchanged; semantic transparent hitboxes are appended in `<g id="interactive-map-overlays">`.
- `ipm-tented-city-map-manifest.json` - machine-readable list of all hitboxes, IDs, labels, categories and coordinates.
- `IPM-2026-Tented-City-Map - Final.pdf` - original official source PDF (keep as source of truth).

## What changed

The PDF/SVG visual artwork was **not redrawn**. Interactive regions were added as zero-opacity SVG `<rect>` elements. This avoids visual drift while letting the React app target booths/areas/roads/POIs by stable IDs.

Current overlay counts: {'special-zone': 3, 'accessible-parking': 1, 'partnership-park': 2, 'vip': 2, 'exhibitor-zone': 39, 'road-or-street': 23, 'poi-marker': 29}. Total: 99.

## Codex implementation guidance

1. Import/render the SVG inline (not as a plain `<img>`) so DOM elements inside it can receive events.
2. Delegate click/tap/keyboard handling to `.map-hitbox`. Read `event.target.dataset.label` and `dataset.category`, or use the element `id`.
3. On selection, visually highlight the selected region by adding a separate visible highlight layer or toggling CSS on the hitbox (e.g. opacity/fill/stroke). Do **not** mutate the base artwork.
4. Keep pan/zoom independent from hitbox semantics. A library such as `@panzoom/panzoom` or the app's existing map zoom implementation can operate on the SVG container.
5. Use `ipm-tented-city-map-manifest.json` for search / "find a location" UI and to map app data to SVG IDs.
6. Preserve the SVG `viewBox="0 0 774 603"`.
7. Validate on staging at mobile widths and test tap targets, zoom, and keyboard focus.

## Important caveat

The source PDF contains vector artwork and text, but its exported SVG converts much of the typography to glyph paths. The semantic layer therefore uses transparent hitboxes over the official artwork rather than trying to rewrite the source objects. That is intentional: it preserves pixel/vector fidelity and gives the app clean interaction targets.

## Suggested first integration milestone

- Render SVG inline in the Tented City map view.
- Pan/zoom.
- Tap a booth/area -> highlight it and show its `data-label`.
- Search manifest labels -> zoom/highlight matching hitbox.
- Keep production untouched until staging validation.
