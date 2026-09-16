"""Title/kind derivation."""
from __future__ import annotations

import re

_RENDERER_STYLE_LINE = re.compile(r"^style\s+\S+\s*$", re.IGNORECASE)


def derive_board_title(text: str, fallback: str | None = None) -> str:
    """Human title for a Board source: board "…", else fallback."""
    for raw in str(text or "").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("meta "):
            continue
        if _RENDERER_STYLE_LINE.match(line):
            continue
        m = re.match(r"^board\s+(.+)$", line, flags=re.IGNORECASE)
        if m:
            rest = m.group(1).strip()
            if len(rest) >= 2 and rest[0] == rest[-1] and rest[0] in ('"', "'"):
                rest = rest[1:-1]
            rest = rest.strip()
            if rest:
                return rest[:80]
            break
        break
    fb = (fallback or "").strip()
    if fb and fb.lower() not in {"board", "stdin", "untitled", "restore"}:
        return fb[:80]
    return fb[:80] if fb else "board"
