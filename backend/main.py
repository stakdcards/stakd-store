import asyncio
import os
import shutil
import sys
import threading
import uuid
import colorsys
import binascii
import io
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, List
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query, Header, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from rembg import remove, new_session
from PIL import Image
from sklearn.cluster import KMeans

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Card Builder API", version="2.0")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    """Return JSON 500 for any unhandled exception so the response gets CORS headers from middleware."""
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )

# Initialize RemBG sessions for different models (lazy loaded)
# All models are FREE and run locally - no API fees!
REMBG_SESSIONS = {}
AVAILABLE_MODELS = {
    'u2net': 'General purpose - Fast and accurate',
    'u2netp': 'Lightweight - Faster, lower memory',
    'u2net_human_seg': 'Optimized for people in static poses',
    'u2net_cloth_seg': 'Optimized for clothing details',
    'silueta': 'High quality edges - Excellent for dynamic poses',
    'isnet-general-use': 'Best overall - Recommended for athletes ⭐',
    'isnet-anime': 'Cartoon/illustrated characters only',
}

def get_rembg_session(model_name: str = 'u2net_human_seg'):
    """
    Get or create a RemBG session for the specified model.
    Sessions are cached for performance.
    All models run locally with NO API fees!
    """
    if model_name not in REMBG_SESSIONS:
        try:
            logger.info(f"Initializing RemBG model: {model_name}")
            REMBG_SESSIONS[model_name] = new_session(model_name)
            logger.info(f"Model {model_name} loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            # Fallback to default model
            if 'u2net' not in REMBG_SESSIONS:
                REMBG_SESSIONS['u2net'] = new_session('u2net')
            return REMBG_SESSIONS['u2net']
    return REMBG_SESSIONS[model_name]

# Allowed origins for CORS (must be explicit when using credentials)
CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


async def add_cors_headers(request, call_next):
    """Ensure every response has CORS headers so errors (e.g. 500) don't get blocked by the browser."""
    response = await call_next(request)
    origin = request.headers.get("origin")
    if origin and origin in CORS_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
    else:
        response.headers["Access-Control-Allow-Origin"] = CORS_ORIGINS[0]
    response.headers.setdefault("Access-Control-Allow-Credentials", "true")
    response.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    response.headers.setdefault("Access-Control-Allow-Headers", "*")
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
# Outermost: add CORS to every response (including 500/errors) so browser never blocks
app.middleware("http")(add_cors_headers)

# Storage Configuration
UPLOAD_DIR = "static/uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


def validate_file_extension(filename: str) -> bool:
    """Validate file has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def validate_file_size(file_content: bytes) -> bool:
    """Validate file size is within limits."""
    return len(file_content) <= MAX_FILE_SIZE


def crop_transparent_edges(image: Image.Image) -> Image.Image:
    """
    Crop transparent edges from image to remove empty space.
    This fixes the "wide handles" issue where background removal
    leaves too much transparent padding.
    """
    bbox = image.getbbox()
    if bbox:
        return image.crop(bbox)
    return image


def refine_edges(image: Image.Image, feather: int = 2, smooth: bool = True) -> Image.Image:
    """
    Refine edges for crisp, smooth results - perfect for athlete photos.
    
    Args:
        image: RGBA image with transparent background
        feather: Edge softening amount (0-5, default 2)
        smooth: Apply smoothing filter to edges
    
    Returns:
        Image with refined edges
    """
    try:
        from PIL import ImageFilter, ImageChops
        
        if image.mode != 'RGBA':
            return image
        
        # Extract alpha channel
        alpha = image.split()[3]
        
        if smooth:
            # Smooth edges to remove jaggedness
            alpha = alpha.filter(ImageFilter.SMOOTH_MORE)
        
        if feather > 0:
            # Feather edges slightly for natural look
            for _ in range(feather):
                alpha = alpha.filter(ImageFilter.SMOOTH)
        
        # Apply refined alpha back
        r, g, b, _ = image.split()
        return Image.merge('RGBA', (r, g, b, alpha))
    
    except Exception as e:
        logger.warning(f"Edge refinement failed: {e}, returning original")
        return image


def enhance_edges_for_athletes(image: Image.Image) -> Image.Image:
    """
    Special edge enhancement for athlete/dynamic photos.
    Focuses on crisp edges around limbs, hair, and equipment.
    """
    try:
        from PIL import ImageFilter, ImageEnhance
        
        if image.mode != 'RGBA':
            return image
        
        # Extract alpha channel
        r, g, b, alpha = image.split()
        
        # Step 1: Remove noise from alpha
        alpha = alpha.filter(ImageFilter.MedianFilter(size=3))
        
        # Step 2: Enhance edge contrast (makes edges more defined)
        enhancer = ImageEnhance.Contrast(alpha)
        alpha = enhancer.enhance(1.2)
        
        # Step 3: Slight blur to smooth jagged edges
        alpha = alpha.filter(ImageFilter.GaussianBlur(radius=0.5))
        
        # Recombine
        return Image.merge('RGBA', (r, g, b, alpha))
    
    except Exception as e:
        logger.warning(f"Edge enhancement failed: {e}, returning original")
        return image


def _luminance(r: float, g: float, b: float) -> float:
    """Rec. 709 luminance (0–1)."""
    return 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255)


def extract_dominant_colors(
    image: Image.Image,
    n_colors: int = 4,
    min_saturation: float = 0.2,
    min_value: float = 0.2
) -> List[str]:
    """
    Extract the single most dominant jersey color from an image using K-Means clustering.
    
    Samples only the lower 55% of the image (jersey/torso); filters out transparent pixels,
    skin tones, and very desaturated grays.
    
    Returns a list with one hex color: the cluster that has the most pixels (most dominant).
    """
    try:
        img = image.convert("RGBA")
        w, h = img.size
        img = img.resize((150, 150), Image.Resampling.LANCZOS)
        ar = np.array(img)
        shape = ar.shape
        # Sample only lower 55% of image (jersey/torso area); exclude upper 45% (face/head)
        rows_jersey = int(shape[0] * 0.55)
        ar_jersey = ar[rows_jersey:, :, :]
        ar_flat = ar_jersey.reshape(-1, shape[2])
        
        mask = ar_flat[:, 3] > 128
        solid_pixels = ar_flat[mask]
        
        if len(solid_pixels) == 0:
            solid_pixels = ar.reshape(-1, shape[2])[ar.reshape(-1, shape[2])[:, 3] > 128]
        if len(solid_pixels) == 0:
            logger.warning("No solid pixels found in image")
            return ["#000000"]
        
        valid_pixels = []
        for r, g, b, a in solid_pixels:
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if v < min_value:
                continue
            if s < 0.12 and v > 0.9:
                continue
            # Exclude skin: orange/peach hue (0.04–0.18) unless very saturated (jersey)
            is_skin_hue = 0.04 <= h <= 0.18
            if is_skin_hue and s < 0.65:
                continue
            # Exclude low saturation (gray/skin)
            if s >= min_saturation:
                valid_pixels.append([r, g, b])
        
        valid_pixels = np.array(valid_pixels) if valid_pixels else solid_pixels[:, :3]
        if len(valid_pixels) < 30:
            valid_pixels = solid_pixels[:, :3]
        
        n_clusters = min(8, max(4, len(valid_pixels) // 30))
        kmeans = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
        labels = kmeans.fit_predict(valid_pixels)
        colors_rgb = kmeans.cluster_centers_

        # Single most dominant jersey color: cluster with the most pixels
        unique, counts = np.unique(labels, return_counts=True)
        dominant_idx = unique[np.argmax(counts)]
        dominant_rgb = colors_rgb[dominant_idx]

        color_bytes = bytearray(int(round(c)) for c in np.clip(dominant_rgb, 0, 255))
        hex_color = f"#{binascii.hexlify(color_bytes).decode('ascii')}"
        return [hex_color]
    
    except Exception as e:
        logger.error(f"Error extracting colors: {e}")
        return ["#000000"]


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "Card Builder API is running"}


@app.get("/models")
async def list_models():
    """
    List all available background removal models.
    All models are FREE and run locally - no API fees!
    """
    return {
        "models": [
            {"id": k, "name": k, "description": v}
            for k, v in AVAILABLE_MODELS.items()
        ],
        "default": "u2net_human_seg",
        "note": "All models run locally on your machine - 100% FREE, no API costs!"
    }


@app.post("/remove-bg")
async def remove_background(
    file: UploadFile = File(...),
    model: str = Query(
        default="isnet-general-use",
        description="Model to use for background removal. Options: " + ", ".join(AVAILABLE_MODELS.keys())
    ),
    do_refine_edges: bool = Query(
        default=True,
        alias="refine_edges",
        description="Apply edge refinement for smoother, crisper edges (recommended for athletes)"
    ),
    enhance_for_athletes: bool = Query(
        default=False,
        description="Apply special edge enhancement optimized for dynamic poses/athletes"
    )
):
    """
    Remove background from uploaded image using LOCAL AI models.
    
    100% FREE - No API fees, runs entirely on your machine!
    
    Args:
        file: Image file to process
        model: Which AI model to use (default: u2net_human_seg - best for people)
    
    Returns:
        JSON with URL to processed image and filename
    """
    try:
        # Validate file extension
        if not validate_file_extension(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Read file content
        file_content = await file.read()
        
        # Validate file size
        if not validate_file_size(file_content):
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB"
            )
        
        # Open image
        try:
            input_image = Image.open(io.BytesIO(file_content))
        except Exception as e:
            logger.error(f"Error opening image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        logger.info(f"Processing image: {file.filename} ({input_image.size}) with model: {model}")
        
        # Get or create model session
        session = get_rembg_session(model)
        
        # Remove background using selected model
        output_image = remove(input_image, session=session)
        
        # Bbox of non-transparent content in *original* image coords (before crop)
        bbox = output_image.getbbox()
        if bbox:
            crop_bbox = {"x": bbox[0], "y": bbox[1], "width": bbox[2] - bbox[0], "height": bbox[3] - bbox[1]}
        else:
            crop_bbox = {"x": 0, "y": 0, "width": output_image.width, "height": output_image.height}
        
        # Apply edge enhancements if requested
        if enhance_for_athletes:
            logger.info("Applying athlete edge enhancement...")
            output_image = enhance_edges_for_athletes(output_image)
        elif do_refine_edges:
            logger.info("Applying edge refinement...")
            output_image = refine_edges(output_image, feather=2, smooth=True)
        
        # Save uncropped version (same dimensions as original, transparent bg).
        # Templates using "included"/"blurredOverlay" player background load this so
        # alignment with the original image is trivial (identical pixel grids).
        uncropped_filename = f"{uuid.uuid4()}_uncropped.png"
        uncropped_filepath = os.path.join(UPLOAD_DIR, uncropped_filename)
        output_image.save(uncropped_filepath, "PNG")

        # Crop transparent edges to remove empty space (default for "removed" mode)
        cropped_image = crop_transparent_edges(output_image)
        
        logger.info(f"Background removed, cropped size: {cropped_image.size}, uncropped size: {output_image.size}, crop_bbox: {crop_bbox}")
        
        # Save cropped version
        filename = f"{uuid.uuid4()}.png"
        filepath = os.path.join(UPLOAD_DIR, filename)
        cropped_image.save(filepath, "PNG")
        
        logger.info(f"Saved to: {filepath} (cropped) and {uncropped_filepath} (uncropped)")
        
        return {
            "url": f"http://localhost:8000/static/uploads/{filename}",
            "uncropped_url": f"http://localhost:8000/static/uploads/{uncropped_filename}",
            "filename": filename,
            "original_size": input_image.size,
            "processed_size": cropped_image.size,
            "crop_bbox": crop_bbox,
            "model_used": model,
            "edge_refinement": "athlete_enhanced" if enhance_for_athletes else ("refined" if do_refine_edges else "none"),
            "cost": "FREE - runs locally!"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"Unexpected error in remove_background: {e}\n{tb}")
        # Include error in response so client/logs can see it (e.g. model load failure, rembg error)
        detail = f"Internal server error: {type(e).__name__}: {e}"
        raise HTTPException(status_code=500, detail=detail)


@app.post("/extract-colors")
async def extract_colors(filename: str = Form(...)):
    """
    Extract dominant colors from a previously uploaded image.
    
    Args:
        filename: Name of file in uploads directory
    
    Returns:
        JSON with array of hex color codes
    """
    try:
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        # Validate filename (prevent path traversal)
        if not os.path.exists(filepath) or ".." in filename:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Open image
        try:
            img = Image.open(filepath)
        except Exception as e:
            logger.error(f"Error opening file {filepath}: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        logger.info(f"Extracting colors from: {filename}")
        
        # Extract colors (single most dominant jersey color)
        colors = extract_dominant_colors(img)
        
        logger.info(f"Extracted colors: {colors}")
        
        if not colors:
            return {"colors": ["#000000"]}
        return {"colors": colors[:1]}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in extract_colors: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for uncaught errors."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred"}
    )


@app.post("/api/save-templates")
async def save_templates(templates: dict):
    """Save template configuration to templates.js"""
    try:
        frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'templates.js')
        
        # Generate JavaScript content
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        js_content = f"""// Card Template Configurations
// Auto-updated by Admin panel - {timestamp}

export const TEMPLATES = {json.dumps(templates.get('templates', []), indent=2)};

// Color preset palettes
export const COLOR_PRESETS = [
  {{ primary: '#000000', secondary: '#ffffff', name: 'Black' }},
  {{ primary: '#6b7280', secondary: '#ffffff', name: 'Gray' }},
  {{ primary: '#ef4444', secondary: '#ffffff', name: 'Red' }},
  {{ primary: '#f97316', secondary: '#ffffff', name: 'Orange' }},
  {{ primary: '#fbbf24', secondary: '#000000', name: 'Yellow' }},
  {{ primary: '#22c55e', secondary: '#ffffff', name: 'Green' }},
  {{ primary: '#06b6d4', secondary: '#ffffff', name: 'Cyan' }},
  {{ primary: '#3b82f6', secondary: '#ffffff', name: 'Blue' }},
  {{ primary: '#a855f7', secondary: '#ffffff', name: 'Purple' }},
  {{ primary: '#ec4899', secondary: '#ffffff', name: 'Pink' }},
];

export const COLOR_PRESETS_ACCENT = [
  {{ primary: '#000000', accent: '#9ca3af', name: 'Black & Light Gray' }},
  {{ primary: '#6b7280', accent: '#d1d5db', name: 'Gray & Lighter Gray' }},
  {{ primary: '#ef4444', accent: '#fca5a5', name: 'Red & Light Red' }},
  {{ primary: '#f97316', accent: '#fdba74', name: 'Orange & Light Orange' }},
  {{ primary: '#fbbf24', accent: '#fde047', name: 'Yellow & Light Yellow' }},
  {{ primary: '#22c55e', accent: '#86efac', name: 'Green & Light Green' }},
  {{ primary: '#06b6d4', accent: '#67e8f9', name: 'Cyan & Light Cyan' }},
  {{ primary: '#3b82f6', accent: '#93c5fd', name: 'Blue & Light Blue' }},
  {{ primary: '#a855f7', accent: '#d8b4fe', name: 'Purple & Light Purple' }},
  {{ primary: '#ec4899', accent: '#f9a8d4', name: 'Pink & Light Pink' }},
];
"""
        
        # Write to file
        with open(frontend_path, 'w', encoding='utf-8') as f:
            f.write(js_content)
        
        logger.info(f"Successfully saved templates to {frontend_path}")
        return JSONResponse({"success": True, "message": "Templates saved successfully"})
    
    except Exception as e:
        logger.error(f"Error saving templates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Production / manufacturing pipeline (one design -> three outputs)
# ---------------------------------------------------------------------------

try:
    from production.config import (
        CARD_WIDTH_INCHES,
        CARD_HEIGHT_INCHES,
        SHEET_WIDTH_INCHES,
        SHEET_HEIGHT_INCHES,
        BLEED_INCHES,
        SPACER_INSET_MM,
        CARDS_PER_SHEET,
        DPI,
        REG_MARK_CORNERS,
        REG_MARK_SIZE_INCHES,
    )
    PRODUCTION_CONFIG = {
        "card_size_inches": [CARD_WIDTH_INCHES, CARD_HEIGHT_INCHES],
        "sheet_size_inches": [SHEET_WIDTH_INCHES, SHEET_HEIGHT_INCHES],
        "bleed_inches": BLEED_INCHES,
        "spacer_inset_mm": SPACER_INSET_MM,
        "cards_per_sheet": CARDS_PER_SHEET,
        "dpi": DPI,
        "registration_mark_size_inches": REG_MARK_SIZE_INCHES,
        "registration_mark_positions": [
            {"x_inches": c[0], "y_inches": c[1]} for c in REG_MARK_CORNERS
        ],
    }
except ImportError:
    PRODUCTION_CONFIG = {}


@app.get("/api/production/spec")
async def get_production_spec():
    """
    Return manufacturing constants for the frontend and for Silhouette setup.
    Use the same values when generating PDFs and cut files.
    """
    if not PRODUCTION_CONFIG:
        raise HTTPException(status_code=503, detail="Production module not configured")
    return PRODUCTION_CONFIG


# Cache of generated production output dirs: order_id -> Path (backend/output/{order_id})
PRODUCTION_OUTPUT_DIRS: dict[str, Path] = {}
# Background job state: order_id -> {"status": "running"|"completed"|"failed", "error": str|None}
PRODUCTION_JOBS: dict[str, dict] = {}
ADMIN_API_KEY = (os.getenv("STAKD_ADMIN_KEY") or "stakd-local-admin-key").strip()


def require_admin_access(
    x_admin_key: Optional[str] = Header(default=None),
    admin_key: Optional[str] = Query(default=None),
):
    """
    Lightweight local protection for admin-only production routes.
    Accept the key from either `X-Admin-Key` header or `admin_key` query.
    """
    provided = (x_admin_key or admin_key or "").strip()
    if not provided or provided != ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Admin access required")


def _list_production_artifacts(out_dir: Path) -> list[dict]:
    """Return list of { name, url } for PDF and SVG files in out_dir."""
    files = []
    if not out_dir.is_dir():
        return files
    for f in sorted(out_dir.iterdir()):
        if f.is_file() and f.suffix.lower() in (".pdf", ".svg"):
            files.append({
                "name": f.name,
                "filename": f.name,
                "url": f"/api/orders/{out_dir.name}/production/download/{f.name}",
            })
    return files


def _run_production_sync(order_id: str) -> None:
    """Run the pipeline in a thread; update PRODUCTION_JOBS and PRODUCTION_OUTPUT_DIRS when done."""
    print(f"[Production] Background job started for order {order_id}", flush=True)
    logger.info("Production generation started for order %s (running in background)", order_id)
    try:
        from production.process_single_order import process_single_order
        out_dir = process_single_order(order_id)
        PRODUCTION_OUTPUT_DIRS[order_id] = out_dir
        PRODUCTION_JOBS[order_id] = {"status": "completed", "error": None}
        print(f"[Production] Completed order {order_id} -> {out_dir}", flush=True)
        logger.info("Production generation completed for order %s -> %s", order_id, out_dir)
    except Exception as e:
        print(f"[Production] FAILED order {order_id}: {e}", flush=True)
        logger.exception("Production generate failed for order %s", order_id)
        PRODUCTION_JOBS[order_id] = {"status": "failed", "error": str(e)}


def _production_output_dir(order_id: str) -> Path:
    """Path to this order's production output folder (backend/output/{order_id})."""
    return Path(__file__).resolve().parent / "output" / order_id


@app.post("/api/orders/{order_id}/production/generate")
async def generate_production_files(
    order_id: str,
    clean: bool = Query(False, description="If true, delete existing output folder before generating (full restart)."),
    _: None = Depends(require_admin_access),
):
    """
    Start production file generation in the background. Returns 202 immediately.
    Poll GET /production/status for completion.
    If clean=1: removes existing output folder first so the run is from scratch.
    """
    if PRODUCTION_JOBS.get(order_id, {}).get("status") == "running":
        return JSONResponse(
            status_code=200,
            content={
                "order_id": order_id,
                "job_id": order_id,
                "status": "running",
                "message": "Generation already in progress.",
            },
        )
    if clean:
        out_dir = _production_output_dir(order_id)
        if out_dir.is_dir():
            try:
                shutil.rmtree(out_dir)
                logger.info("Cleared production output for order %s (full restart)", order_id)
            except Exception as e:
                logger.warning("Could not clear output dir for order %s: %s", order_id, e)
        PRODUCTION_OUTPUT_DIRS.pop(order_id, None)
    PRODUCTION_JOBS[order_id] = {"status": "running", "error": None}
    thread = threading.Thread(target=_run_production_sync, args=(order_id,), daemon=True)
    thread.start()
    return JSONResponse(
        status_code=202,
        content={
            "order_id": order_id,
            "job_id": order_id,
            "status": "queued",
            "message": "Production generation started. Refresh status or wait a moment for results." + (" (output cleared)" if clean else ""),
        },
    )


@app.get("/api/orders/{order_id}/production/status")
async def get_production_status(order_id: str, _: None = Depends(require_admin_access)):
    """Return status and download links for generated production files."""
    job = PRODUCTION_JOBS.get(order_id)
    if job and job.get("status") == "failed":
        return {
            "order_id": order_id,
            "status": "failed",
            "files": [],
            "message": job.get("error") or "Generation failed.",
        }
    out_dir = PRODUCTION_OUTPUT_DIRS.get(order_id)
    if out_dir is not None and out_dir.is_dir():
        files = _list_production_artifacts(out_dir)
        return {
            "order_id": order_id,
            "status": "completed",
            "files": files,
            "message": f"{len(files)} file(s) ready for download.",
        }
    if job and job.get("status") == "running":
        return {
            "order_id": order_id,
            "status": "running",
            "files": [],
            "message": "Generation in progress…",
        }
    return {
        "order_id": order_id,
        "status": "pending",
        "jobs": [],
        "files": [],
        "message": "No production files yet. Click Generate Production Files.",
    }


@app.get("/api/orders/{order_id}/production/download/{filename:path}")
async def download_production_file(order_id: str, filename: str, _: None = Depends(require_admin_access)):
    """Serve a generated PDF or SVG file for download."""
    out_dir = PRODUCTION_OUTPUT_DIRS.get(order_id)
    if out_dir is None or not out_dir.is_dir():
        raise HTTPException(status_code=404, detail="No production files for this order")
    out_dir_resolved = out_dir.resolve()
    path = (out_dir / filename).resolve()
    try:
        rel = path.relative_to(out_dir_resolved)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")
    if len(rel.parts) != 1 or rel.parts[0].startswith("."):
        raise HTTPException(status_code=404, detail="File not found")
    if not path.is_file() or path.suffix.lower() not in (".pdf", ".svg"):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=rel.name, media_type="application/octet-stream")


@app.get("/api/orders/{order_id}/production/files")
async def list_production_files(order_id: str, _: None = Depends(require_admin_access)):
    """List production files with download URLs (same as status when completed)."""
    out_dir = PRODUCTION_OUTPUT_DIRS.get(order_id)
    if out_dir is not None and out_dir.is_dir():
        return {"order_id": order_id, "files": _list_production_artifacts(out_dir)}
    return {"order_id": order_id, "files": []}


# Minimal Supabase schema we support: orders (id, status, created_at); order_cards (id, order_id, design_data).
# order_items is optional; if missing, order_cards are linked by order_id only.


@app.get("/api/orders")
async def list_orders():
    """
    List orders from Supabase. Uses minimal columns so it works with different schemas:
    - orders: id, status, created_at (no total_cents/updated_at required)
    - If order_items exists: order_items + order_cards by order_item_id. Else: order_cards by order_id only.
    - order_cards: id, order_id, design_data only.
    """
    try:
        from asset_fetcher import get_supabase_client
        client = get_supabase_client()
        r = client.table("orders").select("id, status, created_at").order("created_at", desc=True).limit(100).execute()
        rows = r.data or []
        if not rows:
            return {"orders": []}
        order_ids = [o["id"] for o in rows]
        orders_out = []
        try:
            oi = client.table("order_items").select("id, order_id, box_name, quantity, is_mega").in_("order_id", order_ids).execute()
            order_items = oi.data or []
        except Exception:
            order_items = []
        if order_items:
            order_item_ids = [x["id"] for x in order_items]
            items_by_order = {}
            for x in order_items:
                items_by_order.setdefault(x["order_id"], []).append(x)
            try:
                oc = client.table("order_cards").select("id, order_item_id, design_data").in_("order_item_id", order_item_ids).execute()
                order_cards = oc.data or []
            except Exception:
                order_cards = []
            cards_by_item = {}
            for c in order_cards:
                cards_by_item.setdefault(c.get("order_item_id"), []).append(c)
            for row in rows:
                oid = row["id"]
                item_list = items_by_order.get(oid, [])
                items = [
                    {
                        "id": it["id"],
                        "order_id": it["order_id"],
                        "box_name": it.get("box_name"),
                        "quantity": it.get("quantity", 1),
                        "is_mega": it.get("is_mega", False),
                        "cards": cards_by_item.get(it["id"], []),
                    }
                    for it in item_list
                ]
                card_total = sum(len(cards_by_item.get(it["id"], [])) for it in item_list)
                orders_out.append({
                    "id": oid,
                    "status": row.get("status") or "pending",
                    "total_cents": row.get("total_cents"),
                    "total": (row.get("total_cents") or 0) / 100.0,
                    "created_at": row.get("created_at"),
                    "date": (row.get("created_at") or "")[:10],
                    "items": items,
                    "boxes": len(items),
                    "cards": card_total,
                    "customer": "Customer",
                    "email": "",
                })
        else:
            try:
                oc = client.table("order_cards").select("id, order_id, design_data").in_("order_id", order_ids).execute()
                order_cards = oc.data or []
            except Exception:
                order_cards = []
            cards_by_order = {}
            for c in order_cards:
                cards_by_order.setdefault(c.get("order_id"), []).append(c)
            for row in rows:
                oid = row["id"]
                cards = cards_by_order.get(oid, [])
                items = [{"id": None, "order_id": oid, "box_name": "Box 1", "quantity": 1, "is_mega": False, "cards": cards}] if cards else []
                orders_out.append({
                    "id": oid,
                    "status": row.get("status") or "pending",
                    "total_cents": None,
                    "total": 0.0,
                    "created_at": row.get("created_at"),
                    "date": (row.get("created_at") or "")[:10],
                    "items": items if items else [{"cards": cards}],
                    "boxes": 1 if cards else 0,
                    "cards": len(cards),
                    "customer": "Customer",
                    "email": "",
                })
        return {"orders": orders_out}
    except ImportError as e:
        logger.warning("Supabase not available: %s", e)
        return {"orders": [], "error": "Supabase client not installed"}
    except Exception as e:
        logger.exception("List orders failed")
        return {"orders": [], "error": str(e)}


@app.patch("/api/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: dict):
    """
    Update order status in Supabase orders table.
    """
    allowed = {
        "pending",
        "accepted",
        "files_generated",
        "printed_cut",
        "assembled",
        "packed",
        "shipped",
        "cancelled",
    }
    status = str((payload or {}).get("status") or "").strip().lower()
    if status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status")
    try:
        from asset_fetcher import get_supabase_client
        client = get_supabase_client()
        client.table("orders").update({"status": status}).eq("id", order_id).execute()
        return {"order_id": order_id, "status": status}
    except ImportError:
        raise HTTPException(status_code=503, detail="Supabase not available")
    except Exception as e:
        logger.exception("Failed to update order status for %s", order_id)
        raise HTTPException(status_code=500, detail=str(e))


def _sanitize_for_jsonb(obj):
    """Return a JSON-serializable copy of obj so Supabase JSONB accepts it."""
    if obj is None:
        return {}
    try:
        return json.loads(json.dumps(obj, default=str))
    except (TypeError, ValueError):
        return {}


def _insert_order_card(client, order_item_id=None, order_id=None, card=None, sort_order=0):
    """Insert one row into order_cards. Minimal columns: order_id (or order_item_id) + design_data only."""
    card = card or {}
    design_snapshot = card.get("design_snapshot") or {}
    # Log snapshot availability so we can trace production issues
    bg_snap = design_snapshot.get("background_snapshot_data_url")
    pl_snap = design_snapshot.get("player_snapshot_data_url")
    fr_snap = design_snapshot.get("frame_snapshot_data_url")
    logger.info(
        "Inserting order_card: bg_snap=%s (%d chars), player_snap=%s (%d chars), frame_snap=%s (%d chars)",
        bool(bg_snap), len(bg_snap or ""),
        bool(pl_snap), len(pl_snap or ""),
        bool(fr_snap), len(fr_snap or ""),
    )
    row = {"design_data": _sanitize_for_jsonb(design_snapshot)}
    if order_item_id is not None:
        row["order_item_id"] = order_item_id
    if order_id is not None:
        row["order_id"] = order_id
    client.table("order_cards").insert(row).execute()


@app.post("/api/test-order")
async def create_test_order(order: dict):
    """
    Create a test order (no payment). Persists to Supabase (orders, order_items, order_cards)
    for testing the production pipeline. Returns order_id for use with process_single_order or Admin.
    """
    try:
        order_id = str(uuid.uuid4())
        test = order.get("test", False)
        if not test:
            raise HTTPException(status_code=400, detail="Only test orders allowed via this endpoint. Set test: true.")
        items = order.get("items") or []
        total_cents = order.get("total_cents")
        if total_cents is not None:
            total_cents = int(total_cents)

        try:
            from asset_fetcher import get_supabase_client
            client = get_supabase_client()
            # Insert only columns that exist in your orders table.
            client.table("orders").insert({
                "id": order_id,
                "status": "paid",
            }).execute()
            # Support two schemas: (1) orders -> order_items -> order_cards, or (2) orders -> order_cards (no order_items).
            sort_order = 0
            try:
                for item in items:
                    oi = client.table("order_items").insert({
                        "order_id": order_id,
                        "box_name": item.get("box_name") or "Box",
                        "is_mega": bool(item.get("is_mega")),
                        "quantity": int(item.get("quantity") or 1),
                    }).execute()
                    if not oi.data or len(oi.data) == 0:
                        raise RuntimeError("order_items insert returned no row")
                    order_item_id = oi.data[0]["id"]
                    for card in item.get("cards") or []:
                        _insert_order_card(client, order_item_id=order_item_id, order_id=None, card=card, sort_order=sort_order)
                        sort_order += 1
            except Exception as e:
                err_str = str(e).lower()
                if "order_items" in err_str or "pgrst204" in err_str:
                    # No order_items table: link order_cards directly to order (order_cards.order_id).
                    sort_order = 0
                    for item in items:
                        for card in item.get("cards") or []:
                            _insert_order_card(client, order_item_id=None, order_id=order_id, card=card, sort_order=sort_order)
                            sort_order += 1
                else:
                    raise
            logger.info(f"Test order persisted to Supabase: {order_id}, items={len(items)}")
        except ImportError as e:
            logger.warning(f"Supabase not available ({e}). Test order created in-memory only.")
        except Exception as e:
            err_msg = str(e)
            try:
                from postgrest.exceptions import APIError
                if isinstance(e, APIError):
                    parts = [getattr(e, "message", None), getattr(e, "details", None), getattr(e, "hint", None)]
                    err_msg = " ".join(p for p in parts if p).strip() or err_msg
            except ImportError:
                pass
            logger.exception("Supabase insert failed")
            raise HTTPException(status_code=500, detail=err_msg)

        return JSONResponse(
            status_code=201,
            content={
                "order_id": order_id,
                "message": "Test order created and saved to Supabase. Use this order_id with process_single_order or Admin.",
                "total_cents": total_cents,
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Test order error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/test-orders")
async def delete_all_test_orders():
    """
    Delete all orders from Supabase (and their order_cards, order_items if present).
    Use from Admin to clear test orders. Returns count of orders deleted.
    """
    try:
        from asset_fetcher import get_supabase_client
        client = get_supabase_client()
        r = client.table("orders").select("id").execute()
        order_ids = [row["id"] for row in (r.data or [])]
        if not order_ids:
            return {"deleted": 0, "message": "No orders to delete"}

        # Delete order_cards: by order_item_id first (if order_items table exists), then by order_id
        try:
            oi = client.table("order_items").select("id").in_("order_id", order_ids).execute()
            order_item_ids = [x["id"] for x in (oi.data or [])]
            if order_item_ids:
                client.table("order_cards").delete().in_("order_item_id", order_item_ids).execute()
                client.table("order_items").delete().in_("order_id", order_ids).execute()
        except Exception:
            pass
        client.table("order_cards").delete().in_("order_id", order_ids).execute()
        client.table("orders").delete().in_("id", order_ids).execute()

        logger.info("Deleted %d test orders from Supabase", len(order_ids))
        return {"deleted": len(order_ids), "message": f"Deleted {len(order_ids)} order(s)"}
    except ImportError as e:
        logger.warning("Supabase not available: %s", e)
        raise HTTPException(status_code=503, detail="Supabase not available")
    except Exception as e:
        logger.exception("Delete test orders failed")
        raise HTTPException(status_code=500, detail=str(e))


# Run this server (from repo root or from backend/):
#   cd backend && python main.py
# Or: cd backend && uvicorn main:app --host 0.0.0.0 --port 8000
# Then: GET http://localhost:8000/api/orders
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )