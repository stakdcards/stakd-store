# Production Readiness Checklist

What’s left to make the site and manufacturing pipeline production-ready.

---

## 1. Manufacturing pipeline (backend)

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| **Design snapshot** | P0 | Pending | Persist full card design (template, layers, text, image URLs) when user saves/checks out; store in `order_cards.design_snapshot`. |
| **Asset fetcher** | P0 | Pending | Service to resolve template + user asset URLs (player, logo) and return PIL Images or paths for render. |
| **Render holo base** | P0 | Stub | Composite background only (base/overlay/tint) at 300 DPI; no player, no text. |
| **Render hero layer** | P0 | Stub | Composite player, frame, nameplate, stats; transparent outside hero. |
| **PDF Holo Base** | P0 | Stub | Ganging: place card images with 0.125" bleed; 6-up (or 9-up) on 8.5×11"; save to bytes/ Supabase. |
| **PDF Hero Sheet** | P0 | Stub | Ganging + registration marks on first page; transparent background; no solid white. |
| **Trace hero alpha** | P0 | Stub | Raster → vector (OpenCV contour or potrace); output polygon in card coordinates. |
| **Spacer path** | P0 | Stub | Inset hero polygon by 1.5 mm (Shapely); export as second path. |
| **Cut file SVG/DXF** | P0 | Stub | One SVG (or DXF) per order with all hero + spacer paths at ganged positions. |
| **Upload & DB** | P0 | Pending | Upload PDFs and cut file to Supabase Storage; insert `production_files`; link to order. |
| **Async jobs** | P1 | Pending | Queue generation (Celery + Redis or Supabase Edge); poll `/production/status`. |
| **Silhouette reg marks** | P1 | Done (config) | Confirm mark size/position against Silhouette Portrait 4 docs; adjust `config.py` if needed. |

---

## 2. Database & auth

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| **Supabase project** | P0 | Pending | Create project; run `backend/supabase_schema/schema.sql`. |
| **Storage bucket** | P0 | Pending | Bucket for `production` (and optionally `uploads`). |
| **RLS policies** | P0 | Pending | Users can read/write own orders and production files. |
| **Orders from checkout** | P0 | Pending | On payment success, create `orders` + `order_items` + `order_cards` with `design_snapshot`. |
| **Auth** | P0 | Existing? | Supabase Auth or existing; protect production endpoints by `user_id` / `order_id`. |

---

## 3. Frontend

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| **Save design snapshot** | P0 | Pending | On “Save to box” / “Checkout”, send full design (template, layers, text, image URLs) to backend; store in order. |
| **Production UI** | P0 | Pending | “Generate production files” for an order; show status; list and download Holo PDF, Hero PDF, Cut SVG/DXF. |
| **Checkout → order** | P0 | Pending | Checkout creates order in DB and redirects to order confirmation / production page. |

---

## 4. General production

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| **Environment config** | P1 | Pending | API URL, Supabase URL/key, Stripe (if used); no secrets in repo. |
| **CORS** | P1 | Pending | Restrict to your frontend origin(s). |
| **Rate limiting** | P2 | Pending | Optional on `/remove-bg` and production endpoints. |
| **Logging & errors** | P1 | Partial | Structured logs; avoid leaking stack traces to client. |
| **HTTPS** | P1 | Pending | Frontend and backend behind HTTPS in production. |
| **Backups** | P2 | Pending | Supabase backups; any local file storage. |

---

## 5. Suggested implementation order

1. **Supabase + schema** – Create project, run schema, create bucket, RLS.
2. **Design snapshot** – Define JSON shape; save from frontend on save/checkout; store in `order_cards`.
3. **Asset fetcher** – Resolve template + user asset URLs; return images for Python.
4. **Render pipeline** – Implement `render_holo_base_layer` and `render_hero_layer` (and alpha mask).
5. **PDF builders** – Implement ganging + bleed (holo) and reg marks (hero); upload to Storage; write `production_files`.
6. **Cut paths** – Implement trace (OpenCV or potrace) and Shapely inset; build SVG; upload.
7. **Async jobs** – Queue generation; worker runs steps 4–6; update jobs and files.
8. **Frontend** – Production page: trigger generate, poll status, show download links.

---

## 6. Docs reference

- **Manufacturing workflow:** `docs/MANUFACTURING_ARCHITECTURE.md`
- **Technical Q&A (cut lines, ganging, reg marks):** `docs/TECHNICAL_QA.md`
- **Production module:** `backend/production/README.md`
- **DB schema:** `backend/supabase_schema/schema.sql`
