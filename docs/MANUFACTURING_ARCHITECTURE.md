# Manufacturing Workflow Architecture

## Executive Summary

This document defines the backend architecture to transform user card designs into **three production-ready outputs** for the physical "Composite Sandwich" card (2.5" × 3.5", ~75pt thick) and your hardware stack (Canon TR8620a, Silhouette Portrait 4).

---

## 1. Physical Product: The Composite Sandwich

| Layer | Name | Content | Material | Software Output |
|-------|------|---------|----------|-----------------|
| **1** | Background | Art only (no player, no text) | Holographic vinyl on chipboard | **Print File 1: Holo Base** |
| **2** | Spacer | Structural depth (invisible) | Cardstock | **Cut File: Spacer Cut** (1.5mm inset path) |
| **3** | Hero/Top | Player, nameplate, frame, stats | Matte vinyl on cardstock, die-cut | **Print File 2: Hero Sheet** + **Cut File: Hero Cut** |

**Critical constraint:** Spacer is cut **1.5mm smaller** (inset) so it never shows under the top layer.

---

## 2. Hardware Constraints

### Printer: Canon TR8620a
- **Media:** US Letter 8.5" × 11"
- **No white ink:** All "white" must be transparent / unprinted (paper white)
- **Implication:** Hero sheet PDF must use transparency for knockouts; avoid solid white fills

### Cutter: Silhouette Portrait 4
- **Alignment:** Registration marks (black corners) on the **same sheet** as the print
- **Cut data:** Vector cut lines (SVG or DXF) in a **separate** file, aligned to the same coordinate system as the PDF
- **Implication:** PDF and cut file must share a known origin and scale so Silhouette software can overlay them

---

## 3. Three Production Outputs (Backend Requirements)

### A. Print File 1: "Holo Base" (Backgrounds)

| Requirement | Spec |
|-------------|------|
| **Content** | Background artwork only (base/tint/overlay as defined by template; no player, no text) |
| **Bleed** | 0.125" (3.175mm) beyond trim on all sides |
| **Layout** | Gang multiple cards onto 8.5" × 11" (e.g. 9-up or 8-up with margins) |
| **Format** | PDF, 300 DPI (or 600 if printer supports), RGB or CMYK per your print profile |
| **White** | No solid white; use transparent or leave unprinted |

**Card dimensions with bleed:** (2.5 + 0.25)" × (3.5 + 0.25)" = 2.75" × 3.75" per card cell.

---

### B. Print File 2: "Hero Sheet" (Top Layer)

| Requirement | Spec |
|-------------|------|
| **Content** | Player image, nameplate, frame, stats (everything that goes on the top layer) |
| **Knockout** | Area **outside** player/frame must be **transparent** so holo shows through |
| **Registration marks** | Silhouette-compatible marks in corners of the **sheet** (see Section 6) |
| **Layout** | Gang cards onto 8.5" × 11" |
| **Format** | PDF with transparency, same DPI as Holo Base |
| **White** | Same as above: no solid white; use transparency |

---

### C. Cut File: Vector Paths (SVG/DXF)

| Path Type | Description | Use |
|-----------|-------------|-----|
| **Hero Cut** | Outline **exactly** matching the visible player/frame boundary | Cuts the top layer (matte vinyl on cardstock) |
| **Spacer Cut** | Same boundary **inset by 1.5mm** (negative offset) | Cuts the hidden spacer so it stays under the top layer |

**Requirements:**
- One set of paths per card (Hero + Spacer).
- Format: SVG (preferred for web stack) or DXF (if Silhouette workflow requires it).
- Coordinate system must match the PDF (same origin, same units: inches or mm).
- Paths must be closed vectors (no open strokes).

---

## 4. Tech Stack Recommendation

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Database** | **Supabase** (PostgreSQL) | Auth, realtime, storage, SQL; fits Node or Python |
| **Backend** | **Python (FastAPI)** | Already in use; strong for image/PDF (PIL, reportlab, cairosvg, svg.path); easy to add workers |
| **Background jobs** | **Celery + Redis** (or Supabase Edge Functions + pg_cron for simpler) | Generate large PDFs and cut files asynchronously |
| **File storage** | **Supabase Storage** (S3-compatible) | Store source images, generated PDFs, SVGs/DXFs |
| **Frontend** | **Existing (React/Vite)** | No change; calls new backend endpoints for "Generate production files" |

**Why Python over Node for this pipeline:**
- **PDF:** `reportlab` and `PyMuPDF` are mature for ganging and precise layout; `pdf2image`/PIL for raster layers.
- **Vector:** `cairosvg`, `svg.path`, `shapely`, or `potrace` (via subprocess) for trace and offset.
- **Image:** Already using PIL/RemBG; same process can composite hero/background layers.
- **Numerical:** Offsets, bleeds, registration mark positions are straightforward in Python.

**Optional:** If you prefer a single language, Node can drive the pipeline using `pdf-lib`, `sharp`, and a trace/offset library (e.g. `potrace` bindings or external service); Python is still recommended for the heavy lifting of image composition and vector offset.

---

## 5. Database Schema (Supabase/PostgreSQL)

### 5.1 Core Tables

```sql
-- Orders (from your existing cart/checkout flow)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | in_production | shipped | completed
  total_cents INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Order items: one per "box" (or logical grouping)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  box_name TEXT,
  is_mega BOOLEAN DEFAULT false,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cards: one row per physical card (or per design if you gang duplicates)
CREATE TABLE order_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  design_snapshot JSONB NOT NULL,  -- full card design: templateId, layers, text, colors, image URLs, etc.
  quantity INT NOT NULL DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Production outputs: one row per order (or per order_item) per output type
CREATE TABLE production_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL,  -- 'holo_base' | 'hero_sheet' | 'cut_file'
  file_format TEXT NOT NULL,  -- 'pdf' | 'svg' | 'dxf'
  storage_path TEXT NOT NULL,  -- path in Supabase Storage
  storage_bucket TEXT NOT NULL DEFAULT 'production',
  page_count INT,  -- for PDFs
  metadata JSONB,  -- e.g. { "cards_per_sheet": 9, "dpi": 300 }
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(order_id, file_type, file_format)
);

-- Optional: job queue for async generation
CREATE TABLE production_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  job_type TEXT NOT NULL,  -- 'holo_base' | 'hero_sheet' | 'cut_file' | 'all'
  status TEXT NOT NULL DEFAULT 'queued',  -- queued | running | completed | failed
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 5.2 Design Snapshot (JSONB) Shape

`order_cards.design_snapshot` should capture everything needed to regenerate the three outputs without the user session:

```json
{
  "templateId": "slimline",
  "templateName": "Slimline",
  "front": {
    "baseLayerUrl": "/templates/slimline/base.png",
    "overlayLayerUrl": "/templates/slimline/overlay.png",
    "tintLayerUrl": "/templates/slimline/tint.png",
    "playerImageUrl": "https://...", 
    "playerCropBbox": { "x": 0, "y": 0, "width": 500, "height": 800 },
    "playerTransform": { "leftRatio": 0.5, "topRatio": 0.55, "scaleRatio": 1.0 },
    "logoDataUrl": "data:image/png;base64,...",
    "logoTransform": { "leftRatio": 0.1, "topRatio": 0.1, "scaleRatio": 1.0 },
    "text": {
      "playerName": "John Doe",
      "teamName": "Eagles",
      "position": "QB",
      "jerseyNumber": "12"
    },
    "textConfig": { ... },
    "primaryColor": "#00D9FF",
    "secondaryColor": "#000000",
    "colorOverlayOn": true
  },
  "back": { ... },
  "cardSize": { "widthInches": 2.5, "heightInches": 3.5 }
}
```

Store permanent URLs for assets (e.g. Supabase Storage) so the backend can fetch them when generating files.

---

## 6. Cut Line Generation

### 6.1 The Challenge

The "boundary" of the hero layer is defined by:
- The **template’s frame/mask** (vector or raster), and
- The **player image** (raster with transparency).

We need:
1. **Hero cut:** A single closed vector path that matches this boundary.
2. **Spacer cut:** The same path **inset by 1.5mm** (for the hidden spacer).

### 6.2 Recommended Approach: Raster → Vector (Trace)

- **Input:** A **single raster image** (PNG) of the hero layer with **alpha**: opaque where there is player/frame, transparent elsewhere. Same dimensions and orientation as the card (e.g. 750×1050 px at 300 DPI = 2.5"×3.5").
- **Process:**
  1. Extract alpha (or composite hero-only and use alpha as mask).
  2. **Trace** the alpha boundary to get a polygon/path (e.g. **potrace** or **OpenCV contour** → simplify to polygon).
  3. **Convert to SVG path** (and optionally DXF) in the **same coordinate system** as your PDF (e.g. origin top-left, units in inches or mm).
  4. **Spacer path:** Apply a **negative buffer (inset)** of 1.5mm to the hero path (e.g. **Shapely** `object.buffer(-1.5)` in mm, then export to SVG/DXF).

**Libraries:**
- **potrace** (C library; Python bindings: `pypotrace` or subprocess): Raster → vector, very robust.
- **OpenCV** `findContours` + simplify (e.g. Ramer–Douglas–Peucker) → polygon → SVG path.
- **Shapely:** Buffer (inset), union, and export coordinates to SVG/DXF.

**Not recommended:** opentype.js / paper.js in Node for *trace* — they are great for font/vector art but not optimized for raster-to-vector. Use a dedicated trace step (potrace/OpenCV) on the server.

### 6.3 Alternative: Template-Defined Vector Mask

If the hero “frame” is always the same shape per template (e.g. a rounded rectangle with a known cutout), you can:
- Store a **template SVG mask** (path) per template.
- For each card, **union** the template mask with a **traced path of the player alpha** (so the cut follows both frame and player).
- Then apply the same 1.5mm inset for the spacer path.

This hybrid (template vector + traced player) can reduce artifacts and keep frame edges perfectly sharp.

---

## 7. PDF Ganging (Layout)

### 7.1 Specs

- **Sheet:** 8.5" × 11".
- **Card trim:** 2.5" × 3.5".
- **Bleed (Holo Base only):** 0.125" per side → cell size 2.75" × 3.75".
- **Margins:** e.g. 0.5" left/right/top/bottom for registration and grip → usable area ~7.5" × 10".
- **9-up:** 3 columns × 3 rows fits (e.g. 3×2.75" = 8.25", 3×3.75" = 11.25" → need to reduce or use 6-up). So typically **6-up (2×3)** or **8-up** with slightly smaller cards is common; **9-up** may require card size slightly under 2.5×3.5 or reduced margins.

**Practical 9-up:**  
- Cell width = 7.5/3 = 2.5", cell height = 10/3 ≈ 3.33". If you keep 2.5×3.5, you get 6-up (2×3) or 8-up with a different grid. We’ll assume **6-up or 9-up** is configurable; exact math in code.

### 7.2 Implementation (Python)

- **reportlab:** Create a PDF with a fixed page size (8.5×11). For each card in the order (or duplicated by quantity), composite the card image (or draw vector/raster) into the correct cell. Place registration marks in the four corners (see below).
- **PyMuPDF (fitz):** Alternative for faster raster placement and merging.
- **Ganging logic:** Loop over cards; assign each to a cell index `(row, col)`; when a sheet is full, emit one PDF page and start the next. Same for Holo Base and Hero Sheet; Hero Sheet also gets registration marks.

---

## 8. Registration Marks (Silhouette Portrait 4)

### 8.1 Requirement

Silhouette software expects **registration marks printed on the same sheet** so it can align the cut file to the print. Typically:
- **Position:** Near the **corners** of the printable area (or sheet).
- **Shape:** Usually **L-shaped** or **square** marks that the software can detect.
- **Size:** Often ~0.5" × 0.5" or as per Silhouette’s spec (check Silhouette Studio / Portrait 4 docs).
- **Color:** Black on white/transparent for best contrast.

### 8.2 Coordinate System

- Define a **global origin** for the **sheet** (e.g. top-left of the **printable** area, after margins).
- **PDF:** Place marks at fixed positions (e.g. 0.25" from each corner).
- **Cut file (SVG/DXF):** Use the **same origin and units**. The cut paths for each card are at known (x, y) positions that match the ganged card positions in the PDF. Do **not** include the registration marks in the cut file; the cutter uses the **printed** marks to align the **cut data** to the sheet.
- **Result:** When you load the same PDF in the printer and the cut file in Silhouette, and tell Silhouette to “detect registration marks,” it will overlay the cut paths on the printed sheet correctly.

### 8.3 Implementation

- In reportlab (or equivalent), draw **three black squares** (or L-shapes) at the same three corners (e.g. top-left, top-right, bottom-left) of the **first page** (or every page if you cut per sheet). Size and position per Silhouette’s documentation.
- Store the **exact positions** (in inches) in config so that if Silhouette expects a specific offset, you can adjust.

---

## 9. One Design → Three Outputs: Data Flow

```
[Order with order_cards + design_snapshot]
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Production Pipeline (Python backend)                            │
│  1. Fetch all assets (template images, player image, logo).      │
│  2. Render card layers at print resolution (e.g. 300 DPI).       │
│  3. For each output type:                                        │
│     A. Holo Base → composite background only → add bleed →       │
│        gang 6/9-up → PDF.                                        │
│     B. Hero Sheet → composite hero only (transparent bg) →        │
│        add registration marks → gang → PDF.                       │
│     C. Cut File → trace hero alpha → hero path + spacer path      │
│        (inset 1.5mm) → output SVG/DXF per card or per sheet.      │
│  4. Upload PDFs and SVG/DXF to Supabase Storage.                 │
│  5. Insert rows into production_files.                           │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
[User downloads Holo Base PDF, Hero Sheet PDF, Cut File SVG/DXF]
```

---

## 10. API Endpoints (Proposed)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders/{order_id}/production/generate` | Enqueue generation of all three outputs (async). |
| GET | `/api/orders/{order_id}/production/status` | Return status of jobs and links to `production_files`. |
| GET | `/api/orders/{order_id}/production/files` | List production_files (with signed download URLs). |
| GET | `/api/production/spec` | Return constants (bleed, card size, sheet size, mark positions). |

---

## 11. Implementation Phases

1. **Phase 1 – Schema & storage:** Supabase tables, storage bucket, design_snapshot shape.
2. **Phase 2 – Render engine:** From design_snapshot + assets → single-card raster (hero, background) at 300 DPI.
3. **Phase 3 – PDF Holo Base:** Ganging, bleed, 6/9-up, upload.
4. **Phase 4 – PDF Hero Sheet:** Ganging, registration marks, transparency, upload.
5. **Phase 5 – Cut file:** Trace hero alpha → SVG, inset 1.5mm → spacer path, export SVG/DXF, upload.
6. **Phase 6 – Async jobs:** Celery or Edge Functions to run pipeline on order confirmation.
7. **Phase 7 – Frontend:** “Generate production files” button, status polling, download links.

---

## 12. Summary

- **Backend:** Python (FastAPI) with Supabase (PostgreSQL + Storage).
- **Outputs:** (1) Holo Base PDF, (2) Hero Sheet PDF with registration marks, (3) Cut file SVG/DXF with hero and spacer paths.
- **Cut line:** Raster (hero alpha) → trace (potrace/OpenCV) → vector path → inset 1.5mm for spacer.
- **Ganging:** reportlab (or PyMuPDF) with configurable 6-up/9-up.
- **Registration:** Black marks at fixed corners; cut file uses same coordinate system as PDF.

This architecture supports your composite sandwich manufacturing and hardware constraints end-to-end.
