"""Vercel Python entrypoint for the PantauPesisir API."""

from __future__ import annotations

import sys
from pathlib import Path

# Make the backend package importable regardless of where the bundle is mounted.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402,F401
