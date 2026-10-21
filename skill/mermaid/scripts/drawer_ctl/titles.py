"""Title derivation from Mermaid source."""
from __future__ import annotations

import re

_RENDERER_STYLE_LINE = re.compile(r"^(?:%%\s*)?style\s+\S+\s*$", re.IGNORECASE)
_META_LINE = re.compile(r"^(?:%%\s*)?meta\s+(\S+|{.*})\s*$")


def strip_leading_meta_lines(text: str) -> str:
    raw = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = raw.split("\n")
    idx = 0
    while idx < len(lines) and not lines[idx].strip():
        idx += 1
    while idx < len(lines) and _META_LINE.match(lines[idx].strip()):
        idx += 1
        while idx < len(lines) and not lines[idx].strip():
            idx += 1
    return "\n".join(lines[idx:])


def derive_title(text: str, fallback: str | None = None) -> str:
    for raw in str(text or "").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        mermaid = re.match(r"^%%\s*title\s*:?\s*(.+?)\s*$", line, flags=re.IGNORECASE)
        if mermaid:
            title = mermaid.group(1).strip().strip("\"'")
            if title:
                return title[:80]
            continue
        if line.startswith("%%"):
            continue
        if _RENDERER_STYLE_LINE.match(line):
            continue
        break
    fb = (fallback or "").strip()
    return fb[:80] if fb else "Untitled"
