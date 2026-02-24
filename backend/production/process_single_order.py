"""
Process a single order: fetch assets, render layers, generate cut paths, build PDFs/SVG.

Input: order_id (CLI arg)
Actions:
  - Fetch assets for each card (from order_cards.design_data: background_url, overlay_url, hero/playerImageUrl).
  - Render per card (PIL): background (tint + player_name/text), hero, frame, and foreground composite (hero + overlay).
  - Cut paths from hero/overlay alphas: exact contour (vinyl kiss cut) and 0.5mm inset (spacer - Heavy Index Cardstock).
  - Build:
      1. order_{id}_backgrounds_6up.pdf — 6-up, background + frame_color tint + text; crop marks for guillotine.
      2. order_{id}_foregrounds_4up.pdf — 4-up, hero + overlay + text (text on foreground); Silhouette reg marks; 2px bleed.
      3. order_{id}_cutlines.svg — Layer 1 (Blue) vinyl kiss cut, Layer 2 (Red) spacer (0.5mm inset), Heavy Index Cardstock.

Output: output/{order_id}/

Run from backend: python -m production.process_single_order <order_id>
"""

import argparse
import logging
import sys
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from asset_fetcher import fetch_assets_from_design, get_supabase_client

from .cut_paths import run_for_dir as cut_paths_run_for_dir
from .pdf_builder import (
    build_top_layers_cutlines_svg,
    build_spacers_cutlines_svg,
    create_background_sheet,
    create_foreground_sheet,
)
from .render import run_three_layer_for_dir as render_run_three_layer_for_dir

logger = logging.getLogger(__name__)

BACKEND_DIR = _backend_dir
OUTPUT_BASE = BACKEND_DIR / "output"
BG6UP_SLOTS = 6
FG4UP_SLOTS = 4


def _short_order_id(order_id: str, length: int = 8) -> str:
    """Short slug for filenames (first N hex chars of UUID, no hyphens)."""
    s = (order_id or "").strip().replace("-", "")
    if len(s) >= length:
        return s[:length].lower()
    return (s or "ord").lower()[:length]


def get_order_cards(client, order_id: str) -> list[dict]:
    """Return list of order_cards (id, design_data or design_snapshot) for the order."""
    try:
        res = client.table("order_items").select("id").eq("order_id", order_id).execute()
        item_ids = [r["id"] for r in (res.data or [])]
        if item_ids:
            res = client.table("order_cards").select("id, design_data").in_("order_item_id", item_ids).execute()
            return list(res.data or [])
    except Exception:
        pass
    res = client.table("order_cards").select("id, design_data").eq("order_id", order_id).execute()
    return list(res.data or [])


def _order_exists(client, order_id: str) -> bool:
    """Return True if this order_id exists in the orders table."""
    try:
        res = client.table("orders").select("id").eq("id", order_id).limit(1).execute()
        return bool(res.data and len(res.data) > 0)
    except Exception:
        return False


def process_single_order(order_id: str) -> Path:
    """
    Fetch, render, cut, and build PDFs/SVG for the order. Returns output directory.
    """
    client = get_supabase_client()
    cards = get_order_cards(client, order_id)
    if not cards:
        if _order_exists(client, order_id):
            raise ValueError(
                f"No order_cards found for order {order_id}. "
                "This order has no saved cards. Place a new test order from Checkout (Place test order), "
                "then generate production files for that order."
            )
        raise ValueError(
            f"No order_cards found for order_id={order_id}. "
            "Either the order does not exist or it has no cards. Place a test order from Checkout first."
        )
    print(f"[Production] Order {order_id}: processing {len(cards)} card(s)", flush=True)
    logger.info("Order %s: processing %d card(s)", order_id, len(cards))

    out_dir = OUTPUT_BASE / order_id
    out_dir.mkdir(parents=True, exist_ok=True)

    card_dirs = []
    for i, oc in enumerate(cards):
        design = oc.get("design_data") or oc.get("design_snapshot") or {}
        # Log what snapshot data is available in the design
        bg_snap = bool(design.get("background_snapshot_data_url"))
        pl_snap = bool(design.get("player_snapshot_data_url"))
        fr_snap = bool(design.get("frame_snapshot_data_url"))
        logger.info(
            "Order %s: card %d design_data keys: %s | snapshots: bg=%s player=%s frame=%s",
            order_id, i, list(design.keys()), bg_snap, pl_snap, fr_snap,
        )
        card_dir = out_dir / f"card_{i}"
        card_dir.mkdir(parents=True, exist_ok=True)
        logger.info("Order %s: card %d - fetching assets", order_id, i)
        fetch_assets_from_design(design, card_dir)
        logger.info("Order %s: card %d - rendering layers (background tint+text, hero, frame, foreground)", order_id, i)
        render_run_three_layer_for_dir(card_dir, design=design)
        logger.info("Order %s: card %d - cut paths", order_id, i)
        cut_paths_run_for_dir(card_dir)
        card_dirs.append(card_dir)

    bg_images = [d / "print_layer_1_bg.png" for d in card_dirs if (d / "print_layer_1_bg.png").is_file()]
    player_images = [d / "print_layer_2_hero.png" for d in card_dirs if (d / "print_layer_2_hero.png").is_file()]
    frame_images = [d / "print_layer_3_frame.png" for d in card_dirs if (d / "print_layer_3_frame.png").is_file()]
    hero_cuts = [d / "hero_cut.svg" for d in card_dirs if (d / "hero_cut.svg").is_file()]
    frame_cuts = [d / "frame_cut.svg" for d in card_dirs if (d / "frame_cut.svg").is_file()]
    hero_frame_cuts = [d / "hero_frame_cut.svg" for d in card_dirs if (d / "hero_frame_cut.svg").is_file()]
    hero_spacers = [d / "hero_spacer.svg" for d in card_dirs if (d / "hero_spacer.svg").is_file()]
    frame_spacers = [d / "frame_spacer.svg" for d in card_dirs if (d / "frame_spacer.svg").is_file()]
    hero_frame_spacers = [d / "hero_frame_spacer.svg" for d in card_dirs if (d / "hero_frame_spacer.svg").is_file()]

    if not bg_images:
        raise FileNotFoundError("No background layers produced")
    if not player_images or not frame_images:
        raise FileNotFoundError("No player or frame layers produced")

    short_id = _short_order_id(order_id)
    logger.info("Order %s: building PDFs and cutlines SVG (top layers + spacers)", order_id)

    # 1. Background PDF: 6-up (3x2), crop marks for guillotine
    bg_path = out_dir / f"ord_{short_id}_bg_6up.pdf"
    create_background_sheet(bg_images, bg_path)

    # 2. Foreground PDF (4-up CMYK): left = player only, right = frame + text (2 cards per page, 4 slots)
    fg_images = []
    for d in card_dirs:
        player = d / "print_layer_2_hero.png"
        # Prefer frame+text for right column so 4-up frame layer includes text
        fr = d / "print_layer_3_frame_text.png"
        if not fr.is_file():
            fr = d / "print_layer_3_frame.png"
        if player.is_file():
            fg_images.append(player)
        if fr.is_file():
            fg_images.append(fr)
    if not fg_images:
        raise FileNotFoundError("No player or frame layers produced for 4-up PDF")
    fg_path = out_dir / f"ord_{short_id}_fg_4up.pdf"
    create_foreground_sheet(fg_images, fg_path)

    # 3. Cutlines SVG: top layers and spacers.
    # Spacers are output at 2x quantity (same paths duplicated) for layered assembly.
    cards_per_page = 2
    num_top_pages = (len(card_dirs) + cards_per_page - 1) // cards_per_page
    for p in range(num_top_pages):
        start = p * cards_per_page
        end = min(start + cards_per_page, len(card_dirs))
        hf_c = hero_frame_cuts[start:end]
        f_c = frame_cuts[start:end]
        suffix = f"_{p + 1}" if num_top_pages > 1 else ""
        top_path = out_dir / f"ord_{short_id}_top{suffix}.svg"
        build_top_layers_cutlines_svg(hf_c, f_c, top_path)

    # Duplicate spacer entries so each card's spacer set is cut twice.
    hf_s_all = []
    f_s_all = []
    for hf_s, f_s in zip(hero_frame_spacers, frame_spacers):
        hf_s_all.extend([hf_s, hf_s])
        f_s_all.extend([f_s, f_s])

    num_spacer_pages = (len(hf_s_all) + cards_per_page - 1) // cards_per_page
    for p in range(num_spacer_pages):
        start = p * cards_per_page
        end = min(start + cards_per_page, len(hf_s_all))
        hf_s = hf_s_all[start:end]
        f_s = f_s_all[start:end]
        suffix = f"_{p + 1}" if num_spacer_pages > 1 else ""
        spacer_path = out_dir / f"ord_{short_id}_spacer{suffix}.svg"
        build_spacers_cutlines_svg(hf_s, f_s, spacer_path)

    return out_dir


def main():
    parser = argparse.ArgumentParser(description="Process a single order: fetch, render, cut, build PDFs and cutlines.")
    parser.add_argument("order_id", help="Order UUID")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose logging")
    args = parser.parse_args()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO)
    out = process_single_order(args.order_id)
    print(f"Done. Output: {out}")


if __name__ == "__main__":
    main()
