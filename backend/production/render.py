"""
Render a single card to raster layers at print DPI using PIL.
  - Background: base image + frame_color tint + player_name (and text fields).
  - Foreground: hero + overlay (frame) composited for vinyl print; 2px bleed.
  - Cut paths use alphas from hero and overlay.
"""

import io
import logging
from pathlib import Path
from typing import Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

from .config import CARD_HEIGHT_PX, CARD_WIDTH_PX, DPI, CARD_CELL_WIDTH_WITH_BLEED, CARD_CELL_HEIGHT_WITH_BLEED

logger = logging.getLogger(__name__)

# --- 3-Layer Shadowbox constants (print canvas with 1/16" bleed; match config) ---
DPI_LAYERS = 300
CANVAS_W_PX = int(CARD_CELL_WIDTH_WITH_BLEED * DPI_LAYERS)   # 2.625" = 788
CANVAS_H_PX = int(CARD_CELL_HEIGHT_WITH_BLEED * DPI_LAYERS)  # 3.625" = 1088
# Safe zone for hero (inside bleed): ~2.25 x 3.25"
SAFE_W_PX = int(2.25 * DPI_LAYERS)   # 675
SAFE_H_PX = int(3.25 * DPI_LAYERS)   # 975
# Foreground PDF: 2px bleed on colored edges
FOREGROUND_BLEED_PX = 2


def render_holo_base_layer(design_snapshot: dict, asset_fetcher=None) -> Image.Image:
    """
    Composite background only: base + overlay + tint (no player, no text).
    Returns RGBA image at CARD_WIDTH_PX x CARD_HEIGHT_PX.
    """
    # TODO: Load template base/overlay/tint from asset_fetcher
    # TODO: Apply template dimensions and scaling
    # TODO: Apply color overlay if design_snapshot says so
    # Placeholder: solid color for now
    img = Image.new("RGBA", (CARD_WIDTH_PX, CARD_HEIGHT_PX), (240, 240, 240, 255))
    return img


def render_hero_layer(design_snapshot: dict, asset_fetcher=None) -> Image.Image:
    """
    Composite hero only: player image, frame, nameplate, stats.
    Background must be transparent (knockout) so holo shows through.
    Returns RGBA image at CARD_WIDTH_PX x CARD_HEIGHT_PX.
    """
    # TODO: Load player image, logo, template frame
    # TODO: Apply transforms from design_snapshot
    # TODO: Render text (name, team, etc.) with correct fonts/sizes
    # Placeholder: transparent with a simple rectangle for "frame"
    img = Image.new("RGBA", (CARD_WIDTH_PX, CARD_HEIGHT_PX), (0, 0, 0, 0))
    return img


def render_hero_alpha_mask(design_snapshot: dict, asset_fetcher=None) -> Image.Image:
    """
    Single-channel (alpha) mask: 255 where hero is visible, 0 elsewhere.
    Used for trace -> cut path and spacer inset.
    """
    hero = render_hero_layer(design_snapshot, asset_fetcher)
    return hero.split()[3]  # alpha channel


# --- 3-Layer Shadowbox Assembly ---


def _parse_color(hex_str: str) -> Optional[Tuple[int, int, int]]:
    """Parse #RRGGBB to (r, g, b) or return None."""
    if not hex_str or not isinstance(hex_str, str) or not hex_str.startswith("#"):
        return None
    hex_str = hex_str.strip()
    if len(hex_str) >= 7:
        try:
            r = int(hex_str[1:3], 16)
            g = int(hex_str[3:5], 16)
            b = int(hex_str[5:7], 16)
            return (r, g, b)
        except ValueError:
            pass
    return None


def process_background_snapshot(snapshot_path: Path, assets_dir: Path) -> Path:
    """
    Use pre-rendered frontend blob (background + tint + text) as-is. Scale to canvas, no PIL text/tint.
    Output: print_layer_1_bg.png
    """
    img = Image.open(snapshot_path)
    if img.mode != "RGB":
        img = img.convert("RGB")
    w, h = img.size
    scale = max(CANVAS_W_PX / w, CANVAS_H_PX / h)
    new_w, new_h = int(round(w * scale)), int(round(h * scale))
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    left = (new_w - CANVAS_W_PX) // 2
    top = (new_h - CANVAS_H_PX) // 2
    processed = img.crop((left, top, left + CANVAS_W_PX, top + CANVAS_H_PX))
    out_path = assets_dir / "print_layer_1_bg.png"
    processed.save(out_path, "PNG", dpi=(DPI_LAYERS, DPI_LAYERS))
    logger.info("Saved %s (from pre-rendered snapshot)", out_path)
    return out_path


def process_background(input_path: Path, design: Optional[dict] = None) -> Path:
    """
    Layer 1 (bottom): Background image + frame_color tint + player_name (and text) for card builder match.
    Used only when no pre-rendered snapshot. Input: background.jpg, design.
    Output: print_layer_1_bg.png
    """
    bg_canvas = Image.new("RGB", (CANVAS_W_PX, CANVAS_H_PX), (255, 255, 255))
    img = Image.open(input_path).convert("RGB")
    w, h = img.size
    scale = max(CANVAS_W_PX / w, CANVAS_H_PX / h)
    new_w, new_h = int(round(w * scale)), int(round(h * scale))
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    left = (new_w - CANVAS_W_PX) // 2
    top = (new_h - CANVAS_H_PX) // 2
    processed = img.crop((left, top, left + CANVAS_W_PX, top + CANVAS_H_PX))
    bg_canvas.paste(processed, (0, 0))

    design = design or {}
    tint_rgb = _parse_color(design.get("frame_color") or design.get("primaryColor") or "")
    if tint_rgb:
        tint_layer = Image.new("RGB", (CANVAS_W_PX, CANVAS_H_PX), tint_rgb)
        bg_canvas = Image.blend(bg_canvas, tint_layer, alpha=0.35)

    player_name = (design.get("playerName") or design.get("player_name") or "").strip() or None
    team_name = (design.get("teamName") or design.get("team_name") or "").strip() or None
    text_color = _parse_color(design.get("primaryColor") or design.get("secondaryColor") or "#FFFFFF") or (255, 255, 255)
    try:
        font_large = ImageFont.truetype("arial.ttf", 42)
        font_small = ImageFont.truetype("arial.ttf", 24)
    except (OSError, Exception):
        font_large = ImageFont.load_default()
        font_small = font_large
    def _text_size(draw_obj, text, font):
        try:
            bbox = draw_obj.textbbox((0, 0), text, font=font)
            return (bbox[2] - bbox[0], bbox[3] - bbox[1])
        except AttributeError:
            return draw_obj.textsize(text, font=font)

    draw = ImageDraw.Draw(bg_canvas)
    if player_name:
        tw, th = _text_size(draw, player_name, font_large)
        x = (CANVAS_W_PX - tw) // 2
        y = CANVAS_H_PX - 80 - th
        draw.text((x, y), player_name, fill=text_color, font=font_large)
    if team_name:
        tw, th = _text_size(draw, team_name, font_small)
        x = (CANVAS_W_PX - tw) // 2
        y = CANVAS_H_PX - 36 - th
        draw.text((x, y), team_name, fill=text_color, font=font_small)

    out_path = input_path.parent / "print_layer_1_bg.png"
    bg_canvas.save(out_path, "PNG", dpi=(DPI_LAYERS, DPI_LAYERS))
    logger.info("Saved %s", out_path)
    return out_path


def process_hero_snapshot(snapshot_path: Path, assets_dir: Path) -> Path:
    """Use pre-rendered player blob (masked, transparent). Scale to fit canvas. Output: print_layer_2_hero.png."""
    hero_canvas = Image.new("RGBA", (CANVAS_W_PX, CANVAS_H_PX), (255, 255, 255, 0))
    img = Image.open(snapshot_path)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    w, h = img.size
    scale = min(CANVAS_W_PX / w, CANVAS_H_PX / h, 1.0)
    new_w, new_h = int(round(w * scale)), int(round(h * scale))
    processed = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    paste_x = (CANVAS_W_PX - new_w) // 2
    paste_y = (CANVAS_H_PX - new_h) // 2
    hero_canvas.paste(processed, (paste_x, paste_y), processed)
    out_path = assets_dir / "print_layer_2_hero.png"
    hero_canvas.save(out_path, "PNG", dpi=(DPI_LAYERS, DPI_LAYERS))
    logger.info("Saved %s (from pre-rendered snapshot)", out_path)
    return out_path


def process_hero(input_path: Path) -> Path:
    """
    Layer 2 (middle): Player character — floating die-cut spacer.
    Input: hero.png (or raw asset when no snapshot).
    Output: print_layer_2_hero.png
    """
    hero_canvas = Image.new("RGBA", (CANVAS_W_PX, CANVAS_H_PX), (255, 255, 255, 0))
    img = Image.open(input_path)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    w, h = img.size
    scale = min(SAFE_W_PX / w, SAFE_H_PX / h, 1.0)
    new_w, new_h = int(round(w * scale)), int(round(h * scale))
    processed = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    paste_x = (CANVAS_W_PX - new_w) // 2
    paste_y = (CANVAS_H_PX - new_h) // 2
    hero_canvas.paste(processed, (paste_x, paste_y), processed)
    out_path = input_path.parent / "print_layer_2_hero.png"
    hero_canvas.save(out_path, "PNG", dpi=(DPI_LAYERS, DPI_LAYERS))
    logger.info("Saved %s", out_path)
    return out_path


def process_hero_with_design(input_path: Path, design: Optional[dict] = None) -> Path:
    """
    Layer 2 (middle): Player character with optional saved transform from card builder.
    If playerTransform is present in design, position/scale are applied against the print canvas.
    """
    hero_canvas = Image.new("RGBA", (CANVAS_W_PX, CANVAS_H_PX), (255, 255, 255, 0))
    img = Image.open(input_path)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    w, h = img.size

    # Match snapshot behavior: fit to full print canvas bounds (not smaller safe zone).
    scale = min(CANVAS_W_PX / w, CANVAS_H_PX / h, 1.0)

    design = design or {}
    transform = design.get("playerTransform") if isinstance(design, dict) else None
    if isinstance(transform, dict):
        try:
            scale_ratio = float(transform.get("scaleRatio", 1.0))
            scale *= max(0.05, scale_ratio)
        except Exception:
            pass

    new_w, new_h = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    processed = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    center_x = CANVAS_W_PX / 2
    center_y = CANVAS_H_PX / 2
    if isinstance(transform, dict):
        try:
            left_ratio = float(transform.get("leftRatio", 0.5))
            top_ratio = float(transform.get("topRatio", 0.55))
            center_x = left_ratio * CANVAS_W_PX
            center_y = top_ratio * CANVAS_H_PX
        except Exception:
            pass

    paste_x = int(round(center_x - new_w / 2))
    paste_y = int(round(center_y - new_h / 2))
    hero_canvas.paste(processed, (paste_x, paste_y), processed)

    out_path = input_path.parent / "print_layer_2_hero.png"
    hero_canvas.save(out_path, "PNG", dpi=(DPI_LAYERS, DPI_LAYERS))
    logger.info("Saved %s", out_path)
    return out_path


def process_frame_snapshot(snapshot_path: Path, assets_dir: Path) -> Path:
    """Use pre-rendered frame blob (transparent middle). Scale to cover canvas, harden alpha. Output: print_layer_3_frame.png."""
    frame_canvas = Image.new("RGBA", (CANVAS_W_PX, CANVAS_H_PX), (255, 255, 255, 0))
    img = Image.open(snapshot_path)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    w, h = img.size
    scale = max(CANVAS_W_PX / w, CANVAS_H_PX / h)
    new_w, new_h = int(round(w * scale)), int(round(h * scale))
    processed = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    left = (new_w - CANVAS_W_PX) // 2
    top = (new_h - CANVAS_H_PX) // 2
    processed = processed.crop((left, top, left + CANVAS_W_PX, top + CANVAS_H_PX))
    frame_canvas.paste(processed, (0, 0), processed)
    r, g, b, a = frame_canvas.split()
    a = a.point(lambda x: 255 if x > 128 else 0, mode="L")
    frame_canvas = Image.merge("RGBA", (r, g, b, a))
    out_path = assets_dir / "print_layer_3_frame.png"
    frame_canvas.save(out_path, "PNG", dpi=(DPI_LAYERS, DPI_LAYERS))
    logger.info("Saved %s (from pre-rendered snapshot)", out_path)
    return out_path


def process_frame(input_path: Path) -> Path:
    """
    Layer 3 (top): Frame/overlay — window cutout spacer. Input: frame.png (raw when no snapshot).
    Output: print_layer_3_frame.png
    """
    frame_canvas = Image.new("RGBA", (CANVAS_W_PX, CANVAS_H_PX), (255, 255, 255, 0))
    img = Image.open(input_path)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    w, h = img.size
    scale = max(CANVAS_W_PX / w, CANVAS_H_PX / h)
    new_w, new_h = int(round(w * scale)), int(round(h * scale))
    processed_frame = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    left = (new_w - CANVAS_W_PX) // 2
    top = (new_h - CANVAS_H_PX) // 2
    processed_frame = processed_frame.crop((left, top, left + CANVAS_W_PX, top + CANVAS_H_PX))
    frame_canvas.paste(processed_frame, (0, 0), processed_frame)
    r, g, b, a = frame_canvas.split()
    a = a.point(lambda x: 255 if x > 128 else 0, mode="L")
    frame_canvas = Image.merge("RGBA", (r, g, b, a))
    out_path = input_path.parent / "print_layer_3_frame.png"
    frame_canvas.save(out_path, "PNG", dpi=(DPI_LAYERS, DPI_LAYERS))
    logger.info("Saved %s", out_path)
    return out_path


def process_foreground_composite(assets_dir: Path) -> Path:
    """
    Composite hero + overlay (frame) + text for Foreground PDF. Text is on top so it is not hidden by frame.
    Add 2px bleed on colored edges. Output: print_foreground.png
    """
    hero_path = assets_dir / "print_layer_2_hero.png"
    frame_path = assets_dir / "print_layer_3_frame.png"
    if not hero_path.is_file() or not frame_path.is_file():
        raise FileNotFoundError(f"Need {hero_path} and {frame_path}")
    hero_img = Image.open(hero_path)
    if hero_img.mode != "RGBA":
        hero_img = hero_img.convert("RGBA")
    frame_img = Image.open(frame_path)
    if frame_img.mode != "RGBA":
        frame_img = frame_img.convert("RGBA")
    # Composite: hero first, then frame, then text on top (foreground layer)
    fg = Image.new("RGBA", (CANVAS_W_PX, CANVAS_H_PX), (255, 255, 255, 0))
    fg.paste(hero_img, (0, 0), hero_img)
    fg.paste(frame_img, (0, 0), frame_img)
    text_snap = assets_dir / "text_snapshot.png"
    if text_snap.is_file():
        text_img = Image.open(text_snap)
        if text_img.mode != "RGBA":
            text_img = text_img.convert("RGBA")
        w, h = text_img.size
        scale = max(CANVAS_W_PX / w, CANVAS_H_PX / h)
        new_w, new_h = int(round(w * scale)), int(round(h * scale))
        text_img = text_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        left = (new_w - CANVAS_W_PX) // 2
        top = (new_h - CANVAS_H_PX) // 2
        text_img = text_img.crop((left, top, left + CANVAS_W_PX, top + CANVAS_H_PX))
        fg.paste(text_img, (0, 0), text_img)
    # 2px bleed: expand canvas by 2px on each side
    bleed = FOREGROUND_BLEED_PX
    out_w, out_h = CANVAS_W_PX + 2 * bleed, CANVAS_H_PX + 2 * bleed
    expanded = Image.new("RGBA", (out_w, out_h), (255, 255, 255, 0))
    expanded.paste(fg, (bleed, bleed))
    out_path = assets_dir / "print_foreground.png"
    expanded.save(out_path, "PNG", dpi=(DPI_LAYERS, DPI_LAYERS))
    logger.info("Saved %s (hero + overlay + text, 2px bleed)", out_path)
    return out_path


def process_hero_frame_composite(assets_dir: Path) -> Path:
    """
    Composite hero + frame only (no text). For 4-up PDF left column (player+frame).
    Same 2px bleed as print_foreground. Output: print_hero_frame.png
    """
    hero_path = assets_dir / "print_layer_2_hero.png"
    frame_path = assets_dir / "print_layer_3_frame.png"
    if not hero_path.is_file() or not frame_path.is_file():
        raise FileNotFoundError(f"Need {hero_path} and {frame_path}")
    hero_img = Image.open(hero_path)
    if hero_img.mode != "RGBA":
        hero_img = hero_img.convert("RGBA")
    frame_img = Image.open(frame_path)
    if frame_img.mode != "RGBA":
        frame_img = frame_img.convert("RGBA")
    fg = Image.new("RGBA", (CANVAS_W_PX, CANVAS_H_PX), (255, 255, 255, 0))
    fg.paste(hero_img, (0, 0), hero_img)
    fg.paste(frame_img, (0, 0), frame_img)
    bleed = FOREGROUND_BLEED_PX
    out_w, out_h = CANVAS_W_PX + 2 * bleed, CANVAS_H_PX + 2 * bleed
    expanded = Image.new("RGBA", (out_w, out_h), (255, 255, 255, 0))
    expanded.paste(fg, (bleed, bleed))
    out_path = assets_dir / "print_hero_frame.png"
    expanded.save(out_path, "PNG", dpi=(DPI_LAYERS, DPI_LAYERS))
    logger.info("Saved %s (hero + frame, 2px bleed)", out_path)
    return out_path


def process_frame_text_composite(assets_dir: Path) -> Path:
    """
    Composite frame + text only (no hero). For 4-up PDF right column so the frame layer includes text.
    Same 2px bleed as print_foreground. Output: print_layer_3_frame_text.png
    """
    frame_path = assets_dir / "print_layer_3_frame.png"
    if not frame_path.is_file():
        raise FileNotFoundError(f"Need {frame_path}")
    frame_img = Image.open(frame_path)
    if frame_img.mode != "RGBA":
        frame_img = frame_img.convert("RGBA")
    fg = Image.new("RGBA", (CANVAS_W_PX, CANVAS_H_PX), (255, 255, 255, 0))
    fg.paste(frame_img, (0, 0), frame_img)
    text_snap = assets_dir / "text_snapshot.png"
    if text_snap.is_file():
        text_img = Image.open(text_snap)
        if text_img.mode != "RGBA":
            text_img = text_img.convert("RGBA")
        w, h = text_img.size
        scale = max(CANVAS_W_PX / w, CANVAS_H_PX / h)
        new_w, new_h = int(round(w * scale)), int(round(h * scale))
        text_img = text_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        left = (new_w - CANVAS_W_PX) // 2
        top = (new_h - CANVAS_H_PX) // 2
        text_img = text_img.crop((left, top, left + CANVAS_W_PX, top + CANVAS_H_PX))
        fg.paste(text_img, (0, 0), text_img)
    bleed = FOREGROUND_BLEED_PX
    out_w, out_h = CANVAS_W_PX + 2 * bleed, CANVAS_H_PX + 2 * bleed
    expanded = Image.new("RGBA", (out_w, out_h), (255, 255, 255, 0))
    expanded.paste(fg, (bleed, bleed))
    out_path = assets_dir / "print_layer_3_frame_text.png"
    expanded.save(out_path, "PNG", dpi=(DPI_LAYERS, DPI_LAYERS))
    logger.info("Saved %s (frame + text, 2px bleed)", out_path)
    return out_path


def run_three_layer_for_card(card_id: str, design: Optional[dict] = None) -> Tuple[Path, Path, Path, Path]:
    """
    Run process_background, process_hero, process_frame, process_foreground_composite for a card.
    Expects temp_assets/{card_id}/background.jpg, hero.png, frame.png.
    Returns (bg_path, hero_path, frame_path, foreground_path).
    """
    backend_dir = Path(__file__).resolve().parent.parent
    assets_dir = backend_dir / "temp_assets" / card_id
    if not assets_dir.is_dir():
        raise FileNotFoundError(f"Assets directory not found: {assets_dir}")
    return run_three_layer_for_dir(assets_dir, design=design)


def run_three_layer_for_dir(assets_dir: Path, design: Optional[dict] = None) -> Tuple[Path, Path, Path, Path]:
    """
    Produce print layers and foreground composite. Pre-rendered snapshots take priority when present.
    When background_snapshot.png, player_snapshot.png, frame_snapshot.png exist: use them as-is
    (scale to canvas only; no PIL text/tint). Otherwise use raw assets + design for background tint/text.
    Returns (bg_path, hero_path, frame_path, foreground_path).
    """
    assets_dir = Path(assets_dir)
    bg_snap = assets_dir / "background_snapshot.png"
    player_snap = assets_dir / "player_snapshot.png"
    frame_snap = assets_dir / "frame_snapshot.png"
    use_snapshots = bg_snap.is_file() and player_snap.is_file() and frame_snap.is_file()

    if use_snapshots:
        p1 = process_background_snapshot(bg_snap, assets_dir)
        p3 = process_frame_snapshot(frame_snap, assets_dir)
        # Prefer raw hero asset when present to avoid legacy player_snapshot blobs that may include logo.
        hero_path = assets_dir / "hero.png"
        if hero_path.is_file():
            p2 = process_hero_with_design(hero_path, design=design)
        else:
            p2 = process_hero_snapshot(player_snap, assets_dir)
    else:
        bg_path = assets_dir / "background.jpg"
        hero_path = assets_dir / "hero.png"
        frame_path = assets_dir / "frame.png"
        if not bg_path.is_file():
            raise FileNotFoundError(f"Missing {bg_path}")
        if not hero_path.is_file():
            raise FileNotFoundError(f"Missing {hero_path}")
        if not frame_path.is_file():
            raise FileNotFoundError(f"Missing {frame_path}")
        p1 = process_background(bg_path, design=design)
        p2 = process_hero_with_design(hero_path, design=design)
        p3 = process_frame(frame_path)
    p_fg = process_foreground_composite(assets_dir)
    process_hero_frame_composite(assets_dir)
    process_frame_text_composite(assets_dir)
    return p1, p2, p3, p_fg


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    CARD_ID = "3460f777-1969-4d71-940d-d3739df20834"
    if len(sys.argv) > 1:
        CARD_ID = sys.argv[1]
    run_three_layer_for_card(CARD_ID)
    print("Done. Layers: print_layer_1_bg.png, print_layer_2_hero.png, print_layer_3_frame.png, print_foreground.png")
