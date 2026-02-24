"""
Generate SVG cut files for Silhouette Portrait 4 from print-ready layers.

Uses opencv-python-headless for tracing (alpha → contours), shapely for
geometry/inset, svgwrite for SVG output.

Input: 300 DPI images (e.g. print_layer_2_hero.png, print_layer_3_frame.png).
Output: 72 DPI SVG coordinates: svg_val = pixel_val * (72 / 300).
Canvas: 2.625" x 3.625" (2.5x3.5 card + 1/16" bleed).
"""

import logging
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np
import svgwrite
from shapely.geometry import Polygon
from shapely.ops import unary_union

from .config import (
    BLEED_INCHES,
    CARD_CELL_HEIGHT_WITH_BLEED,
    CARD_CELL_WIDTH_WITH_BLEED,
)

logger = logging.getLogger(__name__)

# --- Constants (match config: 2.5x3.5 card + 1/16" bleed) ---
INPUT_DPI = 300
OUTPUT_DPI = 72
SCALE = OUTPUT_DPI / INPUT_DPI  # pixel → SVG unit
CANVAS_W_IN = CARD_CELL_WIDTH_WITH_BLEED   # 2.625"
CANVAS_H_IN = CARD_CELL_HEIGHT_WITH_BLEED  # 3.625"
CANVAS_W_PX_DEFAULT = int(CANVAS_W_IN * INPUT_DPI)   # 788
CANVAS_H_PX_DEFAULT = int(CANVAS_H_IN * INPUT_DPI)   # 1088
CANVAS_W_SVG = round(CANVAS_W_PX_DEFAULT * SCALE)   # ~189
CANVAS_H_SVG = round(CANVAS_H_PX_DEFAULT * SCALE)   # ~261

# Cut at trim (2.5" x 3.5"), not at card+bleed edge: inset by 1/16" on all sides.
TRIM_BLEED_INSET_PX = round(BLEED_INCHES * INPUT_DPI)

# 0.5 mm inset for spacer (inner shapes only; outer card border has offset 0 for flush edge).
SPACER_INSET_MM = 0.5
SPACER_INSET_PX = round(SPACER_INSET_MM / 25.4 * INPUT_DPI)

# Tolerance (px) to treat a polygon as the full-card outer boundary.
OUTER_BORDER_TOLERANCE_PX = 5


def _get_alpha_binary(image_path: Path) -> Optional[np.ndarray]:
    """
    Load image, extract alpha channel, threshold at 128 (matches render.py hardened edges).
    Alpha > 128 → 255 (opaque), else 0. Produces hard edges for accurate contour tracing.
    """
    img = cv2.imread(str(image_path), cv2.IMREAD_UNCHANGED)
    if img is None:
        logger.error("Could not load image: %s", image_path)
        return None
    if img.ndim == 2:
        alpha = img
    elif img.shape[2] == 4:
        alpha = img[:, :, 3]
    else:
        # No alpha: treat as fully opaque
        alpha = np.full((img.shape[0], img.shape[1]), 255, dtype=np.uint8)
    binary = (alpha >= 128).astype(np.uint8) * 255
    return binary


def _contour_to_ring(cnt: np.ndarray) -> List[Tuple[float, float]]:
    """Convert OpenCV contour (n,1,2) to list of (x,y), closed."""
    pts = cnt.reshape(-1, 2).tolist()
    if not pts:
        return []
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    return [tuple(map(float, p)) for p in pts]


def _build_polygons_from_contours(
    contours: List[np.ndarray],
    hierarchy: np.ndarray,
) -> List[Polygon]:
    """
    Build Shapely Polygons from contours with RETR_CCOMP hierarchy.
    Outer contours (parent=-1) become polygon exteriors; their direct children become holes.
    """
    if hierarchy is None or len(contours) == 0:
        return []

    # hierarchy shape (1, N, 4): [next, prev, first_child, parent]
    H = hierarchy[0]
    polygons = []

    for i, cnt in enumerate(contours):
        parent = H[i][3]
        if parent != -1:
            continue  # This is a hole; handled when we process its parent

        exterior = _contour_to_ring(cnt)
        if len(exterior) < 4:
            continue

        holes = []
        child_idx = H[i][2]
        while child_idx != -1:
            hole_ring = _contour_to_ring(contours[child_idx])
            if len(hole_ring) >= 4:
                holes.append(hole_ring)
            child_idx = H[child_idx][0]  # next sibling

        try:
            if holes:
                poly = Polygon(exterior, holes=holes)
            else:
                poly = Polygon(exterior)
            if not poly.is_valid:
                poly = poly.buffer(0)
            if not poly.is_empty:
                polygons.append(poly)
        except Exception as e:
            logger.warning("Skipping contour %s: %s", i, e)

    return polygons


def _polygons_to_svg_path_d(polygons: List[Polygon], scale: float = SCALE) -> str:
    """Convert Shapely polygon(s) to SVG path 'd' string. Scale pixel coords to SVG units."""
    parts = []
    for poly in polygons:
        if poly.is_empty:
            continue
        if hasattr(poly, "geoms"):
            # MultiPolygon
            for g in poly.geoms:
                parts.append(_one_poly_to_d(g, scale))
        else:
            parts.append(_one_poly_to_d(poly, scale))
    return " ".join(parts)


def _one_poly_to_d(poly: Polygon, scale: float) -> str:
    """Single polygon to SVG path d: exterior + holes."""
    tokens = []
    # Exterior (counter-clockwise for positive fill)
    ext = poly.exterior
    if ext is None:
        return ""
    coords = [(x * scale, y * scale) for x, y in ext.coords]
    if len(coords) < 2:
        return ""
    tokens.append("M {:.4f} {:.4f}".format(coords[0][0], coords[0][1]))
    for i in range(1, len(coords)):
        tokens.append("L {:.4f} {:.4f}".format(coords[i][0], coords[i][1]))
    tokens.append("Z")
    # Holes (each as subpath)
    for interior in poly.interiors:
        coords = [(x * scale, y * scale) for x, y in interior.coords]
        if len(coords) < 2:
            continue
        tokens.append("M {:.4f} {:.4f}".format(coords[0][0], coords[0][1]))
        for i in range(1, len(coords)):
            tokens.append("L {:.4f} {:.4f}".format(coords[i][0], coords[i][1]))
        tokens.append("Z")
    return " ".join(tokens)


def _is_outer_border(poly: Polygon, canvas_w_px: float, canvas_h_px: float) -> bool:
    """
    True if this polygon's exterior is the card edge (full canvas bounds).
    Such paths get offset=0 on the spacer so the outermost line stays flush with the card edge.
    Uses bounds so frame (rectangle with window hole) is treated as outer even when area is small.
    """
    if poly.is_empty:
        return False
    minx, miny, maxx, maxy = poly.bounds
    return (
        minx <= OUTER_BORDER_TOLERANCE_PX
        and miny <= OUTER_BORDER_TOLERANCE_PX
        and maxx >= canvas_w_px - OUTER_BORDER_TOLERANCE_PX
        and maxy >= canvas_h_px - OUTER_BORDER_TOLERANCE_PX
    )


def _trim_rect_polygon(canvas_w_px: int, canvas_h_px: int, keep_holes_from: Optional[Polygon] = None) -> Polygon:
    """
    Polygon for the trim rectangle (2.5" x 3.5"): canvas inset by 1/16" bleed on all sides.
    Cut lines will be at trim, not at the outer bleed edge.
    If keep_holes_from is provided (e.g. frame with window), its interiors are used as holes.
    """
    i = TRIM_BLEED_INSET_PX
    exterior = [
        (i, i),
        (canvas_w_px - i, i),
        (canvas_w_px - i, canvas_h_px - i),
        (i, canvas_h_px - i),
        (i, i),
    ]
    if keep_holes_from and not keep_holes_from.is_empty and hasattr(keep_holes_from, "interiors") and keep_holes_from.interiors:
        return Polygon(exterior, list(keep_holes_from.interiors))
    return Polygon(exterior)


def _is_trim_rect_border(poly: Polygon, canvas_w_px: float, canvas_h_px: float) -> bool:
    """True if this polygon is the trim-rect outline (card edge at 2.5" x 3.5")."""
    if poly.is_empty:
        return False
    i = TRIM_BLEED_INSET_PX
    minx, miny, maxx, maxy = poly.bounds
    return (
        minx <= i + OUTER_BORDER_TOLERANCE_PX
        and miny <= i + OUTER_BORDER_TOLERANCE_PX
        and maxx >= canvas_w_px - i - OUTER_BORDER_TOLERANCE_PX
        and maxy >= canvas_h_px - i - OUTER_BORDER_TOLERANCE_PX
    )


def _expand_holes_for_spacer(poly: Polygon, inset_px: float) -> Optional[Polygon]:
    """
    Keep exterior as-is; expand each hole by inset_px (so spacer hole is larger/hidden).
    Returns new polygon or None if invalid. Hole rings are reversed for Shapely (opposite to exterior).
    """
    if not poly.interiors:
        return poly
    new_holes = []
    for interior in poly.interiors:
        ring = list(interior.coords)
        if len(ring) < 3:
            continue
        hole_poly = Polygon(ring)
        if hole_poly.is_empty or not hole_poly.is_valid:
            hole_poly = hole_poly.buffer(0)
        expanded = hole_poly.buffer(inset_px)
        if expanded.is_empty:
            continue
        if hasattr(expanded, "exterior") and expanded.exterior is not None:
            # Reverse so hole has opposite orientation to exterior for Shapely
            new_holes.append(list(expanded.exterior.coords)[::-1])
        elif hasattr(expanded, "geoms"):
            for g in expanded.geoms:
                if g.exterior is not None:
                    new_holes.append(list(g.exterior.coords)[::-1])
                    break
    if not new_holes:
        return poly
    try:
        return Polygon(poly.exterior.coords, new_holes)
    except Exception:
        return poly


def process_layer(image_path: Path, output_base_name: str) -> Tuple[Path, Path]:
    """
    Trace alpha from image, produce cut and spacer SVGs for Silhouette Portrait 4.

    1. Load image, alpha channel, threshold 128, find contours (RETR_CCOMP).
    2. Convert to Shapely polygons (outer = shape, inner = holes).
    3. Cut file: exact trace → {output_base_name}_cut.svg.
    4. Spacer file: buffer(-1.5mm) ≈ buffer(-18 px) → {output_base_name}_spacer.svg.

    Returns (path_to_cut_svg, path_to_spacer_svg).
    """
    binary = _get_alpha_binary(image_path)
    if binary is None:
        raise FileNotFoundError(f"Could not load or get alpha: {image_path}")

    contours, hierarchy = cv2.findContours(
        binary,
        cv2.RETR_CCOMP,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    if not contours:
        logger.warning("No contours found in %s", image_path)
        # Write empty SVGs so files exist
        out_dir = image_path.parent
        cut_path = out_dir / f"{output_base_name}_cut.svg"
        spacer_path = out_dir / f"{output_base_name}_spacer.svg"
        _write_empty_svg(cut_path)
        _write_empty_svg(spacer_path)
        return cut_path, spacer_path

    polygons = _build_polygons_from_contours(contours, hierarchy)
    if not polygons:
        logger.warning("No valid polygons from %s", image_path)
        out_dir = image_path.parent
        cut_path = out_dir / f"{output_base_name}_cut.svg"
        spacer_path = out_dir / f"{output_base_name}_spacer.svg"
        _write_empty_svg(cut_path)
        _write_empty_svg(spacer_path)
        return cut_path, spacer_path

    # Merge multiple polygons into one geometry for consistent handling
    union = unary_union(polygons)
    if hasattr(union, "geoms"):
        cut_polys = list(union.geoms)
    else:
        cut_polys = [union]

    canvas_h_px, canvas_w_px = binary.shape[0], binary.shape[1]
    # Replace outer-edge polygons with trim rect (2.5" x 3.5") so cuts are at trim, not bleed edge.
    cut_polys = [
        _trim_rect_polygon(canvas_w_px, canvas_h_px, keep_holes_from=poly if _is_outer_border(poly, canvas_w_px, canvas_h_px) else None)
        if _is_outer_border(poly, canvas_w_px, canvas_h_px)
        else poly
        for poly in cut_polys
    ]

    out_dir = image_path.parent
    cut_path = out_dir / f"{output_base_name}_cut.svg"
    spacer_path = out_dir / f"{output_base_name}_spacer.svg"

    # Cut SVG: exact trace (at trim)
    path_d_cut = _polygons_to_svg_path_d(cut_polys)
    _write_svg(cut_path, path_d_cut)

    # Spacer: selective offset — outer card border at trim (no offset); inner shapes get -0.5mm.
    spacer_geoms = []
    for poly in cut_polys:
        if _is_trim_rect_border(poly, canvas_w_px, canvas_h_px):
            # Trim rect: keep as-is but expand holes for spacer.
            if poly.interiors:
                expanded_poly = _expand_holes_for_spacer(poly, SPACER_INSET_PX)
                if expanded_poly and not expanded_poly.is_empty:
                    spacer_geoms.append(expanded_poly)
            else:
                spacer_geoms.append(poly)
        else:
            # Inner shape (player silhouette or non-border): shrink by 0.5mm.
            buffered = poly.buffer(-SPACER_INSET_PX)
            if buffered.is_empty:
                continue
            if hasattr(buffered, "geoms"):
                spacer_geoms.extend(buffered.geoms)
            else:
                spacer_geoms.append(buffered)
    if spacer_geoms:
        path_d_spacer = _polygons_to_svg_path_d(spacer_geoms)
        _write_svg(spacer_path, path_d_spacer)
    else:
        _write_empty_svg(spacer_path)

    return cut_path, spacer_path


def process_layer_union(
    image_path_a: Path,
    image_path_b: Path,
    output_cut_path: Path,
) -> Path:
    """
    Merge two layer alphas (union), trace once, and write a single cut SVG so overlapping
    regions become one solid shape (no double cuts). Used for "player + frame" top layer.
    """
    binary_a = _get_alpha_binary(image_path_a)
    binary_b = _get_alpha_binary(image_path_b)
    if binary_a is None or binary_b is None:
        logger.warning("Could not load one or both images for union; writing empty SVG")
        _write_empty_svg(output_cut_path)
        return output_cut_path

    # Ensure same size (use shape of first; resize second if needed)
    h_a, w_a = binary_a.shape[0], binary_a.shape[1]
    h_b, w_b = binary_b.shape[0], binary_b.shape[1]
    if (h_a, w_a) != (h_b, w_b):
        binary_b = cv2.resize(binary_b, (w_a, h_a), interpolation=cv2.INTER_NEAREST)

    # Union: opaque in either -> opaque
    combined = np.maximum(binary_a, binary_b)

    contours, hierarchy = cv2.findContours(
        combined,
        cv2.RETR_CCOMP,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    if not contours:
        logger.warning("No contours in merged layer; writing empty SVG")
        _write_empty_svg(output_cut_path)
        return output_cut_path

    polygons = _build_polygons_from_contours(contours, hierarchy)
    if not polygons:
        logger.warning("No valid polygons from merged layer; writing empty SVG")
        _write_empty_svg(output_cut_path)
        return output_cut_path

    # Merge overlapping polygons into solid shape(s)
    union = unary_union(polygons)
    if hasattr(union, "geoms"):
        cut_polys = list(union.geoms)
    else:
        cut_polys = [union]

    # Cut at trim (2.5" x 3.5"): replace outer-edge polys with trim rect.
    canvas_h_px, canvas_w_px = h_a, w_a
    cut_polys = [
        _trim_rect_polygon(canvas_w_px, canvas_h_px, keep_holes_from=poly if _is_outer_border(poly, canvas_w_px, canvas_h_px) else None)
        if _is_outer_border(poly, canvas_w_px, canvas_h_px)
        else poly
        for poly in cut_polys
    ]

    path_d = _polygons_to_svg_path_d(cut_polys)
    _write_svg(output_cut_path, path_d)
    logger.info("Saved merged cut %s (union of %s + %s)", output_cut_path, image_path_a.name, image_path_b.name)
    return output_cut_path


def process_layer_union_spacer(
    image_path_a: Path,
    image_path_b: Path,
    output_spacer_path: Path,
) -> Path:
    """
    Union two layer alphas, then apply spacer logic (outer edge flush, inner shapes inset),
    merge to one solid shape, and write a single spacer SVG. Used for left column of spacer sheet.
    """
    binary_a = _get_alpha_binary(image_path_a)
    binary_b = _get_alpha_binary(image_path_b)
    if binary_a is None or binary_b is None:
        logger.warning("Could not load one or both images for spacer union; writing empty SVG")
        _write_empty_svg(output_spacer_path)
        return output_spacer_path

    h_a, w_a = binary_a.shape[0], binary_a.shape[1]
    h_b, w_b = binary_b.shape[0], binary_b.shape[1]
    if (h_a, w_a) != (h_b, w_b):
        binary_b = cv2.resize(binary_b, (w_a, h_a), interpolation=cv2.INTER_NEAREST)

    combined = np.maximum(binary_a, binary_b)
    contours, hierarchy = cv2.findContours(
        combined,
        cv2.RETR_CCOMP,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    if not contours:
        _write_empty_svg(output_spacer_path)
        return output_spacer_path

    polygons = _build_polygons_from_contours(contours, hierarchy)
    if not polygons:
        _write_empty_svg(output_spacer_path)
        return output_spacer_path

    canvas_h_px, canvas_w_px = combined.shape[0], combined.shape[1]
    # Replace outer border with trim rect, then apply spacer logic.
    cut_polys = [
        _trim_rect_polygon(canvas_w_px, canvas_h_px, keep_holes_from=poly if _is_outer_border(poly, canvas_w_px, canvas_h_px) else None)
        if _is_outer_border(poly, canvas_w_px, canvas_h_px)
        else poly
        for poly in polygons
    ]
    spacer_geoms = []
    for poly in cut_polys:
        if _is_trim_rect_border(poly, canvas_w_px, canvas_h_px):
            if poly.interiors:
                expanded = _expand_holes_for_spacer(poly, SPACER_INSET_PX)
                if expanded and not expanded.is_empty:
                    spacer_geoms.append(expanded)
            else:
                spacer_geoms.append(poly)
        else:
            buffered = poly.buffer(-SPACER_INSET_PX)
            if buffered.is_empty:
                continue
            if hasattr(buffered, "geoms"):
                spacer_geoms.extend(buffered.geoms)
            else:
                spacer_geoms.append(buffered)

    if not spacer_geoms:
        _write_empty_svg(output_spacer_path)
        return output_spacer_path

    # Merge to one solid shape so overlapping regions don't double-cut
    union = unary_union(spacer_geoms)
    if hasattr(union, "geoms"):
        out_polys = list(union.geoms)
    else:
        out_polys = [union]
    path_d = _polygons_to_svg_path_d(out_polys)
    _write_svg(output_spacer_path, path_d)
    logger.info("Saved merged spacer %s (union of %s + %s)", output_spacer_path, image_path_a.name, image_path_b.name)
    return output_spacer_path


def _write_svg(file_path: Path, path_d: str) -> None:
    """Write SVG with canvas 2.625" x 3.625" (card + 1/16" bleed)."""
    dwg = svgwrite.Drawing(
        str(file_path),
        size=(f"{CANVAS_W_SVG}", f"{CANVAS_H_SVG}"),
        viewBox=f"0 0 {CANVAS_W_SVG} {CANVAS_H_SVG}",
    )
    if path_d:
        dwg.add(dwg.path(d=path_d, fill="none", stroke="black", stroke_width="0.5"))
    dwg.save()
    logger.info("Saved %s", file_path)


def _write_empty_svg(file_path: Path) -> None:
    """Write minimal SVG with no paths (empty canvas)."""
    dwg = svgwrite.Drawing(
        str(file_path),
        size=(f"{CANVAS_W_SVG}", f"{CANVAS_H_SVG}"),
        viewBox=f"0 0 {CANVAS_W_SVG} {CANVAS_H_SVG}",
    )
    dwg.save()
    logger.info("Saved empty %s", file_path)


def run_for_card(card_id: str) -> None:
    """
    Run process_layer for print_layer_2_hero.png and print_layer_3_frame.png
    in temp_assets/{card_id}/. Produces hero_cut.svg, hero_spacer.svg, frame_cut.svg, frame_spacer.svg.
    """
    backend_dir = Path(__file__).resolve().parent.parent
    assets_dir = backend_dir / "temp_assets" / card_id
    if not assets_dir.is_dir():
        raise FileNotFoundError(f"Assets directory not found: {assets_dir}")

    hero_path = assets_dir / "print_layer_2_hero.png"
    frame_path = assets_dir / "print_layer_3_frame.png"

    if not hero_path.is_file():
        raise FileNotFoundError(f"Missing {hero_path}")
    if not frame_path.is_file():
        raise FileNotFoundError(f"Missing {frame_path}")

    process_layer(hero_path, "hero")
    process_layer(frame_path, "frame")
    print("Cut files written: hero_cut.svg, hero_spacer.svg, frame_cut.svg, frame_spacer.svg")


def run_for_dir(assets_dir: Path) -> None:
    """
    Run process_layer for print_layer_2_hero.png and print_layer_3_frame.png
    in the given assets_dir. Produces hero_cut.svg, hero_spacer.svg, frame_cut.svg, frame_spacer.svg,
    and hero_frame_cut.svg (merged player + frame as one solid shape for top-layer left slot).
    """
    assets_dir = Path(assets_dir)
    hero_path = assets_dir / "print_layer_2_hero.png"
    frame_path = assets_dir / "print_layer_3_frame.png"
    if not hero_path.is_file():
        raise FileNotFoundError(f"Missing {hero_path}")
    if not frame_path.is_file():
        raise FileNotFoundError(f"Missing {frame_path}")
    process_layer(hero_path, "hero")
    process_layer(frame_path, "frame")
    process_layer_union(hero_path, frame_path, assets_dir / "hero_frame_cut.svg")
    process_layer_union_spacer(hero_path, frame_path, assets_dir / "hero_frame_spacer.svg")


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    CARD_ID = "3460f777-1969-4d71-940d-d3739df20834"
    if len(sys.argv) > 1:
        CARD_ID = sys.argv[1]
    run_for_card(CARD_ID)
