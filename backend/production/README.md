# Production Pipeline Module

One design → three outputs for the Composite Sandwich card manufacturing workflow.

## Outputs

1. **Holo Base PDF** – Background artwork only, 0.125" bleed, ganged (e.g. 6-up) on 8.5×11".
2. **Hero Sheet PDF** – Player + frame + text, transparent knockout, registration marks, ganged.
3. **Cut File (SVG/DXF)** – Hero cut path (exact outline) + Spacer cut path (1.5 mm inset).

## Module Layout

- `config.py` – Card size, sheet size, bleed, spacer inset, DPI, registration mark positions.
- `render.py` – Render a single card to raster: `render_holo_base_layer()`, `render_hero_layer()`, `render_hero_alpha_mask()`.
- `pdf_builder.py` – Build ganged PDFs: `build_holo_base_pdf()`, `build_hero_sheet_pdf()` with reg marks.
- `cut_paths.py` – Trace hero alpha to vector, inset for spacer: `generate_cut_paths_svg()`, `build_cut_file_svg()`.

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Config | Done | All constants in `config.py` |
| Render (holo/hero) | Stub | Placeholder PIL images; needs template + asset fetch |
| Render (alpha mask) | Stub | Returns hero alpha for trace |
| PDF Holo Base | Stub | Layout loop; needs `drawImage` from PIL |
| PDF Hero Sheet | Stub | Layout + reg marks; needs image placement |
| Cut paths (trace) | Stub | Needs potrace or OpenCV contour + simplify |
| Cut paths (inset) | Stub | Needs Shapely `buffer(-1.5mm)` |
| API endpoints | Done | `/api/production/spec`, `/api/orders/{id}/production/*` |
| Supabase schema | Done | `supabase_schema/schema.sql` |
| Async jobs | Not started | Use Celery or Supabase Edge + pg_cron |

## Next Steps

1. **Asset fetcher** – Load template images and user assets (player, logo) from URLs in `design_snapshot`.
2. **Compositing** – Implement full layer stack in `render.py` (base, overlay, tint, player, text).
3. **PDF drawing** – Use reportlab `drawImage` with PIL Image or temp files for each card.
4. **Trace** – Integrate OpenCV `findContours` or potrace; output Shapely polygon.
5. **Inset** – Shapely `polygon.buffer(-spacer_mm)` and export to SVG path.
6. **Storage** – Upload PDF/SVG to Supabase Storage; write `production_files` rows.
7. **Jobs** – Enqueue on `POST /generate`; worker runs pipeline and updates `production_jobs`.

See `docs/MANUFACTURING_ARCHITECTURE.md` and `docs/TECHNICAL_QA.md` for full spec and Q&A.
