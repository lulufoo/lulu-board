"""Output helpers shared by the commands of board_control.py."""
from __future__ import annotations

import json


def emit(payload: dict) -> None:
    """Print one JSON object on stdout. A command never puts source text in it."""
    print(json.dumps(payload, ensure_ascii=False))
