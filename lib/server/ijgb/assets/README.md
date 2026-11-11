# IJGB Homecoming visa ticket assets

- `<design>.jpg` — the six approved reference designs (`ijgb-ticket-designs/`)
  with only the sample per-ticket text removed. Regenerate with
  `python scripts/ijgb/clean_templates.py` (install
  `opencv-contrib-python-headless` for texture-preserving FSR inpainting).
- `fonts/` — Noto Serif Bold, Roboto Mono Medium, IBM Plex Mono Regular, all
  from Google Fonts under the SIL Open Font License 1.1 (free to bundle).

Read at render time by `lib/server/ijgb/render.ts`; shipped to serverless
functions via `outputFileTracingIncludes` in `next.config.ts`.
