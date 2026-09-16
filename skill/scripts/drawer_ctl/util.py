"""Small helpers."""
from __future__ import annotations

import os
import re
import socket
from pathlib import Path

from drawer_ctl import paths

def decode_header_value(raw: str | None) -> str | None:
    """Decode client headerByteString values (utf8'' + percent-encoding)."""
    if raw is None:
        return None
    s = str(raw)
    if s.startswith("utf8''"):
        from urllib.parse import unquote
        return unquote(s[5:])
    if "%" in s:
        from urllib.parse import unquote
        try:
            return unquote(s)
        except Exception:
            return s
    return s


def pick_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def resolve_port(port: int | None) -> int:
    """Concrete loopback port. 0/None → paths.DEFAULT_PORT (fixed); else as given."""
    if isinstance(port, int) and port > 0:
        return port
    default = int(getattr(paths, "DEFAULT_PORT", 0) or 0)
    if default > 0:
        return default
    return pick_free_port()


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


