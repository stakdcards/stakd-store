"""
Local utility for generating STAKD production cut files.

Usage:
  python generate_cut_files.py <order_id>
  python generate_cut_files.py <order_id> --clean
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from production.process_single_order import process_single_order


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate cut-ready SVG/PDF production files for a single order id."
    )
    parser.add_argument("order_id", help="Order UUID from Supabase orders.id")
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Delete backend/output/<order_id> before generation.",
    )
    args = parser.parse_args()

    backend_dir = Path(__file__).resolve().parent
    out_dir = backend_dir / "output" / args.order_id
    if args.clean and out_dir.exists():
        shutil.rmtree(out_dir)

    result_dir = process_single_order(args.order_id)
    svg_files = sorted(result_dir.glob("*.svg"))
    pdf_files = sorted(result_dir.glob("*.pdf"))

    print(f"Generated output: {result_dir}")
    if pdf_files:
        print("PDF files:")
        for f in pdf_files:
            print(f"  - {f.name}")
    if svg_files:
        print("SVG cut files:")
        for f in svg_files:
            print(f"  - {f.name}")


if __name__ == "__main__":
    main()
