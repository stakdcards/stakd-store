"""
Manufacturing constants: card size, sheet, bleed, registration marks, cutter.
Canon TR8620a + Silhouette Portrait 4.
"""

from dataclasses import dataclass
from typing import Tuple

# --- Card ---
CARD_WIDTH_INCHES = 2.5
CARD_HEIGHT_INCHES = 3.5
CARD_SIZE_INCHES: Tuple[float, float] = (CARD_WIDTH_INCHES, CARD_HEIGHT_INCHES)

# --- Sheet (US Letter) ---
SHEET_WIDTH_INCHES = 8.5
SHEET_HEIGHT_INCHES = 11.0
SHEET_SIZE_INCHES: Tuple[float, float] = (SHEET_WIDTH_INCHES, SHEET_HEIGHT_INCHES)

# --- Bleed (1/16" per side) ---
BLEED_INCHES = 0.0625   # 1/16"
CARD_CELL_WIDTH_WITH_BLEED = CARD_WIDTH_INCHES + 2 * BLEED_INCHES   # 2.625"
CARD_CELL_HEIGHT_WITH_BLEED = CARD_HEIGHT_INCHES + 2 * BLEED_INCHES # 3.625"

# --- Margins (for registration and grip) ---
MARGIN_LEFT_INCHES = 0.5
MARGIN_RIGHT_INCHES = 0.5
MARGIN_TOP_INCHES = 0.5
MARGIN_BOTTOM_INCHES = 0.5
USABLE_WIDTH = SHEET_WIDTH_INCHES - MARGIN_LEFT_INCHES - MARGIN_RIGHT_INCHES   # 7.5
USABLE_HEIGHT = SHEET_HEIGHT_INCHES - MARGIN_TOP_INCHES - MARGIN_BOTTOM_INCHES # 10.0

# --- Ganging: 6-up (2 cols x 3 rows) fits 2.5x3.5 with margin ---
CARDS_PER_ROW = 2
CARDS_PER_COLUMN = 3
CARDS_PER_SHEET = CARDS_PER_ROW * CARDS_PER_COLUMN  # 6
# Optional: 9-up with slightly smaller effective card or different margins (configurable later)

# --- Spacer cut inset (Heavy Index Cardstock slightly smaller than vinyl to hide white edges) ---
SPACER_INSET_MM = 0.5
SPACER_INSET_INCHES = SPACER_INSET_MM / 25.4
SPACER_MATERIAL_LABEL = "Heavy Index Cardstock"

# --- Print resolution ---
DPI = 300
CARD_WIDTH_PX = int(CARD_WIDTH_INCHES * DPI)
CARD_HEIGHT_PX = int(CARD_HEIGHT_INCHES * DPI)

# --- Registration marks (Silhouette) ---
# Position: distance from corner of SHEET to center of mark
REG_MARK_OFFSET_X_INCHES = 0.25
REG_MARK_OFFSET_Y_INCHES = 0.25
REG_MARK_SIZE_INCHES = 0.2   # 0.2" x 0.2" square
# Corners: top-left, top-right, bottom-left (Silhouette often uses 3)
REG_MARK_CORNERS = [
    (REG_MARK_OFFSET_X_INCHES, REG_MARK_OFFSET_Y_INCHES),                           # top-left
    (SHEET_WIDTH_INCHES - REG_MARK_OFFSET_X_INCHES, REG_MARK_OFFSET_Y_INCHES),       # top-right
    (REG_MARK_OFFSET_X_INCHES, SHEET_HEIGHT_INCHES - REG_MARK_OFFSET_Y_INCHES),     # bottom-left
]
