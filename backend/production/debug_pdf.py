"""
Debug script: generate a one-page PDF with one image to verify ReportLab works.
Run from backend: python -m production.debug_pdf [path_to_print_layer_1_bg.png]
Output: backend/output/debug_test.pdf
"""
import sys
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as pdf_canvas

OUT = _backend_dir / "output"
OUT.mkdir(parents=True, exist_ok=True)
OUT_PDF = OUT / "debug_test.pdf"

# Same layout as create_background_sheet: one slot (2.625 x 3.625 = card + 1/16" bleed)
LAYER_W_IN = 2.625
LAYER_H_IN = 3.625
BG6UP_PAGE_IN = (11.0, 8.5)
x_in = (11.0 - 3 * LAYER_W_IN) / 2 + 0  # first slot left
y_in = (8.5 - 2 * LAYER_H_IN) / 2 + 0   # first slot top
img_w_pt = LAYER_W_IN * inch
img_h_pt = LAYER_H_IN * inch
w_pt = BG6UP_PAGE_IN[0] * inch
h_pt = BG6UP_PAGE_IN[1] * inch
x_pt = x_in * inch
y_pt = h_pt - (y_in * inch + img_h_pt)


def main():
    if len(sys.argv) < 2:
        # Create a minimal PIL image and draw it (788 x 1088 = 2.625" x 3.625" at 300 DPI)
        from PIL import Image
        img = Image.new("RGB", (788, 1088), (200, 100, 100))  # reddish
        jpeg_path = OUT / "debug_source.jpg"
        img.save(jpeg_path, "JPEG", quality=90)
        print(f"Created test image: {jpeg_path}")
        image_path = jpeg_path
    else:
        image_path = Path(sys.argv[1]).resolve()
        if not image_path.is_file():
            print(f"File not found: {image_path}")
            sys.exit(1)
        # Convert PNG to JPEG so we test with filename path
        from PIL import Image
        img = Image.open(image_path).convert("RGB")
        jpeg_path = OUT / "debug_source.jpg"
        img.save(jpeg_path, "JPEG", quality=90)
        print(f"Converted to JPEG: {jpeg_path}")
        image_path = jpeg_path

    c = pdf_canvas.Canvas(str(OUT_PDF), pagesize=landscape(letter))
    # Red frame where image will go
    c.setStrokeColorRGB(1, 0, 0)
    c.setLineWidth(2)
    c.rect(x_pt, y_pt, img_w_pt, img_h_pt, fill=0, stroke=1)
    # Draw image by filename (same as ReportLab's normal path)
    try:
        c.drawImage(str(image_path), x_pt, y_pt, width=img_w_pt, height=img_h_pt)
        print("drawImage(filename) succeeded")
    except Exception as e:
        print(f"drawImage failed: {e}")
    # Try drawInlineImage with PIL Image
    try:
        from PIL import Image
        img = Image.open(image_path).convert("RGB")
        c.drawInlineImage(img, x_pt + 220, y_pt, width=img_w_pt * 0.5, height=img_h_pt * 0.5)
        print("drawInlineImage(PIL) succeeded (small copy)")
    except Exception as e:
        print(f"drawInlineImage failed: {e}")
    c.save()
    print(f"Wrote: {OUT_PDF}")
    print("Open the PDF: if you see a red rectangle and (optionally) image content, ReportLab is working.")


if __name__ == "__main__":
    main()
