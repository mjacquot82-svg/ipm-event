# IPM 2026 interactive Tented City map (drop-in)

Built from the official 2026 show guide exhibitor list (printed pages 24–29)
and the Tented City visitor map.

## Drop into an existing app (Codex / ChatGPT)

Copy these files into your `ipm-event` app:

| File | What it is |
|---|---|
| `vendors.json` | Every exhibitor: name, category, tent, booth IDs, map rect (`x,y,w,h` as % of the map image) |
| `booths.json` | Every plot on the map as a percentage rectangle |
| `vendors.csv` | Same list, spreadsheet-friendly |
| `map.png` | The colorful visitor map |
| `index.html` + `app.js` + `style.css` | Working standalone widget: search a vendor, map flies there |

Search by vendor name or booth id (`1A-09`, `3A-20`). Indoor vendors
(Rural Living, Artisan Tent, etc.) highlight the whole tent.

Rects are percentages of `map.png`, so they stay correct if you scale the image.

Open `index.html` in a browser to try it. Then point Codex at this folder
and ask it to embed the widget on the event map screen.

Data is current to the Aug 15, 2026 show guide.
