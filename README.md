# Julphar Sales Platform

The live Platform is a private claude.ai artifact: https://claude.ai/artifact/92qontudfDjXKF1HooCGMM
Its data lives in the artifact's own database, not in this repo.

- `CONTEXT.md` — the domain glossary (the words we use and the ones we avoid).
- `docs/adr/` — decisions that are hard to reverse and why they were made.
- `src/` — the page's source: `page.html` (markup with include markers), `app.js`, `store.js` (the one data layer), `css/`, `vendor/`.
- `build.py` — `python3 build.py` writes `dist/Julphar_Platform.html`, the single file that gets published.
- `live/` — the published V43 page as read back on 11 Oct 2026. `src/` was recovered from it with `tools/split_live.py`; rebuilding gives the same page byte for byte.

The original V40–V43 build workspace (separate engine/views modules and the test suites) was not kept, so V43 is recovered as one `app.js`.
