"""
Production pipeline: One design -> Three outputs (Holo Base PDF, Hero Sheet PDF, Cut SVG/DXF).
"""

from .config import (
    CARD_SIZE_INCHES,
    SHEET_SIZE_INCHES,
    BLEED_INCHES,
    SPACER_INSET_MM,
    CARDS_PER_SHEET,
    DPI,
    REG_MARK_CORNERS,
    REG_MARK_SIZE_INCHES,
)

__all__ = [
    "CARD_SIZE_INCHES",
    "SHEET_SIZE_INCHES",
    "BLEED_INCHES",
    "SPACER_INSET_MM",
    "CARDS_PER_SHEET",
    "DPI",
    "REG_MARK_CORNERS",
    "REG_MARK_SIZE_INCHES",
]
