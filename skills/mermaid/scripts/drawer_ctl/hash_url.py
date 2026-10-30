"""Turn source into the public short URL returned by the create RPC."""
from __future__ import annotations

import sys
from pathlib import Path

_scripts = Path(__file__).resolve().parents[3] / "scripts"
if str(_scripts) not in sys.path:
    sys.path.insert(0, str(_scripts))

from short_link import PUBLIC_WEB_ORIGIN, create_short_url


def board_web_url(text: str, origin: str = PUBLIC_WEB_ORIGIN, version: int = 1) -> str:
    body = str(text or "")
    if not body.strip():
        return f"{origin.rstrip('/')}/"
    return create_short_url(body)
