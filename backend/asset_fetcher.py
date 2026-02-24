"""
Fetch card asset images from Supabase and save them locally.

Requirements:
  - Supabase Python client (`pip install supabase`)
  - requests (`pip install requests`)

Configuration:
  - Set SUPABASE_URL and SUPABASE_KEY in your environment.

Usage:
  - Edit CARD_ID below.
  - Run: python asset_fetcher.py

Behavior:
  - Queries the `cards` table for CARD_ID.
  - Reads `design_data` JSONB: background_url, hero_url, overlay_url.
  - Creates folder `temp_assets/{card_id}/` next to this script.
  - Downloads as: background.jpg, hero.png, frame.png.
"""

import base64
import os
import re
from pathlib import Path
from typing import Optional

import requests

# ---------- CONFIGURE THIS ----------
# The card ID you want to fetch assets for
CARD_ID = "c6a3c13f-49e9-466b-9331-ce158ac0b3cb"  # e.g. "d3b8b8a4-1234-5678-9abc-def012345678"
# ------------------------------------


SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xawdqdceyihcbclbhgow.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhd2RxZGNleWloY2JjbGJoZ293Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgyMjI1NiwiZXhwIjoyMDg2Mzk4MjU2fQ.HCBJm-m9vtJNZMl7BeOVr1Nh0N4nF3k7XIIKi6iWXL8")


def get_supabase_client():
    """Create a Supabase client, preferring the installed package over any local folder named 'supabase'."""
    if not SUPABASE_KEY:
        raise SystemExit(
            "SUPABASE_KEY is not set.\n"
            "Set it in your environment to your Supabase anon or service_role key."
        )

    # Ensure site-packages is ahead of any local `supabase` folder on sys.path
    import sys
    import site

    for sp in site.getsitepackages():
        if sp not in sys.path:
            sys.path.insert(0, sp)

    try:
        from supabase import create_client
    except ImportError:
        raise SystemExit(
            "Could not import supabase. Install it with:\n"
            "  pip install supabase\n"
            "If you have a local folder named 'supabase', rename it so it doesn't shadow the package."
        ) from None

    return create_client(SUPABASE_URL, SUPABASE_KEY)


def download_image(url: str, dest_path: Path) -> bool:
    """Download a single image to dest_path. Returns True on success, False on failure."""
    try:
        print(f"  Downloading {url} -> {dest_path}")
        resp = requests.get(url, stream=True, timeout=30)
        resp.raise_for_status()

        dest_path.parent.mkdir(parents=True, exist_ok=True)
        with dest_path.open("wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        return True
    except Exception as e:
        print(f"  ERROR downloading {url}: {e}")
        return False


def _save_data_url(data_url: str, dest_path: Path) -> bool:
    """Decode a data:image/...;base64,... URL and save to dest_path. Returns True on success."""
    try:
        m = re.match(r"^data:image/[^;]+;base64,(.+)$", data_url.strip(), re.DOTALL)
        if not m:
            print(f"  [DataURL] Regex did NOT match for {dest_path.name} (url starts with: {data_url[:80]}...)")
            return False
        raw = base64.b64decode(m.group(1), validate=True)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_bytes(raw)
        print(f"  [DataURL] Saved {dest_path.name}: {len(raw)} bytes")
        return True
    except Exception as e:
        print(f"  [DataURL] ERROR saving {dest_path.name}: {e}")
        return False


def _write_placeholder_image(dest_path: Path, width: int = 825, height: int = 1125, rgb: tuple = (240, 240, 240)) -> None:
    """Write a minimal placeholder image so the pipeline can continue."""
    try:
        from PIL import Image
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        img = Image.new("RGB", (width, height), rgb)
        img.save(dest_path, "PNG" if dest_path.suffix.lower() == ".png" else "JPEG", quality=85)
    except Exception:
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)  # minimal fallback


def _write_transparent_placeholder(dest_path: Path, width: int = 825, height: int = 1125) -> None:
    """Write a fully transparent RGBA image so the frame layer doesn't obscure the card."""
    try:
        from PIL import Image
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        img = Image.new("RGBA", (width, height), (255, 255, 255, 0))
        img.save(dest_path, "PNG")
    except Exception:
        _write_placeholder_image(dest_path, width, height, (240, 240, 240))


def _background_from_hero(hero_path: Path, dest_path: Path, tint_rgb: tuple = None) -> bool:
    """Generate a background image from the hero (blurred, optional tint). Returns True if written."""
    try:
        from PIL import Image, ImageFilter
        if not hero_path.is_file():
            return False
        img = Image.open(hero_path).convert("RGB")
        w, h = img.size
        # Blur heavily so it's a soft backdrop
        blurred = img.filter(ImageFilter.GaussianBlur(radius=min(w, h) // 8))
        # Optionally tint with primary color (e.g. team color)
        if tint_rgb:
            tint = Image.new("RGB", blurred.size, tint_rgb)
            blurred = Image.blend(blurred, tint, alpha=0.4)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        blurred.save(dest_path, "JPEG", quality=88)
        return True
    except Exception:
        return False


def fetch_assets_for_card(card_id: str, client=None) -> Path:
    """
    Fetch assets for one card from Supabase into temp_assets/{card_id}/.
    Returns the assets directory Path. Raises if card not found or no URLs in design_data.
    """
    if client is None:
        client = get_supabase_client()
    base_dir = Path(__file__).resolve().parent
    out_dir = base_dir / "temp_assets" / card_id
    out_dir.mkdir(parents=True, exist_ok=True)

    res = client.table("cards").select("id, design_data").eq("id", card_id).limit(1).execute()
    if not res.data:
        raise FileNotFoundError(f"No card found with id={card_id}")
    row = res.data[0]
    design = row.get("design_data") or {}
    background_url = design.get("background_url")
    hero_url = design.get("hero_url")
    overlay_url = design.get("overlay_url")
    if not background_url and not hero_url and not overlay_url:
        raise ValueError(f"Card {card_id} design_data has no background_url, hero_url, or overlay_url")

    if background_url:
        download_image(background_url, out_dir / "background.jpg")
    if hero_url:
        download_image(hero_url, out_dir / "hero.png")
    if overlay_url:
        download_image(overlay_url, out_dir / "frame.png")
    return out_dir


def fetch_assets_from_design(design_snapshot: dict, dest_dir: Path) -> Path:
    """
    Fetch assets from design_snapshot into dest_dir.

    Pre-rendered snapshots (frontend capture) take priority when present:
      - background_snapshot_data_url / background_snapshot_url -> background_snapshot.png
      - player_snapshot_data_url / player_snapshot_url -> player_snapshot.png
      - frame_snapshot_data_url / frame_snapshot_url -> frame_snapshot.png
    When all three snapshots exist, the pipeline uses them as-is (no PIL compositing).
    When snapshots are missing, falls back to raw assets: background_url, hero_url, overlay_url
    (or playerImageUrl, logoDataUrl) and derives background from hero if needed.
    """
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    design = design_snapshot or {}

    def get_url(key: str, alt_key: str = None) -> Optional[str]:
        v = design.get(key) or (design.get(alt_key) if alt_key else None)
        return v if isinstance(v, str) and v.strip() else None

    def save_snapshot(data_or_url: str, path: Path) -> bool:
        if not data_or_url or not isinstance(data_or_url, str):
            return False
        if data_or_url.startswith("data:"):
            return _save_data_url(data_or_url, path)
        if data_or_url.startswith("http://") or data_or_url.startswith("https://"):
            return download_image(data_or_url, path)
        return False

    # Pre-rendered blobs from frontend (exact card builder output). Text is foreground layer (on top of frame).
    snap_keys = [
        ("background_snapshot_data_url", "background_snapshot_url", "background_snapshot.png"),
        ("player_snapshot_data_url", "player_snapshot_url", "player_snapshot.png"),
        ("frame_snapshot_data_url", "frame_snapshot_url", "frame_snapshot.png"),
        ("text_snapshot_data_url", "text_snapshot_url", "text_snapshot.png"),
    ]
    for data_key, url_key, filename in snap_keys:
        raw = get_url(data_key) or get_url(url_key)
        if raw:
            ok = save_snapshot(raw, dest_dir / filename)
            print(f"  [Snapshot] {filename}: data_key={data_key} len={len(raw)} saved={ok}")
        else:
            print(f"  [Snapshot] {filename}: NOT present in design_data (checked {data_key}, {url_key})")

    has_snapshots = (dest_dir / "background_snapshot.png").is_file() and (dest_dir / "player_snapshot.png").is_file() and (dest_dir / "frame_snapshot.png").is_file()
    print(f"  [Snapshot] All 3 snapshots present: {has_snapshots}")

    if has_snapshots:
        # Still fetch hero raw asset when available so backend can build player layer from
        # clean masked hero (avoids legacy snapshots where logo was baked into player snapshot).
        hero_url = get_url("hero_url", "playerImageUrl")
        if hero_url:
            if hero_url.startswith("data:"):
                _save_data_url(hero_url, dest_dir / "hero.png")
            elif hero_url.startswith("http://") or hero_url.startswith("https://"):
                download_image(hero_url, dest_dir / "hero.png")
        return dest_dir

    # Fallback: raw assets for rendering and cut paths
    hero_url = get_url("hero_url", "playerImageUrl")
    if hero_url:
        if hero_url.startswith("data:"):
            _save_data_url(hero_url, dest_dir / "hero.png")
        elif hero_url.startswith("http://") or hero_url.startswith("https://"):
            download_image(hero_url, dest_dir / "hero.png")
    if not (dest_dir / "hero.png").is_file():
        _write_placeholder_image(dest_dir / "hero.png", rgb=(255, 255, 255))

    frame_url = get_url("overlay_url", "logoDataUrl")
    if frame_url and frame_url.startswith("data:"):
        _save_data_url(frame_url, dest_dir / "frame.png")
    elif frame_url and (frame_url.startswith("http://") or frame_url.startswith("https://")):
        download_image(frame_url, dest_dir / "frame.png")
    if not (dest_dir / "frame.png").is_file():
        _write_transparent_placeholder(dest_dir / "frame.png")

    bg_url = get_url("background_url")
    if bg_url:
        if bg_url.startswith("data:"):
            _save_data_url(bg_url, dest_dir / "background.jpg")
        else:
            download_image(bg_url, dest_dir / "background.jpg")
    if not (dest_dir / "background.jpg").is_file():
        hero_path = dest_dir / "hero.png"
        tint = None
        if design.get("primaryColor"):
            try:
                from PIL import Image
                pc = design["primaryColor"]
                if isinstance(pc, str) and pc.startswith("#"):
                    r = int(pc[1:3], 16)
                    g = int(pc[3:5], 16)
                    b = int(pc[5:7], 16)
                    tint = (r, g, b)
            except Exception:
                pass
        if not _background_from_hero(hero_path, dest_dir / "background.jpg", tint_rgb=tint):
            _write_placeholder_image(dest_dir / "background.jpg", rgb=(248, 248, 248))

    return dest_dir


def main():
    if not CARD_ID:
        raise SystemExit("Please set CARD_ID at the top of asset_fetcher.py before running.")
    fetch_assets_for_card(CARD_ID)
    print("Done. Assets downloaded successfully.")


if __name__ == "__main__":
    main()

