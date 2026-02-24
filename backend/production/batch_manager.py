"""
Batch pipeline: turn all cards with status='ordered' into ganged print PDFs and cut SVGs.

- Queries Supabase for cards where status = 'ordered'.
- For each: fetch assets (asset_fetcher), render layers (render), cut paths (cut_paths).
- Groups results into sets of 3; for each set builds one 8.5x11" sheet (PDF + cut SVG + spacer SVG).
- Optionally updates each card's status after it is included in a sheet. Set CARDS_SKIP_STATUS_UPDATE=1
  to skip updates (e.g. if your cards table status constraint doesn't allow the target value). Otherwise
  status is set from CARDS_STATUS_AFTER_PROCESSING (default: 'completed'). If the update fails (e.g. check
  constraint), the batch still completes and writes all PDFs/SVGs.
- Outputs to temp_assets/batch_output/ (sheet_001.pdf, sheet_001_cut.svg, sheet_001_spacer.svg, ...).

Run from backend with venv: python -m production.batch_manager
"""

import logging
import os
import sys
from pathlib import Path

# Allow importing backend-level asset_fetcher
_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from asset_fetcher import fetch_assets_for_card, get_supabase_client

from postgrest.exceptions import APIError as PostgrestAPIError

from .cut_paths import run_for_card as cut_paths_run_for_card
from .pdf_builder import (
    build_cut_master_svg_ganged,
    build_print_sheet_pdf_ganged,
)
from .render import run_three_layer_for_card as render_run_three_layer_for_card

logger = logging.getLogger(__name__)

BACKEND_DIR = _backend_dir
BATCH_OUTPUT_DIR = BACKEND_DIR / "temp_assets" / "batch_output"
NUM_PER_SHEET = 3
# Status to set on cards after they are added to a sheet. Must match your DB's cards_status_check.
STATUS_AFTER_PROCESSING = os.environ.get("CARDS_STATUS_AFTER_PROCESSING", "completed")
SKIP_STATUS_UPDATE = os.environ.get("CARDS_SKIP_STATUS_UPDATE", "").strip().lower() in ("1", "true", "yes")


def _run_pipeline_for_card(card_id: str, client) -> dict | None:
    """
    Fetch assets, run render, run cut_paths for one card.
    Returns a dict with paths for hero/frame images and cut/spacer SVGs, or None on failure.
    """
    try:
        fetch_assets_for_card(card_id, client)
        render_run_three_layer_for_card(card_id)
        cut_paths_run_for_card(card_id)
    except Exception as e:
        logger.exception("Pipeline failed for card %s: %s", card_id, e)
        return None

    assets_dir = BACKEND_DIR / "temp_assets" / card_id
    hero_img = assets_dir / "print_layer_2_hero.png"
    frame_img = assets_dir / "print_layer_3_frame.png"
    hero_cut = assets_dir / "hero_cut.svg"
    frame_cut = assets_dir / "frame_cut.svg"
    hero_spacer = assets_dir / "hero_spacer.svg"
    frame_spacer = assets_dir / "frame_spacer.svg"
    if not hero_img.is_file() or not frame_img.is_file():
        logger.error("Missing print layers for card %s", card_id)
        return None
    if not hero_cut.is_file() or not frame_cut.is_file():
        logger.error("Missing cut SVGs for card %s", card_id)
        return None

    return {
        "card_id": card_id,
        "hero_img": hero_img,
        "frame_img": frame_img,
        "hero_cut": hero_cut,
        "frame_cut": frame_cut,
        "hero_spacer": hero_spacer,
        "frame_spacer": frame_spacer,
    }


def run_batch() -> None:
    client = get_supabase_client()
    res = client.table("cards").select("id").eq("status", "ordered").execute()
    ordered = [r["id"] for r in (res.data or [])]
    if not ordered:
        print("No cards with status='ordered'. Nothing to do.")
        return

    print("Processing %d ordered card(s)..." % len(ordered))
    processed = []
    for card_id in ordered:
        result = _run_pipeline_for_card(card_id, client)
        if result is not None:
            processed.append(result)

    if not processed:
        print("No cards were successfully processed. Check logs above.")
        return

    BATCH_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sheets_generated = 0
    chunk_size = NUM_PER_SHEET
    for i in range(0, len(processed), chunk_size):
        original = processed[i : i + chunk_size]
        # Pad to 3 with first card so we always pass 3 paths
        chunk = list(original)
        while len(chunk) < NUM_PER_SHEET:
            chunk.append(chunk[0])
        hero_imgs = [c["hero_img"] for c in chunk]
        frame_imgs = [c["frame_img"] for c in chunk]
        hero_cuts = [c["hero_cut"] for c in chunk]
        frame_cuts = [c["frame_cut"] for c in chunk]
        hero_spacers = [c["hero_spacer"] for c in chunk]
        frame_spacers = [c["frame_spacer"] for c in chunk]
        sheet_num = sheets_generated + 1
        prefix = BATCH_OUTPUT_DIR / f"sheet_{sheet_num:03d}"
        build_print_sheet_pdf_ganged(hero_imgs, frame_imgs, prefix.with_suffix(".pdf"))
        build_cut_master_svg_ganged(
            hero_cuts, frame_cuts, BATCH_OUTPUT_DIR / f"sheet_{sheet_num:03d}_cut.svg", use_spacer=False
        )
        build_cut_master_svg_ganged(
            hero_spacers,
            frame_spacers,
            BATCH_OUTPUT_DIR / f"sheet_{sheet_num:03d}_spacer.svg",
            use_spacer=True,
        )
        sheets_generated += 1
        if not SKIP_STATUS_UPDATE:
            for c in original:
                try:
                    client.table("cards").update({"status": STATUS_AFTER_PROCESSING}).eq("id", c["card_id"]).execute()
                except PostgrestAPIError as e:
                    logger.warning("Status update failed for card %s: %s. Set CARDS_SKIP_STATUS_UPDATE=1 to skip updates.", c["card_id"], e)

    print("--- Batch report ---")
    print("Cards processed: %d" % len(processed))
    print("Sheets generated: %d" % sheets_generated)
    print("Output directory: %s" % BATCH_OUTPUT_DIR)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_batch()
