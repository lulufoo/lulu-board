"""Small helpers."""
from __future__ import annotations

import re
from pathlib import Path

from drawer_ctl import paths


def read_text_capped(path: Path, cap: int = paths.HISTORY_SOURCE_READ_CAP) -> str:
    """Read a history source without pulling a runaway file into memory."""
    try:
        with path.open("rb") as fh:
            raw = fh.read(max(1, int(cap)))
        return raw.decode("utf-8", errors="replace")
    except OSError:
        return ""


def sanitize_stem(label: str | None) -> str:
    raw = (label or "diagram").strip() or "diagram"
    stem = re.sub(r"[^\w\-]+", "-", raw, flags=re.UNICODE)
    stem = re.sub(r"-{2,}", "-", stem).strip("-._")
    return (stem[:48] or "diagram")


def new_board_id() -> str:
    """Short stable Board diagram id (history + live meta)."""
    import secrets
    return "b_" + secrets.token_hex(4)


def write_text_atomic(path: Path, text: str) -> None:
    """Write UTF-8 through to the real file (follows symlink targets)."""
    real = path.expanduser()
    try:
        real = real.resolve()
    except OSError:
        real = path
    real.parent.mkdir(parents=True, exist_ok=True)
    temp = real.with_name(real.name + ".tmp")
    temp.write_text(text, encoding="utf-8")
    temp.replace(real)
