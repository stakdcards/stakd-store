"""
Build Print PDF and Master Cut SVG for vinyl on US Letter (8.5 x 11 in).
Ganged layout: 3 heroes (left column) + 3 frames (right column) per sheet.

Consumes temp_assets/{card_id}/:
  - print_layer_2_hero.png, print_layer_3_frame.png
  - hero_cut.svg, frame_cut.svg, hero_spacer.svg, frame_spacer.svg

Outputs (in same folder):
  - print_sheet_vinyl.pdf  (reportlab: reg marks at sheet corners + 6 images)
  - cut_job_master.svg     (svgwrite: hero + frame cut paths at same 6 positions)
  - spacer_job_master.svg  (hero + frame spacer paths at same 6 positions)
"""

import logging
from pathlib import Path
from xml.etree import ElementTree

from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdf_canvas

import svgwrite

from .config import (
    SHEET_WIDTH_INCHES,
    SHEET_HEIGHT_INCHES,
    REG_MARK_SIZE_INCHES,
    SPACER_MATERIAL_LABEL,
    CARD_CELL_WIDTH_WITH_BLEED,
    CARD_CELL_HEIGHT_WITH_BLEED,
)

logger = logging.getLogger(__name__)

# --- Strict grid (inches). Same logic for PDF and SVG. Card cell = 2.5x3.5 + 1/16" bleed. ---
MARG_X_IN = 1.0
MARG_Y_IN = 0.5
COL_SPACING_IN = 3.5
NUM_ROWS = 3
LAYER_W_IN = CARD_CELL_WIDTH_WITH_BLEED   # 2.625"
LAYER_H_IN = CARD_CELL_HEIGHT_WITH_BLEED  # 3.625"
ROW_SPACING_IN = LAYER_H_IN

# Column 1 (Heroes): x = MARG_X, y = MARG_Y + (row * ROW_SPACING)
# Column 2 (Frames): x = MARG_X + COL_SPACING, y = MARG_Y + (row * ROW_SPACING)
def _grid_positions():
    hero_pos = [(MARG_X_IN, MARG_Y_IN + row * ROW_SPACING_IN) for row in range(NUM_ROWS)]
    frame_pos = [(MARG_X_IN + COL_SPACING_IN, MARG_Y_IN + row * ROW_SPACING_IN) for row in range(NUM_ROWS)]
    return hero_pos, frame_pos

HERO_POSITIONS_IN, FRAME_POSITIONS_IN = _grid_positions()

# SVG user units: 72 DPI (match cut_paths.py)
PT_PER_IN = 72
SHEET_W_PT = SHEET_WIDTH_INCHES * PT_PER_IN
SHEET_H_PT = SHEET_HEIGHT_INCHES * PT_PER_IN

# Registration marks: 0.5" inward from sheet corners for 0.5" white space around each mark (Silhouette safe zone)
REG_OFFSET_IN = 0.5

# --- 6-up background sheet (Landscape 11" x 8.5") ---
# 3 cols x 2 rows. 3*2.625=7.875" width, 2*3.625=7.25" height. Centered.
BG6UP_COLS, BG6UP_ROWS = 3, 2
BG6UP_PAGE_IN = (11.0, 8.5)  # landscape
BG6UP_CONTENT_W = BG6UP_COLS * LAYER_W_IN
BG6UP_CONTENT_H = BG6UP_ROWS * LAYER_H_IN
BG6UP_MARG_LEFT = (BG6UP_PAGE_IN[0] - BG6UP_CONTENT_W) / 2
BG6UP_MARG_TOP = (BG6UP_PAGE_IN[1] - BG6UP_CONTENT_H) / 2

# --- 4-up cut sheet (Portrait 8.5" x 11") ---
# 2 cols x 2 rows. 2*2.625=5.25" width, 2*3.625=7.25" height.
CUT4UP_COLS, CUT4UP_ROWS = 2, 2
CUT4UP_PAGE_W_IN = SHEET_WIDTH_INCHES   # 8.5
CUT4UP_PAGE_H_IN = SHEET_HEIGHT_INCHES  # 11
CUT4UP_CONTENT_W = CUT4UP_COLS * LAYER_W_IN
CUT4UP_CONTENT_H = CUT4UP_ROWS * LAYER_H_IN
CUT4UP_MARG_LEFT = (CUT4UP_PAGE_W_IN - CUT4UP_CONTENT_W) / 2
CUT4UP_MARG_TOP = (CUT4UP_PAGE_H_IN - CUT4UP_CONTENT_H) / 2
# Content-only size in pt for SVG viewBox (so content centers on 8.5x11 with preserveAspectRatio)
CUT4UP_CONTENT_W_PT = CUT4UP_CONTENT_W * PT_PER_IN
CUT4UP_CONTENT_H_PT = CUT4UP_CONTENT_H * PT_PER_IN


def _draw_crop_marks_pdf(c: pdf_canvas.Canvas, page_w_pt: float, page_h_pt: float, inset: float = 0.25) -> None:
    """Crop marks for guillotine at the four corners (L-shapes inward)."""
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.5)
    s = inset * inch
    # Top-left
    c.line(s, page_h_pt - s, 0, page_h_pt - s)
    c.line(s, page_h_pt - s, s, page_h_pt)
    # Top-right
    c.line(page_w_pt - s, page_h_pt - s, page_w_pt, page_h_pt - s)
    c.line(page_w_pt - s, page_h_pt - s, page_w_pt - s, page_h_pt)
    # Bottom-left
    c.line(s, s, 0, s)
    c.line(s, s, s, 0)
    # Bottom-right
    c.line(page_w_pt - s, s, page_w_pt, s)
    c.line(page_w_pt - s, s, page_w_pt - s, 0)


def _draw_registration_marks_pdf(c: pdf_canvas.Canvas) -> None:
    """
    Silhouette registration marks inward 0.5" from sheet corners so there is 0.5" white space
    around every mark (safe zone). Square top-left; brackets at other three corners.
    """
    w_pt = SHEET_WIDTH_INCHES * inch
    h_pt = SHEET_HEIGHT_INCHES * inch
    c.setStrokeColorRGB(0, 0, 0)
    c.setFillColorRGB(0, 0, 0)
    half = REG_MARK_SIZE_INCHES * inch / 2
    s = REG_MARK_SIZE_INCHES * inch
    c.setLineWidth(1)
    ox = REG_OFFSET_IN * inch
    oy = REG_OFFSET_IN * inch
    # Square fully INSIDE the registration box (the inner rectangle defined by the L-bracket corners at 0.5").
    # Place square with its top-left at (0.5", 0.5" from top), so it occupies 0.5"-0.7" (center 0.6").
    ox_sq = 0.6 * inch
    oy_sq = 0.6 * inch

    # Top-left: square inside registration box (same side as content, corners align with bracket inner corners)
    cx, cy = ox_sq, h_pt - oy_sq
    c.rect(cx - half, cy - half, REG_MARK_SIZE_INCHES * inch, REG_MARK_SIZE_INCHES * inch, fill=1, stroke=0)

    # Top-right: bracket at (8.0", 0.5")
    cx, cy = w_pt - ox, h_pt - oy
    c.line(cx - s, cy, cx, cy)
    c.line(cx, cy, cx, cy - s)

    # Bottom-left: bracket at (0.5", 10.5")
    cx, cy = ox, oy
    c.line(cx, cy, cx + s, cy)
    c.line(cx, cy, cx, cy + s)

    # Bottom-right: bracket at (8.0", 10.5")
    cx, cy = w_pt - ox, oy
    c.line(cx - s, cy, cx, cy)
    c.line(cx, cy, cx, cy + s)


def _extract_path_d_from_svg(svg_path: Path) -> list[str]:
    """Parse SVG file and return list of path 'd' attribute strings."""
    if not svg_path.is_file():
        return []
    tree = ElementTree.parse(svg_path)
    root = tree.getroot()
    # Handle default namespace
    ns = {"svg": "http://www.w3.org/2000/svg"}
    paths = root.findall(".//svg:path", ns)
    if not paths:
        paths = root.findall(".//{http://www.w3.org/2000/svg}path")
    if not paths:
        paths = root.findall(".//path")
    result = []
    for p in paths:
        d = p.get("d")
        if d:
            result.append(d)
    return result


def _draw_image_on_canvas(
    c: pdf_canvas.Canvas,
    path: Path,
    x_pt: float,
    y_pt: float,
    img_w: float,
    img_h: float,
    jpeg_dir: Path = None,
    slot_id: str = "",
) -> bool:
    """Draw the image at (x_pt, y_pt) with size (img_w, img_h). Writes JPEG to jpeg_dir and uses drawImage(path) for reliability. Returns True if drawn."""
    path = Path(path).resolve()
    exists = path.is_file()
    logger.info("[PDF draw] path=%s exists=%s slot=%s", path, exists, slot_id)
    if not exists:
        return False
    try:
        from PIL import Image
        img = Image.open(path).convert("RGB")
        w, h = img.size
        logger.info("[PDF draw] image size=%dx%d", w, h)
        # Write JPEG to a known directory (same as PDF output) so path is valid for ReportLab
        if jpeg_dir is not None:
            jpeg_dir = Path(jpeg_dir).resolve()
            jpeg_dir.mkdir(parents=True, exist_ok=True)
            jpeg_path = jpeg_dir / f"_pdf_img{slot_id}.jpg"
            img.save(jpeg_path, "JPEG", quality=92)
            path_to_use = str(jpeg_path.resolve())
        else:
            path_to_use = str(path)
        # Use drawImage with file path (most reliable)
        c.drawImage(path_to_use, x_pt, y_pt, width=img_w, height=img_h)
        logger.info("[PDF draw] drawImage done for %s", path_to_use)
        return True
    except Exception as e:
        logger.warning("Could not draw image %s: %s", path, e, exc_info=True)
        return False


def create_background_sheet(images: list, output_path: Path) -> None:
    """
    Build 6-up background PDF(s): 3 cols x 2 rows on Landscape (11" x 8.5") per page.
    Math: 3*2.75"=8.25" width, 2*3.75"=7.5" height (fits on 11" x 8.5").
    images: list of image paths (Path or str). Slot 0 = top-left; row-major. If >6, adds more pages.
    """
    from reportlab.lib.pagesizes import landscape as landscape_fn
    page_size = landscape_fn(letter)
    img_w = LAYER_W_IN * inch
    img_h = LAYER_H_IN * inch
    n_slots_per_page = BG6UP_COLS * BG6UP_ROWS
    chunks = [images[i : i + n_slots_per_page] for i in range(0, len(images), n_slots_per_page)]
    c = pdf_canvas.Canvas(str(output_path), pagesize=page_size)
    w_pt = BG6UP_PAGE_IN[0] * inch
    h_pt = BG6UP_PAGE_IN[1] * inch
    jpeg_dir = Path(output_path).resolve().parent
    logger.info("[PDF] create_background_sheet: output=%s jpeg_dir=%s images_count=%d", output_path, jpeg_dir, len(images))
    for chunk_idx, chunk in enumerate(chunks):
        _draw_crop_marks_pdf(c, w_pt, h_pt)
        for i, img_path in enumerate(chunk):
            path = Path(img_path).resolve()
            if not path.is_file():
                logger.warning("[PDF] skip slot %d: file not found %s", i, path)
                continue
            col, row = i % BG6UP_COLS, i // BG6UP_COLS
            x_in = BG6UP_MARG_LEFT + col * LAYER_W_IN
            y_in = BG6UP_MARG_TOP + row * LAYER_H_IN
            x_pt = x_in * inch
            y_pt = h_pt - (y_in * inch + img_h)
            slot_id = f"_p{chunk_idx}_s{i}"
            if not _draw_image_on_canvas(c, path, x_pt, y_pt, img_w, img_h, jpeg_dir=jpeg_dir, slot_id=slot_id):
                c.setFillColorRGB(0.9, 0.9, 0.9)
                c.rect(x_pt, y_pt, img_w, img_h, fill=1, stroke=0)
        if len(chunks) > 1 and chunk is not chunks[-1]:
            c.showPage()
    c.save()
    logger.info("Saved %s (%d page(s))", output_path, len(chunks))


def _cut_4up_slot_positions() -> list[tuple[float, float]]:
    """Return (x_in, y_in) top-left for each of 4 slots (row-major), matching create_cut_sheet PDF/SVG."""
    pos = []
    for row in range(CUT4UP_ROWS):
        for col in range(CUT4UP_COLS):
            x_in = CUT4UP_MARG_LEFT + col * LAYER_W_IN
            y_in = CUT4UP_MARG_TOP + row * LAYER_H_IN
            pos.append((x_in, y_in))
    return pos


def _cut_4up_slot_positions_content_pt() -> list[tuple[float, float]]:
    """Return (x_pt, y_pt) in content-local coords (0-based) for 4 slots. Use with viewBox=content only so SVG centers on 8.5x11."""
    pos = []
    for row in range(CUT4UP_ROWS):
        for col in range(CUT4UP_COLS):
            x_pt = col * LAYER_W_IN * PT_PER_IN
            y_pt = row * LAYER_H_IN * PT_PER_IN
            pos.append((x_pt, y_pt))
    return pos


def create_cut_sheet(
    svg_paths: list,
    sheet_type: str,
    output_path: Path,
    num_pages: int = 1,
    slot_images: list = None,
) -> None:
    """
    Build 4-up cut PDF: 2 cols x 2 rows on Portrait (8.5" x 11") per page.
    Math: 2*2.75"=5.5" width, 2*3.75"=7.5" height; ~1.5" margins for Silhouette reg marks.
    svg_paths: unused (placeholder); actual cut data is in cut_job_master.svg from build_cut_master_svg_4up.
    sheet_type: 'cut' or 'spacer' (for logging). num_pages: number of pages to draw (for >4 cards).
    slot_images: optional list of lists; slot_images[page] = [path0, path1, path2, path3] to draw in each slot.
    """
    c = pdf_canvas.Canvas(str(output_path), pagesize=letter)
    w_pt = CUT4UP_PAGE_W_IN * inch
    h_pt = CUT4UP_PAGE_H_IN * inch
    positions = _cut_4up_slot_positions()
    img_w = LAYER_W_IN * inch
    img_h = LAYER_H_IN * inch
    slot_images = slot_images or []
    for page in range(num_pages):
        _draw_registration_marks_pdf(c)
        page_slots = slot_images[page] if page < len(slot_images) else []
        for i, (x_in, y_in) in enumerate(positions):
            x_pt = x_in * inch
            y_pt = h_pt - (y_in * inch + img_h)
            if i < len(page_slots):
                path = Path(page_slots[i]).resolve()
                if path.is_file():
                    _draw_image_on_canvas(c, path, x_pt, y_pt, img_w, img_h, jpeg_dir=Path(output_path).resolve().parent, slot_id=f"_4up_p{page}_s{i}")
            c.setStrokeColorRGB(0.5, 0.5, 0.5)
            c.setLineWidth(0.5)
            c.rect(x_pt, y_pt, img_w, img_h)
        if page < num_pages - 1:
            c.showPage()
    c.save()
    logger.info("Saved %s (%s, %d page(s))", output_path, sheet_type, num_pages)


def create_foreground_sheet(foreground_images: list, output_path: Path) -> None:
    """
    Legacy: 4-up with composite foreground per card. Prefer create_foreground_sheet_exploded for part sheets.
    """
    n_slots_per_page = CUT4UP_COLS * CUT4UP_ROWS
    chunks = [foreground_images[i : i + n_slots_per_page] for i in range(0, len(foreground_images), n_slots_per_page)]
    c = pdf_canvas.Canvas(str(output_path), pagesize=letter)
    w_pt = CUT4UP_PAGE_W_IN * inch
    h_pt = CUT4UP_PAGE_H_IN * inch
    positions = _cut_4up_slot_positions()
    img_w = LAYER_W_IN * inch
    img_h = LAYER_H_IN * inch
    jpeg_dir = Path(output_path).resolve().parent
    for page, chunk in enumerate(chunks):
        _draw_registration_marks_pdf(c)
        for i, img_path in enumerate(chunk):
            if i >= len(positions):
                break
            path = Path(img_path).resolve()
            x_in, y_in = positions[i]
            x_pt = x_in * inch
            y_pt = h_pt - (y_in * inch + img_h)
            if path.is_file():
                _draw_image_on_canvas(c, path, x_pt, y_pt, img_w, img_h, jpeg_dir=jpeg_dir, slot_id=f"_fg_p{page}_s{i}")
            c.setStrokeColorRGB(0.5, 0.5, 0.5)
            c.setLineWidth(0.5)
            c.rect(x_pt, y_pt, img_w, img_h)
        if page < len(chunks) - 1:
            c.showPage()
    c.save()
    logger.info("Saved %s (foregrounds 4-up, %d page(s))", output_path, len(chunks))


def create_foreground_sheet_exploded(player_images: list, frame_images: list, output_path: Path) -> None:
    """
    Exploded part sheet: Player and Frame as separate print objects (no composite).
    2x2 grid per page: Quadrant 1 = Card A Player, Quadrant 2 = Card A Frame,
    Quadrant 3 = Card B Player, Quadrant 4 = Card B Frame. Enables 3D layered assembly.
    """
    if len(player_images) != len(frame_images):
        raise ValueError("player_images and frame_images must have the same length")
    # Interleave: [player0, frame0, player1, frame1, ...]
    slot_images = []
    for i in range(len(player_images)):
        slot_images.append(player_images[i])
        slot_images.append(frame_images[i])
    n_slots_per_page = CUT4UP_COLS * CUT4UP_ROWS  # 4
    chunks = [slot_images[j : j + n_slots_per_page] for j in range(0, len(slot_images), n_slots_per_page)]
    c = pdf_canvas.Canvas(str(output_path), pagesize=letter)
    w_pt = CUT4UP_PAGE_W_IN * inch
    h_pt = CUT4UP_PAGE_H_IN * inch
    positions = _cut_4up_slot_positions()
    img_w = LAYER_W_IN * inch
    img_h = LAYER_H_IN * inch
    jpeg_dir = Path(output_path).resolve().parent
    for page, chunk in enumerate(chunks):
        _draw_registration_marks_pdf(c)
        for i, img_path in enumerate(chunk):
            if i >= len(positions):
                break
            path = Path(img_path).resolve()
            x_in, y_in = positions[i]
            x_pt = x_in * inch
            y_pt = h_pt - (y_in * inch + img_h)
            if path.is_file():
                _draw_image_on_canvas(c, path, x_pt, y_pt, img_w, img_h, jpeg_dir=jpeg_dir, slot_id=f"_exp_p{page}_s{i}")
            c.setStrokeColorRGB(0.5, 0.5, 0.5)
            c.setLineWidth(0.5)
            c.rect(x_pt, y_pt, img_w, img_h)
        if page < len(chunks) - 1:
            c.showPage()
    c.save()
    logger.info("Saved %s (foregrounds exploded 2x2, %d page(s))", output_path, len(chunks))


def build_top_layers_cutlines_svg(
    hero_frame_cut_paths: list,
    frame_cut_paths: list,
    output_path: Path,
) -> None:
    """
    Top layers SVG (vinyl kiss cut): 2x2 grid. Left column = merged player+frame (one solid shape per card);
    right column = frame outline only. Full-page viewBox so 1:1 with 4-up print file for Silhouette Studio.
    """
    positions = _cut_4up_slot_positions()
    w_pt = CUT4UP_PAGE_W_IN * PT_PER_IN
    h_pt = CUT4UP_PAGE_H_IN * PT_PER_IN
    dwg = svgwrite.Drawing(
        str(output_path),
        size=(f"{CUT4UP_PAGE_W_IN}in", f"{CUT4UP_PAGE_H_IN}in"),
        viewBox=f"0 0 {w_pt} {h_pt}",
    )
    for i, (x_in, y_in) in enumerate(positions):
        tx = x_in * PT_PER_IN
        ty = y_in * PT_PER_IN
        card_idx = i // 2
        is_left = (i % 2 == 0)
        g = dwg.g(transform=f"translate({tx}, {ty})", stroke="black", stroke_width="0.5")
        if is_left and card_idx < len(hero_frame_cut_paths):
            path = Path(hero_frame_cut_paths[card_idx])
            if path.is_file():
                for d in _extract_path_d_from_svg(path):
                    g.add(dwg.path(d=d, fill="none", stroke="black", stroke_width="0.5"))
        elif not is_left and card_idx < len(frame_cut_paths):
            path = Path(frame_cut_paths[card_idx])
            if path.is_file():
                for d in _extract_path_d_from_svg(path):
                    g.add(dwg.path(d=d, fill="none", stroke="black", stroke_width="0.5"))
        dwg.add(g)
    dwg.save()
    logger.info("Saved %s (top layers: left=merged player+frame, right=frame)", output_path)


def build_spacers_cutlines_svg(
    hero_frame_spacer_paths: list,
    frame_spacer_paths: list,
    output_path: Path,
) -> None:
    """
    Spacers SVG (Heavy Index Cardstock, 0.5mm inset): 2x2 grid. Left column = merged player+frame
    spacer (one solid shape, outer edge flush); right column = frame spacer only.
    Full-page viewBox so 1:1 with 4-up print file for Silhouette Studio.
    """
    positions = _cut_4up_slot_positions()
    w_pt = CUT4UP_PAGE_W_IN * PT_PER_IN
    h_pt = CUT4UP_PAGE_H_IN * PT_PER_IN
    dwg = svgwrite.Drawing(
        str(output_path),
        size=(f"{CUT4UP_PAGE_W_IN}in", f"{CUT4UP_PAGE_H_IN}in"),
        viewBox=f"0 0 {w_pt} {h_pt}",
    )
    for i, (x_in, y_in) in enumerate(positions):
        tx = x_in * PT_PER_IN
        ty = y_in * PT_PER_IN
        card_idx = i // 2
        is_left = (i % 2 == 0)
        g = dwg.g(transform=f"translate({tx}, {ty})", stroke="black", stroke_width="0.5")
        if is_left and card_idx < len(hero_frame_spacer_paths):
            path = Path(hero_frame_spacer_paths[card_idx])
            if path.is_file():
                for d in _extract_path_d_from_svg(path):
                    g.add(dwg.path(d=d, fill="none", stroke="black", stroke_width="0.5"))
        elif not is_left and card_idx < len(frame_spacer_paths):
            path = Path(frame_spacer_paths[card_idx])
            if path.is_file():
                for d in _extract_path_d_from_svg(path):
                    g.add(dwg.path(d=d, fill="none", stroke="black", stroke_width="0.5"))
        dwg.add(g)
    dwg.save()
    logger.info("Saved %s (spacers: left=merged player+frame, right=frame)", output_path)


def build_cut_master_svg_4up(
    hero_svg_paths: list,
    frame_svg_paths: list,
    output_path: Path,
    use_spacer: bool = False,
) -> None:
    """
    Build cut_job_master.svg with 2x2 layout matching create_cut_sheet.
    hero_svg_paths and frame_svg_paths: lists of up to 4 paths each (one per slot).
    Only slots with provided paths are drawn (e.g. 1 card → slot 0 only).
    """
    suffix = "spacer" if use_spacer else "cut"
    positions = _cut_4up_slot_positions()
    w_pt = CUT4UP_PAGE_W_IN * PT_PER_IN
    h_pt = CUT4UP_PAGE_H_IN * PT_PER_IN
    dwg = svgwrite.Drawing(
        str(output_path),
        size=(f"{CUT4UP_PAGE_W_IN}in", f"{CUT4UP_PAGE_H_IN}in"),
        viewBox=f"0 0 {w_pt} {h_pt}",
    )
    for i, (x_in, y_in) in enumerate(positions):
        if i >= len(hero_svg_paths) and i >= len(frame_svg_paths):
            continue
        tx = x_in * PT_PER_IN
        ty = y_in * PT_PER_IN
        g = dwg.g(transform=f"translate({tx}, {ty})")
        if i < len(hero_svg_paths):
            path = Path(hero_svg_paths[i])
            if path.is_file():
                for d in _extract_path_d_from_svg(path):
                    g.add(dwg.path(d=d, fill="none", stroke="black", stroke_width="0.5"))
        if i < len(frame_svg_paths):
            path = Path(frame_svg_paths[i])
            if path.is_file():
                for d in _extract_path_d_from_svg(path):
                    g.add(dwg.path(d=d, fill="none", stroke="black", stroke_width="0.5"))
        dwg.add(g)
    dwg.save()
    logger.info("Saved %s (%s)", output_path, suffix)


def build_print_sheet_pdf(assets_dir: Path, output_path: Path) -> None:
    """
    Create print_sheet_vinyl.pdf: registration marks at sheet corners + 3 heroes + 3 frames.
    (x, y) in layout = top-left of image in inches from sheet top-left. ReportLab origin = bottom-left.
    """
    hero_img = assets_dir / "print_layer_2_hero.png"
    frame_img = assets_dir / "print_layer_3_frame.png"
    if not hero_img.is_file():
        raise FileNotFoundError(f"Missing {hero_img}")
    if not frame_img.is_file():
        raise FileNotFoundError(f"Missing {frame_img}")

    c = pdf_canvas.Canvas(str(output_path), pagesize=letter)
    w_pt = SHEET_WIDTH_INCHES * inch
    h_pt = SHEET_HEIGHT_INCHES * inch

    _draw_registration_marks_pdf(c)

    img_w = LAYER_W_IN * inch
    img_h = LAYER_H_IN * inch
    # Convert (x_in, y_in) top-left to reportlab y (bottom-left origin): y_pt = h_pt - y_in*inch - img_h
    for x_in, y_in in HERO_POSITIONS_IN:
        x_pt = x_in * inch
        y_pt = h_pt - (y_in * inch + img_h)
        c.drawImage(str(hero_img), x_pt, y_pt, width=img_w, height=img_h)
    for x_in, y_in in FRAME_POSITIONS_IN:
        x_pt = x_in * inch
        y_pt = h_pt - (y_in * inch + img_h)
        c.drawImage(str(frame_img), x_pt, y_pt, width=img_w, height=img_h)

    c.save()
    logger.info("Saved %s", output_path)


def build_cut_master_svg(
    assets_dir: Path,
    output_path: Path,
    use_spacer: bool = False,
) -> None:
    """
    Create cut_job_master.svg (or spacer_job_master.svg): 8.5 x 11 in canvas,
    hero cut paths at the 3 hero positions, frame cut paths at the 3 frame positions (same as PDF).
    SVG origin: top-left. Positions in 72 DPI units.
    """
    suffix = "spacer" if use_spacer else "cut"
    hero_svg = assets_dir / f"hero_{suffix}.svg"
    frame_svg = assets_dir / f"frame_{suffix}.svg"
    if not hero_svg.is_file():
        raise FileNotFoundError(f"Missing {hero_svg}")
    if not frame_svg.is_file():
        raise FileNotFoundError(f"Missing {frame_svg}")
    build_cut_master_svg_ganged(
        [hero_svg] * NUM_ROWS,
        [frame_svg] * NUM_ROWS,
        output_path,
        use_spacer=use_spacer,
    )


def build_print_sheet_pdf_ganged(
    hero_image_paths: list,
    frame_image_paths: list,
    output_path: Path,
) -> None:
    """
    Create one print PDF with 3 different hero images (left column) and 3 different frame images (right column).
    hero_image_paths and frame_image_paths must each be 3 paths (Path or str).
    """
    if len(hero_image_paths) != NUM_ROWS or len(frame_image_paths) != NUM_ROWS:
        raise ValueError(f"Need exactly {NUM_ROWS} hero and {NUM_ROWS} frame paths")
    for p in hero_image_paths + frame_image_paths:
        path = Path(p)
        if not path.is_file():
            raise FileNotFoundError(f"Missing image: {path}")

    c = pdf_canvas.Canvas(str(output_path), pagesize=letter)
    w_pt = SHEET_WIDTH_INCHES * inch
    h_pt = SHEET_HEIGHT_INCHES * inch
    _draw_registration_marks_pdf(c)
    img_w = LAYER_W_IN * inch
    img_h = LAYER_H_IN * inch

    for i, (x_in, y_in) in enumerate(HERO_POSITIONS_IN):
        x_pt = x_in * inch
        y_pt = h_pt - (y_in * inch + img_h)
        c.drawImage(str(hero_image_paths[i]), x_pt, y_pt, width=img_w, height=img_h)
    for i, (x_in, y_in) in enumerate(FRAME_POSITIONS_IN):
        x_pt = x_in * inch
        y_pt = h_pt - (y_in * inch + img_h)
        c.drawImage(str(frame_image_paths[i]), x_pt, y_pt, width=img_w, height=img_h)
    c.save()
    logger.info("Saved %s", output_path)


def build_cut_master_svg_ganged(
    hero_svg_paths: list,
    frame_svg_paths: list,
    output_path: Path,
    use_spacer: bool = False,
) -> None:
    """
    Create one cut (or spacer) master SVG with 3 different hero SVGs at hero positions
    and 3 different frame SVGs at frame positions.
    hero_svg_paths and frame_svg_paths must each be 3 paths (Path or str).
    """
    if len(hero_svg_paths) != NUM_ROWS or len(frame_svg_paths) != NUM_ROWS:
        raise ValueError(f"Need exactly {NUM_ROWS} hero and {NUM_ROWS} frame SVG paths")
    for p in hero_svg_paths + frame_svg_paths:
        path = Path(p)
        if not path.is_file():
            raise FileNotFoundError(f"Missing SVG: {path}")

    dwg = svgwrite.Drawing(
        str(output_path),
        size=(f"{SHEET_WIDTH_INCHES}in", f"{SHEET_HEIGHT_INCHES}in"),
        viewBox=f"0 0 {SHEET_W_PT} {SHEET_H_PT}",
    )
    for i, (x_in, y_in) in enumerate(HERO_POSITIONS_IN):
        tx = x_in * PT_PER_IN
        ty = y_in * PT_PER_IN
        g = dwg.g(transform=f"translate({tx}, {ty})")
        for d in _extract_path_d_from_svg(Path(hero_svg_paths[i])):
            g.add(dwg.path(d=d, fill="none", stroke="black", stroke_width="0.5"))
        dwg.add(g)
    for i, (x_in, y_in) in enumerate(FRAME_POSITIONS_IN):
        tx = x_in * PT_PER_IN
        ty = y_in * PT_PER_IN
        g = dwg.g(transform=f"translate({tx}, {ty})")
        for d in _extract_path_d_from_svg(Path(frame_svg_paths[i])):
            g.add(dwg.path(d=d, fill="none", stroke="black", stroke_width="0.5"))
        dwg.add(g)
    dwg.save()
    logger.info("Saved %s", output_path)


def run_for_card(card_id: str) -> None:
    """
    Build print_sheet_vinyl.pdf, cut_job_master.svg, and spacer_job_master.svg
    in temp_assets/{card_id}/.
    """
    backend_dir = Path(__file__).resolve().parent.parent
    assets_dir = backend_dir / "temp_assets" / card_id
    if not assets_dir.is_dir():
        raise FileNotFoundError(f"Assets directory not found: {assets_dir}")

    build_print_sheet_pdf(assets_dir, assets_dir / "print_sheet_vinyl.pdf")
    build_cut_master_svg(assets_dir, assets_dir / "cut_job_master.svg", use_spacer=False)
    build_cut_master_svg(assets_dir, assets_dir / "spacer_job_master.svg", use_spacer=True)
    print("Done: print_sheet_vinyl.pdf, cut_job_master.svg, spacer_job_master.svg")


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    CARD_ID = "82535da4-d4f8-4d65-b387-c17e5ceeba22"
    if len(sys.argv) > 1:
        CARD_ID = sys.argv[1]
    run_for_card(CARD_ID)
