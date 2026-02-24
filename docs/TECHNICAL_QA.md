# Technical Q&A: Cut Lines, Ganging, Registration Marks

Answers to the three implementation questions for the manufacturing backend.

---

## 1. How should we handle Cut Line generation? (Trace PNG → SVG)

**Recommendation: Raster → Vector trace on the server, not opentype.js/paper.js in the browser.**

### Why not opentype.js / paper.js?

- **opentype.js** is for font glyphs and vector typography, not for tracing raster images.
- **paper.js** is great for vector graphics and paths but does not provide raster-to-vector (bitmap tracing). You would have to implement or plug in a tracer yourself.

### Recommended approach: Server-side trace

1. **Input:** A single **raster image** (PNG) of the **hero layer only**, at print resolution (e.g. 750×1050 px = 2.5"×3.5" at 300 DPI), with **alpha**: opaque where the hero (player + frame) is, transparent elsewhere.

2. **Trace the alpha boundary:**
   - **potrace** (C library): Use **pypotrace** or call `potrace` via subprocess. Input: bitmap (e.g. alpha thresholded to 0/1). Output: vector path (SVG or path data). Very robust for smooth outlines.
   - **OpenCV:** `cv2.findContours` on the alpha channel (or inverted), then simplify with **Ramer–Douglas–Peucker** to get a polygon. Convert polygon to SVG `<path d="...">`.

3. **Coordinate system:** Perform trace in **pixels** (same as image). Then convert to **inches** (divide by DPI) so that:
   - Origin = top-left of card.
   - Same scale as your PDF (so when the PDF places the card at (x, y) on the sheet, the cut path at (x, y) aligns).

4. **Spacer path:** Take the **hero path** (polygon) and apply a **negative buffer (inset)** of 1.5 mm:
   - **Shapely:** `polygon.buffer(-1.5 / 25.4)` (in inches) or use mm and convert. This gives the “inner” boundary for the spacer.
   - Export this second polygon to SVG/DXF as the Spacer Cut.

5. **Output:** One SVG (or DXF) file containing:
   - **Hero Cut:** One path per card (exact outline).
   - **Spacer Cut:** One path per card (inset 1.5 mm).
   - Paths positioned at the **same coordinates** as the cards on the ganged PDF (so Silhouette can overlay cut file on printed sheet).

**Libraries:**

- **pypotrace** (or subprocess to `potrace`) for trace.
- **Shapely** for buffer (inset) and any polygon ops.
- **cairosvg** / **svg.path** if you need to manipulate SVG; for output, building the `<path d="...">` string by hand is enough.

**Conclusion:** Do **not** use opentype.js/paper.js for tracing. Use a dedicated **raster-to-vector** step (potrace or OpenCV) on the backend in Python.

---

## 2. Can we automate ganging (e.g. 9 images onto one PDF)?

**Yes. Use a PDF library that supports fixed page size and precise placement.**

### Option A: **reportlab** (Python) – recommended

- Create a canvas with `pagesize=letter` (8.5"×11").
- For each card image (PIL Image or file):
  - Place it at the correct cell position: e.g. row `i`, col `j` →  
    `x = margin_left + j * cell_width`,  
    `y = margin_top - (i+1) * cell_height` (reportlab y from bottom).
  - Use `canvas.drawImage()` with the image path or a temporary file (reportlab accepts file path or `ImageReader` from PIL).
- When a page has 6 (or 9) cards, call `canvas.showPage()` and continue.
- For **Holo Base**, use cell size = card + bleed (2.75"×3.75"); for **Hero Sheet**, use 2.5"×3.5".
- **Result:** One multi-page PDF per output type (Holo Base, Hero Sheet).

### Option B: **PyMuPDF (fitz)**

- Create a new PDF document, add a page with `page.insert_image()` or similar at rect (x0, y0, x1, y1).
- Same layout math as above; good for fast raster placement.

### Option C: **jsPDF** (Node)

- If you keep a Node service: `doc.addImage(imgData, x, y, w, h)` in a loop with the same cell math.
- Slightly more work for transparency and high-DPI; Python/reportlab is still the recommended place for this pipeline.

### Ganging logic (pseudocode)

```text
cards = list of card images (or design_snapshots rendered to images)
cards_per_sheet = 6  # or 9
for page_start in range(0, len(cards), cards_per_sheet):
    page_cards = cards[page_start : page_start + cards_per_sheet]
    for idx, img in enumerate(page_cards):
        row, col = idx // cols, idx % cols
        x = margin_left + col * cell_width
        y = margin_top - (row + 1) * cell_height
        canvas.drawImage(img, x, y, width=cell_width, height=cell_height)
    canvas.showPage()
```

**Conclusion:** Yes, ganging is automatable with **reportlab** (or PyMuPDF/jsPDF); the pipeline uses reportlab with the layout defined in `production/config.py`.

---

## 3. How do we ensure Registration Marks match the Silhouette coordinate system?

**Use one consistent coordinate system for both the PDF and the cut file.**

### Requirements

- **Printed sheet:** PDF with artwork + **registration marks** (black squares/L-shapes) at **fixed positions** on the sheet (e.g. three corners).
- **Cut file (SVG/DXF):** Cut paths are in the **same coordinate system** (same origin, same units, same orientation) as the PDF. The Silhouette software does **not** use the registration marks from the SVG; it uses the **printed** marks on the paper to align the **cut file** to the physical sheet.

### Implementation

1. **Define a single coordinate system:**
   - **Origin:** e.g. top-left corner of the **sheet** (0, 0).
   - **Units:** inches (or mm) everywhere.
   - **X:** left → right. **Y:** top → bottom (or bottom → top; be consistent).

2. **PDF (reportlab):**
   - reportlab’s default is **origin at bottom-left**. So for “top-left of sheet” you use `y = page_height - y_from_top`.
   - Draw registration marks at **fixed sheet positions**, e.g.:
     - Top-left: (0.25", 0.25" from top) → in reportlab: (0.25*72, page_height - 0.25*72).
     - Top-right: (8.25", 0.25" from top).
     - Bottom-left: (0.25", 10.75" from top).
   - Draw card artwork at the **same** positions you will use in the cut file (e.g. margin_left + col*card_width, etc.).

3. **Cut file (SVG):**
   - Use the **same** origin and units. For example:
     - `<svg viewBox="0 0 8.5 11" width="8.5in" height="11in">` (inches).
     - Or use mm: `viewBox="0 0 215.9 279.4"` (8.5×11 in mm).
   - Place each card’s **Hero** and **Spacer** paths at the **exact** (x, y) where that card’s top-left corner is on the PDF (e.g. margin_left + col*card_width, margin_top + row*card_height, in a consistent Y convention).
   - **Do not** draw registration marks in the SVG; the cutter only needs the paths. The **printed** PDF has the marks; Silhouette detects those from the scan/camera and then applies the cut file in the same coordinates.

4. **Silhouette workflow:**
   - User prints the PDF (with reg marks) on the Canon.
   - User loads the **same** PDF (or a separate “cut only” SVG/DXF) in Silhouette Studio.
   - User runs “Register” / “Detect registration marks”; the software finds the three black marks and learns the sheet position and possible skew.
   - User sends the cut file; the software overlays the cut paths using the **same** coordinate system. So as long as your PDF and SVG use the same origin and scale, alignment will match.

5. **Matching the Silhouette spec:**
   - Check Silhouette Portrait 4 / Studio documentation for:
     - Recommended **mark size** (e.g. 0.2"×0.2").
     - **Exact positions** (distance from corner).
     - Whether they use 3 or 4 corners.
   - Put those values in `production/config.py` (e.g. `REG_MARK_OFFSET_X_INCHES`, `REG_MARK_SIZE_INCHES`) and use them for both PDF and any docs. The **cut file** doesn’t contain the marks; it just uses the same (x, y) system as the PDF so that when Silhouette aligns to the printed marks, the paths land on the artwork.

**Conclusion:** Use **one** coordinate system (e.g. inches, origin top-left of sheet) for PDF and SVG. Draw registration marks on the **PDF only** at fixed positions per Silhouette’s spec. Place card artwork and cut paths at the same (x, y) so that when Silhouette aligns to the printed marks, cuts match the print.
