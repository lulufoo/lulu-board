"""Title/kind derivation."""
from __future__ import annotations

import re

from drawer_ctl import paths

_RENDERER_STYLE_LINE = re.compile(r"^(?:%%\s*)?style\s+\S+\s*$", re.IGNORECASE)


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


def derive_diagram_kind(text: str) -> str:
    """Mermaid diagram keyword (flowchart, mindmap, sequenceDiagram, …)."""
    for raw in str(text or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("%%") or line.startswith("---") or line.startswith("#"):
            continue
        if line.startswith("meta ") or _RENDERER_STYLE_LINE.match(line):
            continue
        m = re.match(
            r"^(C4Context|C4Container|C4Component|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|gitGraph|pie|mindmap|timeline|quadrantChart|xychart-beta|block-beta|architecture-beta|packet-beta|kanban|sankey-beta)\b",
            line,
            flags=re.IGNORECASE,
        )
        if m:
            return m.group(1)
        break
    return ""


def derive_diagram_title(text: str, fallback: str | None = None) -> str:
    """Human title for a Mermaid source: %% title, else diagram kind, else fallback."""
    for raw in str(text or "").splitlines():
        line = raw.strip()
        if not line or line.startswith("meta "):
            continue
        # %% title: Foo   or   %% title Foo
        m = re.match(r"^%%\s*title\s*:?\s*(.+?)\s*$", line, flags=re.IGNORECASE)
        if m:
            title = m.group(1).strip().strip(chr(34)+chr(39))
            if title:
                return title[:80]
        # skip other comments / frontmatter
        if line.startswith("%%") or line.startswith("---"):
            continue
        if _RENDERER_STYLE_LINE.match(line):
            continue
        # first diagram directive
        m = re.match(
            r"^(C4Context|C4Container|C4Component|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|gitGraph|pie|mindmap|timeline|quadrantChart|xychart-beta|block-beta|architecture-beta|packet-beta|kanban|sankey-beta)\b",
            line,
            flags=re.IGNORECASE,
        )
        if m:
            kind = m.group(1)
            rest = line[m.end():].strip().strip(chr(34)+chr(39))
            if rest and not rest.startswith(";"):
                return f"{kind} · {rest[:48]}"
            return kind
        break
    fb = (fallback or "").strip()
    if fb and fb.lower() not in {"diagram", "stdin", "untitled", "restore"}:
        return fb[:80]
    return fb[:80] if fb else "diagram"


